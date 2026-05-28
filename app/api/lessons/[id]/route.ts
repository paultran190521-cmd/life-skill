import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { readSheetRowById, updateSheetRowById } from "@/lib/google-sheets";
import { normalizeLessonInput } from "@/lib/lessons";
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
      Object.assign(patch, normalizeLessonInput(body));
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
