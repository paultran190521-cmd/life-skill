import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { appendSheetRows, ensureSheetHeaders, notificationHeaders, readSheetRows } from "@/lib/google-sheets";
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

    const notifications: Notification[] = rawNotifications.map((item: Record<string, unknown>) => {
      const title = String(item.title || "Thông báo").trim();
      const role = normalizeRole(item.role);
      const isFeedback = role === "admin" && title.toLowerCase().startsWith("feedback |");
      return {
        id: String(item.id || createId("n")),
        title,
        body: String(item.body || "").trim(),
        role,
        // Lấy danh tính từ phiên đăng nhập thay vì payload để người gửi không thể giả mạo.
        senderName: isFeedback ? auth.user.name : String(item.senderName || "").trim() || undefined,
        senderEmail: isFeedback ? auth.user.email : String(item.senderEmail || "").trim() || undefined,
        createdAt: String(item.createdAt || now),
        read: item.read ?? false,
        updatedAt: now,
      };
    });

    const teacherFeedbackOnly = notifications.every(
      (item: Notification) => item.role === "admin" && item.title.toLowerCase().startsWith("feedback |"),
    );
    const permission = evaluatePermission({
      allowed: auth.user.role === "admin" || (["teacher", "assistant"].includes(auth.user.role) && teacherFeedbackOnly),
      reason: ["teacher", "assistant"].includes(auth.user.role) ? "teacher_feedback_only" : "missing_permission",
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

    await ensureSheetHeaders("Notifications", notificationHeaders);
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
