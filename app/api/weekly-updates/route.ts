import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { appendSheetRow, readSheetRows, updateSheetRowById, deleteSheetRowById } from "@/lib/google-sheets";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";

export async function GET() {
  const requestId = createRequestId("weekly-update");
  try {
    return NextResponse.json(await readSheetRows("WeeklyUpdates"));
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId("weekly-update");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_weekly_updates_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] weeklyUpdate.create ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const body = await request.json();
    const weekNumber = Number(body.weekNumber);
    const updateDate = String(body.updateDate || "").trim();
    const schoolId = String(body.schoolId || "").trim();
    const classId = String(body.classId || "").trim();
    const teachingHours = Number(body.teachingHours ?? 0);
    const updatedBy = String(body.updatedBy || "Ms Mỹ Nhung").trim();
    const note = body.note ? String(body.note).trim() : undefined;

    if (!weekNumber || weekNumber <= 0) {
      return apiFailure(400, "Tuần phải lớn hơn 0.", undefined, requestId);
    }
    if (teachingHours < 0 || Number.isNaN(teachingHours)) {
      return apiFailure(400, "Số giờ dạy phải lớn hơn hoặc bằng 0.", undefined, requestId);
    }
    if (!schoolId) {
      return apiFailure(400, "Trường là bắt buộc.", undefined, requestId);
    }
    if (!classId) {
      return apiFailure(400, "Lớp là bắt buộc.", undefined, requestId);
    }

    const now = new Date().toISOString();
    const weeklyUpdate: Record<string, unknown> = {
      id: createId("wu"),
      weekNumber,
      updateDate,
      schoolId,
      classId,
      teachingHours,
      updatedBy,
      createdAt: now,
      updatedAt: now,
    };
    if (note !== undefined) {
      weeklyUpdate.note = note;
    }

    await appendSheetRow("WeeklyUpdates", weeklyUpdate);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "weeklyUpdate.create",
      entityType: "WeeklyUpdate",
      entityId: String(weeklyUpdate.id),
      route: "/api/weekly-updates",
      method: "POST",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      after: weeklyUpdate,
    });
    return NextResponse.json(weeklyUpdate);
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function PUT(request: Request) {
  const requestId = createRequestId("weekly-update");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_weekly_updates_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] weeklyUpdate.update ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id) {
      return apiFailure(400, "Thiếu id cập nhật tuần.", undefined, requestId);
    }

    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (body.weekNumber !== undefined) {
      patch.weekNumber = Number(body.weekNumber);
    }
    if (body.updateDate !== undefined) {
      patch.updateDate = String(body.updateDate).trim();
    }
    if (body.schoolId !== undefined) {
      patch.schoolId = String(body.schoolId).trim();
    }
    if (body.classId !== undefined) {
      patch.classId = String(body.classId).trim();
    }
    if (body.teachingHours !== undefined) {
      patch.teachingHours = Number(body.teachingHours);
    }
    if (body.updatedBy !== undefined) {
      patch.updatedBy = String(body.updatedBy).trim();
    }
    if (body.note !== undefined) {
      patch.note = String(body.note).trim();
    }

    await updateSheetRowById("WeeklyUpdates", id, patch);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "weeklyUpdate.update",
      entityType: "WeeklyUpdate",
      entityId: id,
      route: "/api/weekly-updates",
      method: "PUT",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      after: { id, ...patch },
    });
    return NextResponse.json({ id, ...patch });
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function DELETE(request: Request) {
  const requestId = createRequestId("weekly-update");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_weekly_updates_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] weeklyUpdate.delete ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") || "";
    if (!id) {
      return apiFailure(400, "Thiếu id cập nhật tuần.", undefined, requestId);
    }

    await deleteSheetRowById("WeeklyUpdates", id);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "weeklyUpdate.delete",
      entityType: "WeeklyUpdate",
      entityId: id,
      route: "/api/weekly-updates",
      method: "DELETE",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
    });
    return NextResponse.json({ id, deleted: true });
  } catch (error) {
    return apiError(error, requestId);
  }
}
