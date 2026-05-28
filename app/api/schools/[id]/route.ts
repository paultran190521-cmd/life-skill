import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { deleteSheetRowById, readSheetRowById, readSheetRows, updateSheetRowById } from "@/lib/google-sheets";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId("school-patch");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_schools_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] schools.patch ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const { id } = await params;
    const before = await readSheetRowById("Schools", id);
    if (!before) {
      return apiFailure(404, "Không tìm thấy trường.", undefined, requestId);
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const district = String(body.district || "").trim();

    if (!name) {
      return apiFailure(400, "Tên trường là bắt buộc.", undefined, requestId);
    }

    const patch = {
      name,
      district: district || "Chưa cập nhật",
      updatedAt: new Date().toISOString(),
    };

    await updateSheetRowById("Schools", id, patch);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "school.update",
      entityType: "School",
      entityId: id,
      route: `/api/schools/${id}`,
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
  const requestId = createRequestId("school-delete");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_schools_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] schools.delete ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const { id } = await params;
    const before = await readSheetRowById("Schools", id);
    if (!before) {
      return apiFailure(404, "Không tìm thấy trường.", undefined, requestId);
    }

    const linkedClasses = await readSheetRows("Classes");
    if (linkedClasses.some((item) => item.schoolId === id)) {
      return apiFailure(400, "Không thể xóa trường vì đang có lớp thuộc trường này.", undefined, requestId);
    }

    await deleteSheetRowById("Schools", id);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "school.delete",
      entityType: "School",
      entityId: id,
      route: `/api/schools/${id}`,
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
