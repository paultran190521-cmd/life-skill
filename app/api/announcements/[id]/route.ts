import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import {
  appAnnouncementHeaders,
  deleteSheetRowById,
  ensureSheetHeaders,
  readSheetRowById,
  updateSheetRowById,
} from "@/lib/google-sheets";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";
import type { AppAnnouncementPriority } from "@/lib/types";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId("ann-patch");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_announcements_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] announcements.patch ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    await ensureSheetHeaders("AppAnnouncements", appAnnouncementHeaders);
    const { id } = await params;
    const before = await readSheetRowById("AppAnnouncements", id);
    if (!before) {
      return apiFailure(404, "Không tìm thấy thông báo.", undefined, requestId);
    }

    const body = await request.json();
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (Object.prototype.hasOwnProperty.call(body, "title")) {
      const title = String(body.title || "").trim();
      if (!title) {
        return apiFailure(400, "Tiêu đề thông báo là bắt buộc.", undefined, requestId);
      }
      patch.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(body, "body")) {
      const announcementBody = String(body.body || "").trim();
      if (!announcementBody) {
        return apiFailure(400, "Nội dung thông báo là bắt buộc.", undefined, requestId);
      }
      patch.body = announcementBody;
    }

    if (Object.prototype.hasOwnProperty.call(body, "priority")) {
      patch.priority = normalizePriority(body.priority);
    }

    if (Object.prototype.hasOwnProperty.call(body, "active")) {
      patch.active = Boolean(body.active);
    }

    await updateSheetRowById("AppAnnouncements", id, patch);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "announcement.update",
      entityType: "AppAnnouncement",
      entityId: id,
      route: `/api/announcements/${id}`,
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
  const requestId = createRequestId("ann-delete");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_announcements_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] announcements.delete ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    await ensureSheetHeaders("AppAnnouncements", appAnnouncementHeaders);
    const { id } = await params;
    const before = await readSheetRowById("AppAnnouncements", id);
    if (!before) {
      return apiFailure(404, "Không tìm thấy thông báo.", undefined, requestId);
    }
    await deleteSheetRowById("AppAnnouncements", id);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "announcement.delete",
      entityType: "AppAnnouncement",
      entityId: id,
      route: `/api/announcements/${id}`,
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

function normalizePriority(value: unknown): AppAnnouncementPriority {
  return value === "important_not_urgent" ? "important_not_urgent" : "important_urgent";
}
