import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";
import {
  loadTeachingReminderSettings,
  runTeachingReminders,
  saveTeachingReminderSettings,
} from "@/lib/teaching-reminders";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const requestId = createRequestId("reminder-settings");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_reminder_settings");
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền xem cấu hình bộ nhắc.", undefined, requestId);
    }
    return NextResponse.json(await loadTeachingReminderSettings());
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function PATCH(request: Request) {
  const requestId = createRequestId("reminder-settings-update");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_reminder_settings");
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thay đổi cấu hình bộ nhắc.", undefined, requestId);
    }

    const body = await request.json();
    const patch: Record<string, boolean> = {};
    for (const key of ["scheduleConfirmationEnabled", "workLogReminderEnabled"] as const) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        if (typeof body[key] !== "boolean") {
          return apiFailure(400, "Giá trị công tắc bộ nhắc không hợp lệ.", undefined, requestId);
        }
        patch[key] = body[key];
      }
    }
    if (Object.keys(patch).length === 0) {
      return apiFailure(400, "Không có cấu hình bộ nhắc cần cập nhật.", undefined, requestId);
    }

    const before = await loadTeachingReminderSettings();
    const settings = await saveTeachingReminderSettings(patch, auth.user.email || auth.user.id);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "teaching_reminders.settings_update",
      entityType: "ReminderSettings",
      entityId: settings.id,
      route: "/api/reminder-settings",
      method: "PATCH",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      before,
      after: settings,
    });
    return NextResponse.json(settings);
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId("reminder-run-now");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_reminder_settings");
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền chạy bộ nhắc.", undefined, requestId);
    }
    const body = await request.json().catch(() => ({}));
    if (body.action !== "run-now") {
      return apiFailure(400, "Thao tác bộ nhắc không hợp lệ.", undefined, requestId);
    }

    const result = await runTeachingReminders(`admin:${auth.user.email || auth.user.id}`);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "teaching_reminders.run_now",
      entityType: "ReminderSettings",
      entityId: result.settings.id,
      route: "/api/reminder-settings",
      method: "POST",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      after: {
        status: result.status,
        candidateCount: result.candidateCount,
        sentEmailCount: result.sentEmailCount,
        failedEmailCount: result.failedEmailCount,
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, requestId);
  }
}
