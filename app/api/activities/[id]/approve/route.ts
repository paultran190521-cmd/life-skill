import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLogs } from "@/lib/audit";
import { activityAssignmentHeaders, activityOccurrenceHeaders, ensureActivityCatalog, ensureSheetHeaders, readSheetRowsBatch, updateSheetRowById } from "@/lib/google-sheets";
import { submitActivityCompletionToHrm } from "@/lib/hrm-integration";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId("activity-approve");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_activity_approve");
    if (!permission.allowed) return apiFailure(403, "Chỉ quản trị viên được duyệt hoạt động.", undefined, requestId);
    const { id: activityId } = await params;
    const body = await request.json() as Record<string, unknown>;
    const assignmentId = String(body.assignmentId || "").trim();
    const approvalNote = String(body.approvalNote || "").trim();
    await Promise.all([ensureSheetHeaders("ActivityOccurrences", activityOccurrenceHeaders), ensureSheetHeaders("ActivityAssignments", activityAssignmentHeaders)]);
    const [types, rows] = await Promise.all([
      ensureActivityCatalog(),
      readSheetRowsBatch(["ActivityOccurrences", "ActivityAssignments", "Users"] as const),
    ]);
    const activity = rows.ActivityOccurrences.find((item) => item.id === activityId);
    const assignment = rows.ActivityAssignments.find((item) => item.id === assignmentId && item.activityId === activityId);
    if (!activity || !assignment) return apiFailure(404, "Không tìm thấy hoạt động hoặc người được giao.", undefined, requestId);
    if (String(assignment.status || "") !== "COMPLETED") return apiFailure(409, "Người tham gia chưa xác nhận hoàn thành.", undefined, requestId);
    const type = types.find((item) => item.id === activity.activityTypeId);
    const user = rows.Users.find((item) => item.teacherId === assignment.teacherId);
    if (!type || !user?.email) return apiFailure(409, "Thiếu cấu hình loại hoạt động hoặc email nhân sự.", undefined, requestId);
    const idempotencyKey = `METTASOUL:ACTIVITY:${activity.id}:${assignment.id}`;
    const eventId = `MTS_ACT_${createId("evt")}`;
    const pendingAt = new Date().toISOString();
    await updateSheetRowById("ActivityAssignments", assignment.id, { ...assignment, integrationStatus: "PENDING", integrationEventId: eventId, updatedAt: pendingAt });
    let result;
    try {
      result = await submitActivityCompletionToHrm({ source: "METTASOUL", action: "SUBMIT_ACTIVITY_COMPLETION", eventId, idempotencyKey, activityId: activity.id, assignmentId: assignment.id, activityTypeCode: type.code, activityTitle: activity.title, userEmail: user.email.trim().toLowerCase(), roleCode: assignment.roleCode, unit: type.unit, workDate: activity.date, evidenceUrl: assignment.evidenceUrl || undefined });
    } catch (error) {
      const message = error instanceof Error ? error.message : "HRM từ chối duyệt hoạt động.";
      await updateSheetRowById("ActivityAssignments", assignment.id, { integrationStatus: "FAILED", updatedAt: new Date().toISOString(), approvalNote: message });
      return apiFailure(409, message, undefined, requestId);
    }
    const now = new Date().toISOString();
    const updated = { ...assignment, status: "APPROVED", approvedAt: now, approvedBy: auth.user.id, approvalNote, integrationStatus: "CONFIRMED", integrationEventId: eventId, hrmWorkLogId: result.workLogId || "", mcpPoints: result.mcpPoints ?? "", updatedAt: now };
    await updateSheetRowById("ActivityAssignments", assignment.id, updated);
    await updateSheetRowById("ActivityOccurrences", activity.id, { ...activity, status: "APPROVED", updatedAt: now });
    await appendAuditLogs([{ requestId, actor: auth.user, action: "activity.approve", entityType: "ActivityAssignment", entityId: assignment.id, route: `/api/activities/${activityId}/approve`, method: "POST", authMode: permission.authMode, decision: permission.decision, reason: permission.reason, source: auth.source, after: { activityId, eventId, hrmWorkLogId: result.workLogId || "", mcpPoints: result.mcpPoints ?? 0 } }]);
    return NextResponse.json({ assignment: updated, hrm: result });
  } catch (error) {
    return apiError(error, requestId, { route: "/api/activities/[id]/approve", method: "POST" });
  }
}
