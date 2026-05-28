import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { appendSheetRows, readSheetRows } from "@/lib/google-sheets";
import { evaluatePermission, requireSessionUser } from "@/lib/route-auth";
import type { Notification } from "@/lib/types";

export async function GET() {
  const requestId = createRequestId("notifications-list");
  try {
    return NextResponse.json(await readSheetRows("Notifications"));
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId("notification");
  try {
    const auth = await requireSessionUser(request);
    const body = await request.json();
    const now = new Date().toISOString();
    const rawNotifications = Array.isArray(body?.notifications)
      ? body.notifications
      : Array.isArray(body)
        ? body
        : [body];

    const notifications: Notification[] = rawNotifications.map((item: Record<string, unknown>) => ({
      id: String(item.id || createId("n")),
      title: String(item.title || "Thông báo").trim(),
      body: String(item.body || "").trim(),
      role: normalizeRole(item.role),
      createdAt: String(item.createdAt || now),
      read: item.read ?? false,
      updatedAt: now,
    }));

    const teacherFeedbackOnly = notifications.every(
      (item: Notification) => item.role === "admin" && item.title.toLowerCase().startsWith("feedback |"),
    );
    const permission = evaluatePermission({
      allowed: auth.user.role === "admin" || (auth.user.role === "teacher" && teacherFeedbackOnly),
      reason: auth.user.role === "teacher" ? "teacher_feedback_only" : "missing_permission",
    });
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] notifications.create ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(
        403,
        "Giáo viên chỉ được gửi feedback theo mẫu về Admin.",
        undefined,
        requestId,
      );
    }

    await appendSheetRows("Notifications", notifications);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "notification.create",
      entityType: "Notification",
      entityId: notifications[0]?.id || "batch",
      route: "/api/notifications",
      method: "POST",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      after: { count: notifications.length, roles: notifications.map((item: Notification) => item.role) },
    });
    return NextResponse.json({ notifications });
  } catch (error) {
    return apiError(error, requestId);
  }
}

function normalizeRole(role: unknown): Notification["role"] {
  return role === "admin" || role === "teacher" || role === "all" ? role : "all";
}
