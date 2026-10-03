import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import {
  deleteSheetRowById,
  ensureSheetHeaders,
  readSheetRowById,
  resourceLinkHeaders,
  updateSheetRowById,
} from "@/lib/google-sheets";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";
import { normalizeResourceUrl } from "../route";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId("resource-update");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_resources_write");
    if (!permission.allowed) return apiFailure(403, "Bạn không có quyền sửa tài nguyên.", undefined, requestId);

    await ensureSheetHeaders("ResourceLinks", resourceLinkHeaders);
    const { id } = await params;
    const before = await readSheetRowById("ResourceLinks", id);
    if (!before) return apiFailure(404, "Không tìm thấy tài nguyên.", undefined, requestId);

    const body = await request.json();
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (Object.prototype.hasOwnProperty.call(body, "title")) {
      const title = String(body.title || "").trim();
      if (!title) return apiFailure(400, "Tên tài nguyên là bắt buộc.", undefined, requestId);
      patch.title = title;
    }
    if (Object.prototype.hasOwnProperty.call(body, "url")) {
      const url = normalizeResourceUrl(body.url);
      if (!url) return apiFailure(400, "Đường dẫn tài nguyên phải bắt đầu bằng http:// hoặc https://.", undefined, requestId);
      patch.url = url;
    }
    if (Object.prototype.hasOwnProperty.call(body, "description")) patch.description = String(body.description || "").trim();
    if (Object.prototype.hasOwnProperty.call(body, "active")) patch.active = Boolean(body.active);
    if (Object.prototype.hasOwnProperty.call(body, "sortOrder")) patch.sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
    if (Object.keys(patch).length === 1) return apiFailure(400, "Chưa có nội dung tài nguyên cần cập nhật.", undefined, requestId);

    await updateSheetRowById("ResourceLinks", id, patch);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "resource_link.update",
      entityType: "ResourceLink",
      entityId: id,
      route: `/api/resources/${id}`,
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
  const requestId = createRequestId("resource-delete");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_resources_write");
    if (!permission.allowed) return apiFailure(403, "Bạn không có quyền xóa tài nguyên.", undefined, requestId);

    await ensureSheetHeaders("ResourceLinks", resourceLinkHeaders);
    const { id } = await params;
    const before = await readSheetRowById("ResourceLinks", id);
    if (!before) return apiFailure(404, "Không tìm thấy tài nguyên.", undefined, requestId);
    await deleteSheetRowById("ResourceLinks", id);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "resource_link.delete",
      entityType: "ResourceLink",
      entityId: id,
      route: `/api/resources/${id}`,
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
