import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { conflictError } from "@/lib/app-error";
import { ensureSheetHeaders, lessonHeaders, readSheetRowById, readSheetRows, updateSheetRowById } from "@/lib/google-sheets";
import { lessonDuplicateKey, normalizeLessonInput } from "@/lib/lessons";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId("lesson-patch");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_lessons_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] lessons.patch ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    // Cho phép chỉnh sửa bài học cũ ngay cả khi Sheet chưa được migrate header.
    await ensureSheetHeaders("Lessons", lessonHeaders);

    const { id } = await params;
    const before = await readSheetRowById("Lessons", id);
    if (!before) {
      return apiFailure(404, "Không tìm thấy bài học.", undefined, requestId);
    }

    const body = await request.json();
    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.active === false) {
      patch.active = false;
    } else {
      const normalized = normalizeLessonInput(body);
      const duplicate = (await readSheetRows("Lessons")).find((lesson) =>
        String(lesson.id || "") !== id
        && String(lesson.active || "true").trim().toLowerCase() !== "false"
        && lessonDuplicateKey(lesson) === lessonDuplicateKey(normalized),
      );
      if (duplicate) {
        throw conflictError(`Bài học bị trùng hoàn toàn với bài đã lưu: “${duplicate.title || normalized.title}”.`);
      }
      Object.assign(patch, normalized);
      patch.active = body.active ?? true;
    }

    await updateSheetRowById("Lessons", id, patch);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "lesson.update",
      entityType: "Lesson",
      entityId: id,
      route: `/api/lessons/${id}`,
      method: "PATCH",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      before,
      after: { ...before, ...patch },
    });
    return NextResponse.json({ id, ...patch });
  } catch (error) {
    return apiError(error, requestId);
  }
}
