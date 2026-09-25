import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLogs } from "@/lib/audit";
import { activityAssignmentHeaders, activityOccurrenceHeaders, ensureActivityCatalog, ensureSheetHeaders, readSheetRowsBatch, updateSheetRowById } from "@/lib/google-sheets";
import { requireSessionUser } from "@/lib/route-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId("activity-complete");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    const { id: activityId } = await params;
    const teacherId = String(auth.user.teacherId || "").trim();
    const body = await request.json() as Record<string, unknown>;
    const evidenceUrl = String(body.evidenceUrl || "").trim();
    await Promise.all([ensureSheetHeaders("ActivityOccurrences", activityOccurrenceHeaders), ensureSheetHeaders("ActivityAssignments", activityAssignmentHeaders)]);
    const [types, rows] = await Promise.all([
      ensureActivityCatalog(),
      readSheetRowsBatch(["ActivityOccurrences", "ActivityAssignments"] as const),
    ]);
    const activity = rows.ActivityOccurrences.find((item) => item.id === activityId);
    if (!activity || String(activity.status || "") === "CANCELLED") return apiFailure(404, "Không tìm thấy hoạt động đang hiệu lực.", undefined, requestId);
    const assignment = rows.ActivityAssignments.find((item) => item.activityId === activityId && item.teacherId === teacherId);
    if (!assignment) return apiFailure(403, "Bạn không được giao hoạt động này.", undefined, requestId);
    if (["COMPLETED", "APPROVED"].includes(String(assignment.status || ""))) return NextResponse.json({ assignment, idempotent: true });
    const type = types.find((item) => item.id === activity.activityTypeId);
    if (!type) return apiFailure(409, "Loại hoạt động không còn tồn tại.", undefined, requestId);
    if (evidenceUrl && !/^https:\/\//i.test(evidenceUrl)) return apiFailure(400, "Liên kết minh chứng cần bắt đầu bằng https://.", undefined, requestId);
    const now = new Date().toISOString();
    const updated = { ...assignment, status: "COMPLETED", evidenceUrl, completedAt: now, updatedAt: now };
    await updateSheetRowById("ActivityAssignments", assignment.id, updated);
    await appendAuditLogs([{ requestId, actor: auth.user, action: "activity.complete", entityType: "ActivityAssignment", entityId: assignment.id, route: `/api/activities/${activityId}/complete`, method: "POST", authMode: "enforce", decision: "allow", reason: "assigned_participant_completed_activity", source: auth.source, after: { activityId, evidenceUrl } }]);
    return NextResponse.json({ assignment: updated });
  } catch (error) {
    return apiError(error, requestId, { route: "/api/activities/[id]/complete", method: "POST" });
  }
}
