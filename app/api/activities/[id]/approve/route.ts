import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLogs } from "@/lib/audit";
import { sendActivityRewardEmail } from "@/lib/email";
import { activityAssignmentHeaders, activityOccurrenceHeaders, ensureActivityCatalog, ensureSheetHeaders, readSheetRowsBatch, updateSheetRowById } from "@/lib/google-sheets";
import { submitActivityCompletionToHrm } from "@/lib/hrm-integration";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";
import type { ActivityAssignment } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

function pendingIsFresh(status: string, updatedAt: string) {
  return status === "PENDING" && Date.now() - Date.parse(updatedAt || "") < 120_000;
}

function activityHasEnded(date: string, endTime: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const part = (name: string) => parts.find((item) => item.type === name)?.value || "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  return date < today || (date === today && (!endTime || endTime <= `${part("hour")}:${part("minute")}`));
}

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId("activity-attendance");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_activity_approve");
    if (!permission.allowed) return apiFailure(403, "Chỉ quản trị viên được chấm công hoạt động.", undefined, requestId);
    const { id: activityId } = await params;
    const body = await request.json() as Record<string, unknown>;
    const assignmentId = String(body.assignmentId || "").trim();
    const present = body.present;
    const approvalNote = String(body.approvalNote || "").trim();
    const submittedEvidence = String(body.evidenceUrl || "").trim();
    if (typeof present !== "boolean") return apiFailure(400, "Cần chọn có mặt hoặc vắng mặt.", undefined, requestId);
    await Promise.all([ensureSheetHeaders("ActivityOccurrences", activityOccurrenceHeaders), ensureSheetHeaders("ActivityAssignments", activityAssignmentHeaders)]);
    const [types, rows] = await Promise.all([
      ensureActivityCatalog(),
      readSheetRowsBatch(["ActivityOccurrences", "ActivityAssignments", "Users"] as const),
    ]);
    const activity = rows.ActivityOccurrences.find((item) => item.id === activityId);
    const assignment = rows.ActivityAssignments.find((item) => item.id === assignmentId && item.activityId === activityId);
    if (!activity || !assignment || activity.status === "CANCELLED") return apiFailure(404, "Không tìm thấy hoạt động hoặc người được giao.", undefined, requestId);
    const type = types.find((item) => item.id === activity.activityTypeId);
    const user = rows.Users.find((item) => item.teacherId === assignment.teacherId);
    if (!type || !user?.email) return apiFailure(409, "Thiếu loại hoạt động hoặc email nhân sự.", undefined, requestId);
    if (!activityHasEnded(activity.date, activity.endTime)) return apiFailure(409, "Chỉ chấm công sau khi hoạt động kết thúc.", undefined, requestId);

    if (!present) {
      if (assignment.status === "APPROVED" || assignment.integrationStatus === "CONFIRMED") return apiFailure(409, "HRM đã xác nhận quyền lợi. Cần hủy quyền lợi trước khi sửa chấm công.", undefined, requestId);
      if (assignment.status === "REJECTED") return NextResponse.json({ assignment, idempotent: true });
      if (assignment.integrationStatus === "PENDING") return apiFailure(409, "HRM đang xử lý người này.", undefined, requestId);
      const now = new Date().toISOString();
      const updated = { ...assignment, status: "REJECTED", approvedAt: now, approvedBy: auth.user.id, approvalNote, updatedAt: now };
      await updateSheetRowById("ActivityAssignments", assignment.id, updated);
      await appendAuditLogs([{ requestId, actor: auth.user, action: "activity.attendance_absent", entityType: "ActivityAssignment", entityId: assignment.id, route: `/api/activities/${activityId}/approve`, method: "POST", authMode: permission.authMode, decision: permission.decision, reason: permission.reason, source: auth.source, after: { activityId, present: false } }]);
      return NextResponse.json({ assignment: updated });
    }

    const activityAssignments = rows.ActivityAssignments.filter((item) => item.activityId === activityId);
    if (type.code === "INTERNAL_SHARING") {
      if (process.env.INTERNAL_SHARING_ROLE_POLICY_READY !== "true") {
        return apiFailure(409, "Chưa xác minh chính sách HRM cho người chủ trì và người tham dự. Quản trị viên cần hoàn tất cấu hình HRM trước khi ghi quyền lợi.", undefined, requestId);
      }
      if (activityAssignments.filter((item) => item.roleCode === "LEAD").length !== 1 || !["LEAD", "PARTICIPANT"].includes(assignment.roleCode)) {
        return apiFailure(409, "Buổi chia sẻ cần đúng một người chủ trì. Hãy kiểm tra vai trò trước khi ghi quyền lợi.", undefined, requestId);
      }
    } else if (assignment.roleCode !== "PARTICIPANT") {
      return apiFailure(409, "Vai trò của hoạt động chưa được HRM hỗ trợ.", undefined, requestId);
    }
    const evidenceUrl = submittedEvidence || assignment.evidenceUrl || "";
    if (evidenceUrl && !/^https:\/\//i.test(evidenceUrl)) return apiFailure(400, "Liên kết minh chứng cần bắt đầu bằng https://.", undefined, requestId);
    if (type.requiresEvidence && !evidenceUrl) return apiFailure(400, "Hoạt động này cần liên kết minh chứng trước khi chấm công.", undefined, requestId);

    let confirmed: ActivityAssignment = assignment as unknown as ActivityAssignment;
    let hrmResult: { money?: number; mcpPoints?: number; workLogId?: string; idempotent?: boolean } | undefined;
    if (assignment.status !== "APPROVED" || assignment.integrationStatus !== "CONFIRMED") {
      if (pendingIsFresh(assignment.integrationStatus, assignment.updatedAt)) return apiFailure(409, "HRM đang xử lý người này.", undefined, requestId);
      const idempotencyKey = `METTASOUL:ACTIVITY:${activity.id}:${assignment.id}`;
      const eventId = assignment.integrationEventId || `MTS_ACT_${createId("evt")}`;
      await updateSheetRowById("ActivityAssignments", assignment.id, { ...assignment, integrationStatus: "PENDING", integrationEventId: eventId, updatedAt: new Date().toISOString() });
      try {
        hrmResult = await submitActivityCompletionToHrm({ source: "METTASOUL", action: "SUBMIT_ACTIVITY_COMPLETION", eventId, idempotencyKey, activityId: activity.id, assignmentId: assignment.id, activityTypeCode: type.code, activityTitle: activity.title, userEmail: user.email.trim().toLowerCase(), roleCode: assignment.roleCode, unit: type.unit, workDate: activity.date, evidenceUrl: evidenceUrl || undefined });
      } catch (error) {
        const message = error instanceof Error ? error.message : "HRM từ chối chấm công hoạt động.";
        await updateSheetRowById("ActivityAssignments", assignment.id, { integrationStatus: "FAILED", updatedAt: new Date().toISOString(), approvalNote: message });
        return apiFailure(409, message, undefined, requestId);
      }
      const now = new Date().toISOString();
      confirmed = { ...(assignment as unknown as ActivityAssignment), status: "APPROVED", evidenceUrl, completedAt: now, approvedAt: now, approvedBy: auth.user.id, approvalNote, integrationStatus: "CONFIRMED", integrationEventId: eventId, hrmWorkLogId: hrmResult.workLogId || "", cashAmount: hrmResult.money ?? 0, mcpPoints: hrmResult.mcpPoints ?? 0 };
      await updateSheetRowById("ActivityAssignments", assignment.id, { ...confirmed, updatedAt: now });
      await updateSheetRowById("ActivityOccurrences", activity.id, { ...activity, status: "APPROVED", updatedAt: now });
      await appendAuditLogs([{ requestId, actor: auth.user, action: "activity.attendance_present", entityType: "ActivityAssignment", entityId: assignment.id, route: `/api/activities/${activityId}/approve`, method: "POST", authMode: permission.authMode, decision: permission.decision, reason: permission.reason, source: auth.source, after: { activityId, present: true, eventId, hrmWorkLogId: hrmResult.workLogId || "", cashAmount: hrmResult.money ?? 0, mcpPoints: hrmResult.mcpPoints ?? 0 } }]);
    }

    if (confirmed.rewardEmailStatus === "SENT") return NextResponse.json({ assignment: confirmed, hrm: hrmResult, idempotent: true });
    const mail = await sendActivityRewardEmail({ teacher: { id: assignment.teacherId, name: user.name, email: user.email }, activity: { id: activity.id, title: activity.title, date: activity.date }, roleLabel: type.code === "INTERNAL_SHARING" ? assignment.roleCode === "LEAD" ? "Người chủ trì / diễn giả" : "Người tham dự" : "Người thực hiện", money: confirmed.cashAmount ?? 0, mcpPoints: confirmed.mcpPoints ?? 0 }).catch((error: unknown) => ({ sent: false, reason: error instanceof Error ? error.message : "Không gửi được email." }));
    const mailPatch = { rewardEmailStatus: mail.sent ? "SENT" : "FAILED", rewardEmailSentAt: mail.sent ? new Date().toISOString() : "", rewardEmailError: mail.sent ? "" : mail.reason || "Không gửi được email.", updatedAt: new Date().toISOString() };
    await updateSheetRowById("ActivityAssignments", assignment.id, mailPatch);
    return NextResponse.json({ assignment: { ...confirmed, ...mailPatch }, hrm: hrmResult, email: { sent: mail.sent, reason: mail.sent ? undefined : mail.reason } });
  } catch (error) {
    return apiError(error, requestId, { route: "/api/activities/[id]/approve", method: "POST" });
  }
}
