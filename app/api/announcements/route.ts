import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import {
  appAnnouncementHeaders,
  appendSheetRowWithHeaders,
  ensureSheetHeaders,
  readSheetRows,
} from "@/lib/google-sheets";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";
import type { AppAnnouncementPriority } from "@/lib/types";

export async function GET() {
  const requestId = createRequestId("ann-list");
  try {
    await ensureSheetHeaders("AppAnnouncements", appAnnouncementHeaders);
    return NextResponse.json(await readSheetRows("AppAnnouncements"));
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId("ann");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_announcements_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] announcements.create ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    await ensureSheetHeaders("AppAnnouncements", appAnnouncementHeaders);
    const body = await request.json();
    const title = String(body.title || "").trim();
    const announcementBody = String(body.body || "").trim();

    if (!title || !announcementBody) {
      return apiFailure(400, "Tiêu đề và nội dung thông báo là bắt buộc.", undefined, requestId);
    }

    const now = new Date().toISOString();
    const announcement = {
      id: String(body.id || createId("ann")),
      title,
      body: announcementBody,
      priority: normalizePriority(body.priority),
      active: body.active ?? true,
      createdBy: String(body.createdBy || auth.user.id).trim(),
      createdAt: String(body.createdAt || now),
      updatedAt: now,
    };

    await appendSheetRowWithHeaders("AppAnnouncements", appAnnouncementHeaders, announcement);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "announcement.create",
      entityType: "AppAnnouncement",
      entityId: announcement.id,
      route: "/api/announcements",
      method: "POST",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      after: announcement,
    });
    return NextResponse.json(announcement);
  } catch (error) {
    return apiError(error, requestId);
  }
}

function normalizePriority(value: unknown): AppAnnouncementPriority {
  return value === "important_not_urgent" ? "important_not_urgent" : "important_urgent";
}
