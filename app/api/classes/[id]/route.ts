import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { deleteSheetRowById, readSheetRowById, readSheetRows, updateSheetRowById } from "@/lib/google-sheets";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId("class-patch");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_classes_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] classes.patch ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const { id } = await params;
    const before = await readSheetRowById("Classes", id);
    if (!before) {
      return apiFailure(404, "Không tìm thấy lớp.", undefined, requestId);
    }

    const body = await request.json();
    const schoolId = String(body.schoolId || "").trim();
    const name = String(body.name || "").trim();
    const grade = String(body.grade || "").trim();
    const academicYear = String(body.academicYear || "").trim();

    if (!schoolId || !name || !grade) {
      return apiFailure(400, "Thiếu thông tin bắt buộc của lớp.", undefined, requestId);
    }

    const schools = await readSheetRows("Schools");
    if (!schools.some((school) => school.id === schoolId)) {
      return apiFailure(400, "Trường đã chọn không tồn tại.", undefined, requestId);
    }

    const patch = {
      schoolId,
      name,
      grade,
      academicYear,
      updatedAt: new Date().toISOString(),
    };

    await updateSheetRowById("Classes", id, patch);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "class.update",
      entityType: "Class",
      entityId: id,
      route: `/api/classes/${id}`,
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

export async function DELETE(request: Request, { params }: Params) {
  const requestId = createRequestId("class-delete");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_classes_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] classes.delete ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const { id } = await params;
    const before = await readSheetRowById("Classes", id);
    if (!before) {
      return apiFailure(404, "Không tìm thấy lớp.", undefined, requestId);
    }
    const schedules = await readSheetRows("Schedules");
    if (schedules.some((item) => item.classId === id && item.status !== "cancelled")) {
      return apiFailure(400, "Không thể xóa lớp vì đang có lịch dạy liên quan.", undefined, requestId);
    }

    await deleteSheetRowById("Classes", id);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "class.delete",
      entityType: "Class",
      entityId: id,
      route: `/api/classes/${id}`,
      method: "DELETE",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      before,
    });
    return NextResponse.json({ id, deleted: true });
  } catch (error) {
    return apiError(error, requestId);
  }
}
