import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLogs } from "@/lib/audit";
import {
  activityAssignmentHeaders,
  activityOccurrenceHeaders,
  deleteSheetRowById,
  deleteSheetRowsByIds,
  ensureActivityCatalog,
  ensureSheetHeaders,
  readSheetRowsBatch,
  updateSheetRowById,
} from "@/lib/google-sheets";
import { cancelActivityCompletionInHrm } from "@/lib/hrm-integration";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId("activity-update");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_activity_update");
    if (!permission.allowed) return apiFailure(403, "Chỉ quản trị viên được sửa hoạt động.", undefined, requestId);
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const title = String(body.title || "").trim();
    const date = String(body.date || "").trim();
    const activityTypeId = String(body.activityTypeId || "").trim();
    if (!title || !activityTypeId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return apiFailure(400, "Cần nhập loại hoạt động, tên và ngày thực hiện hợp lệ.", undefined, requestId);
    }
    await Promise.all([
      ensureSheetHeaders("ActivityOccurrences", activityOccurrenceHeaders),
      ensureSheetHeaders("ActivityAssignments", activityAssignmentHeaders),
    ]);
    const [types, rows] = await Promise.all([
      ensureActivityCatalog(),
      readSheetRowsBatch(["ActivityOccurrences", "ActivityAssignments"] as const),
    ]);
    const activity = rows.ActivityOccurrences.find((item) => item.id === id);
    if (!activity) return apiFailure(404, "Không tìm thấy hoạt động cần sửa.", undefined, requestId);
    if (!types.some((item) => item.id === activityTypeId && item.active)) {
      return apiFailure(400, "Loại hoạt động không tồn tại hoặc đang tắt.", undefined, requestId);
    }
    const assignments = rows.ActivityAssignments.filter((item) => item.activityId === id);
    const hasConfirmedReward = assignments.some((item) => item.status === "APPROVED" || item.integrationStatus === "CONFIRMED");
    const changesRewardFacts = activity.activityTypeId !== activityTypeId || activity.title !== title || activity.date !== date;
    if (hasConfirmedReward && changesRewardFacts) {
      return apiFailure(409, "Hoạt động đã ghi nhận quyền lợi tại HRM. Hãy xóa hoạt động và tạo lại nếu cần đổi loại, tên hoặc ngày.", undefined, requestId);
    }
    const now = new Date().toISOString();
    const updated = {
      ...activity,
      activityTypeId,
      title,
      date,
      startTime: String(body.startTime || "").trim(),
      endTime: String(body.endTime || "").trim(),
      location: String(body.location || "").trim(),
      note: String(body.note || "").trim(),
      updatedAt: now,
    };
    await updateSheetRowById("ActivityOccurrences", id, updated);
    await appendAuditLogs([{ requestId, actor: auth.user, action: "activity.update", entityType: "ActivityOccurrence", entityId: id, route: `/api/activities/${id}`, method: "PATCH", authMode: permission.authMode, decision: permission.decision, reason: permission.reason, source: auth.source, before: activity, after: updated }]);
    return NextResponse.json({ activity: updated });
  } catch (error) {
    return apiError(error, requestId, { route: "/api/activities/[id]", method: "PATCH" });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const requestId = createRequestId("activity-delete");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_activity_delete");
    if (!permission.allowed) return apiFailure(403, "Chỉ quản trị viên được xóa hoạt động.", undefined, requestId);
    const { id } = await params;
    await Promise.all([
      ensureSheetHeaders("ActivityOccurrences", activityOccurrenceHeaders),
      ensureSheetHeaders("ActivityAssignments", activityAssignmentHeaders),
    ]);
    const rows = await readSheetRowsBatch(["ActivityOccurrences", "ActivityAssignments"] as const);
    const activity = rows.ActivityOccurrences.find((item) => item.id === id);
    if (!activity) return NextResponse.json({ deleted: true, idempotent: true });
    const assignments = rows.ActivityAssignments.filter((item) => item.activityId === id);
    const confirmedAssignments = assignments.filter((item) => item.status === "APPROVED" || item.integrationStatus === "CONFIRMED");

    // Deliberately sequential: GAS uses a script lock, so parallel cancellation
    // would create avoidable SYSTEM_BUSY responses for multi-person activities.
    for (const assignment of confirmedAssignments) {
      const targetIdempotencyKey = `METTASOUL:ACTIVITY:${activity.id}:${assignment.id}`;
      await cancelActivityCompletionInHrm({
        source: "METTASOUL",
        action: "CANCEL_ACTIVITY_COMPLETION",
        eventId: `MTS_ACT_CANCEL_${activity.id}_${assignment.id}`,
        idempotencyKey: `CANCEL:${targetIdempotencyKey}`,
        targetIdempotencyKey,
        activityId: activity.id,
        assignmentId: assignment.id,
        workLogId: assignment.hrmWorkLogId || "",
        integrationEventId: assignment.integrationEventId || "",
      });
    }

    await deleteSheetRowsByIds("ActivityAssignments", assignments.map((item) => item.id));
    await deleteSheetRowById("ActivityOccurrences", id);
    await appendAuditLogs([{ requestId, actor: auth.user, action: "activity.delete", entityType: "ActivityOccurrence", entityId: id, route: `/api/activities/${id}`, method: "DELETE", authMode: permission.authMode, decision: permission.decision, reason: permission.reason, source: auth.source, before: { activity, assignments }, after: { deleted: true, cancelledHrmRewards: confirmedAssignments.length } }]);
    return NextResponse.json({ deleted: true, cancelledHrmRewards: confirmedAssignments.length });
  } catch (error) {
    return apiError(error, requestId, { route: "/api/activities/[id]", method: "DELETE" });
  }
}
