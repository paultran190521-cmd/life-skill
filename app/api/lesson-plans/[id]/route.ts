import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { trashDriveFileById } from "@/lib/google-drive";
import { deleteSheetRowById, readSheetRowById, updateSheetRowById } from "@/lib/google-sheets";
import { evaluatePermission, requireSessionUser } from "@/lib/route-auth";

type Params = {
  params: Promise<{ id: string }>;
};

const GAS_TIMEOUT_MS = 25_000;

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId("lesson-plan-patch");
  try {
    const auth = await requireSessionUser(request);
    const { id } = await params;
    const lessonPlan = await readSheetRowById("LessonPlans", id);
    if (!lessonPlan) {
      return apiFailure(404, "Không tìm thấy giáo án.", undefined, requestId);
    }

    const permission = evaluatePermission({
      allowed: auth.user.role === "admin" || auth.user.teacherId === lessonPlan.teacherId,
      reason: "teacher_must_own_lesson_plan",
    });
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] lesson-plans.patch ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thao tác giáo án này.", undefined, requestId);
    }

    const body = await request.json();
    const fileName = String(body.fileName || "").trim();
    if (!fileName) {
      return apiFailure(400, "Tên giáo án là bắt buộc.", undefined, requestId);
    }

    const updatedAt = new Date().toISOString();
    await updateSheetRowById("LessonPlans", id, {
      fileName,
      updatedAt,
    });
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "lesson_plan.update",
      entityType: "LessonPlan",
      entityId: id,
      route: `/api/lesson-plans/${id}`,
      method: "PATCH",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      before: { fileName: lessonPlan.fileName },
      after: { fileName, updatedAt },
    });

    return NextResponse.json({
      id,
      fileName,
      updatedAt,
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const requestId = createRequestId("lesson-plan-delete");
  try {
    const auth = await requireSessionUser(request);
    const { id } = await params;
    const lessonPlan = await readSheetRowById("LessonPlans", id);
    if (!lessonPlan) {
      return apiFailure(404, "Không tìm thấy giáo án.", undefined, requestId);
    }
    const permission = evaluatePermission({
      allowed: auth.user.role === "admin" || auth.user.teacherId === lessonPlan.teacherId,
      reason: "teacher_must_own_lesson_plan",
    });
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] lesson-plans.delete ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thao tác giáo án này.", undefined, requestId);
    }

    if (!lessonPlan.driveFileId || lessonPlan.source === "external_link") {
      await deleteSheetRowById("LessonPlans", id);
      await appendAuditLog({
        requestId,
        actor: auth.user,
        action: "lesson_plan.delete",
        entityType: "LessonPlan",
        entityId: id,
        route: `/api/lesson-plans/${id}`,
        method: "DELETE",
        authMode: permission.authMode,
        decision: permission.decision,
        reason: permission.reason,
        source: auth.source,
        before: lessonPlan,
      });
      return NextResponse.json({ id, deleted: true });
    }

    const gasResult = await tryDeleteViaGas(id, requestId);

    if (!gasResult.deleted) {
      try {
        await trashDriveFileById(lessonPlan.driveFileId || "");
        await deleteSheetRowById("LessonPlans", id);
      } catch (fallbackError) {
        const reason = fallbackError instanceof Error ? fallbackError.message : "Unknown Google API error.";
        return apiFailure(
          502,
          `${gasResult.message} Fallback xóa cũng thất bại: ${reason}. Request ID: ${requestId}`,
          undefined,
          requestId,
        );
      }
    }
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "lesson_plan.delete",
      entityType: "LessonPlan",
      entityId: id,
      route: `/api/lesson-plans/${id}`,
      method: "DELETE",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      before: lessonPlan,
    });

    return NextResponse.json({ id, deleted: true });
  } catch (error) {
    return apiError(error, requestId);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, requestId: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GAS_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`GAS delete timeout sau ${GAS_TIMEOUT_MS}ms. Request ID: ${requestId}`);
    }
    throw new Error(`Không kết nối được GAS webhook. Request ID: ${requestId}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function tryDeleteViaGas(lessonPlanId: string, requestId: string) {
  const webhookUrl = process.env.GAS_UPLOAD_WEBHOOK_URL || process.env.GAS_MAIL_WEBHOOK_URL;
  const secret = process.env.GAS_UPLOAD_WEBHOOK_SECRET || process.env.GAS_MAIL_WEBHOOK_SECRET;
  if (!webhookUrl || !secret) {
    return { deleted: false, message: "Thiếu cấu hình GAS webhook." };
  }

  try {
    const gasResponse = await fetchWithTimeout(
      webhookUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=utf-8" },
        body: JSON.stringify({
          action: "deleteLessonPlan",
          secret,
          requestId,
          lessonPlanId,
        }),
      },
      requestId,
    );

    const rawText = (await gasResponse.text()).trim();
    const parsed = tryParseJson(rawText);
    if (gasResponse.ok && parsed?.ok) {
      return { deleted: true, message: "Deleted via GAS." };
    }

    return {
      deleted: false,
      message:
        parsed?.error ||
        parsed?.message ||
        `Không thể xóa giáo án từ GAS. HTTP ${gasResponse.status}.`,
    };
  } catch (error) {
    return {
      deleted: false,
      message: error instanceof Error ? error.message : "Không kết nối được GAS webhook.",
    };
  }
}

function tryParseJson(input: string): { ok?: boolean; error?: string; message?: string } | null {
  if (!input || input.startsWith("<")) {
    return null;
  }
  try {
    return JSON.parse(input) as { ok?: boolean; error?: string; message?: string };
  } catch {
    return null;
  }
}
