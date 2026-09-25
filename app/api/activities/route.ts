import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import {
  activityAssignmentHeaders,
  activityOccurrenceHeaders,
  appendSheetRows,
  ensureActivityCatalog,
  ensureSheetHeaders,
  readSheetRowsBatch,
} from "@/lib/google-sheets";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";
import { topicReportActivity } from "@/lib/topic-report-policy";

export async function GET(request: Request) {
  const requestId = createRequestId("activities-list");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    const [activityTypes, rows] = await Promise.all([
      ensureActivityCatalog(),
      readSheetRowsBatch(["ActivityOccurrences", "ActivityAssignments"] as const),
    ]);
    const teacherId = String(auth.user.teacherId || "").trim();
    const assignments = auth.user.role === "admin"
      ? rows.ActivityAssignments
      : rows.ActivityAssignments.filter((assignment) => String(assignment.teacherId || "").trim() === teacherId);
    const activityIds = new Set(assignments.map((assignment) => String(assignment.activityId || "").trim()));
    const occurrences = auth.user.role === "admin"
      ? rows.ActivityOccurrences
      : rows.ActivityOccurrences.filter((activity) => activityIds.has(String(activity.id || "").trim()));
    return NextResponse.json({ activityTypes, occurrences, assignments }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, requestId, { route: "/api/activities", method: "GET" });
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId("activity-create");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_activity_create");
    if (!permission.allowed) return apiFailure(403, "Chỉ quản trị viên được giao công việc.", undefined, requestId);
    const body = await request.json() as Record<string, unknown>;
    const activityTypeId = String(body.activityTypeId || "").trim();
    const title = String(body.title || "").trim();
    const date = String(body.date || "").trim();
    const participants = Array.isArray(body.participants) ? body.participants : [];
    if (!activityTypeId || !title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || participants.length === 0) {
      return apiFailure(400, "Cần chọn loại hoạt động, tên, ngày và ít nhất một người tham gia.", undefined, requestId);
    }
    const [activityTypes, rows] = await Promise.all([
      ensureActivityCatalog(),
      readSheetRowsBatch(["Teachers"] as const),
    ]);
    const activityType = activityTypes.find((item) => item.id === activityTypeId && item.active);
    if (!activityType) return apiFailure(400, "Loại hoạt động không tồn tại hoặc đang tắt.", undefined, requestId);
    // Topic-report activities are scheduled teaching. They must originate from
    // the schedule flow so attendance, roles, evidence and HRM approval stay
    // attached to the same immutable teaching period.
    if (topicReportActivity(activityType.code)) {
      return apiFailure(409, "Hoạt động Báo cáo chuyên đề chỉ được giao tại Giao lịch → Báo cáo chuyên đề.", undefined, requestId);
    }
    const activeTeacherIds = new Set(rows.Teachers.filter((teacher) => String(teacher.active || "true").toLowerCase() !== "false").map((teacher) => String(teacher.id || "").trim()));
    const normalizedParticipants = participants.map((participant) => ({
      teacherId: String((participant as Record<string, unknown>).teacherId || "").trim(),
      roleCode: String((participant as Record<string, unknown>).roleCode || "PARTICIPANT").trim().toUpperCase(),
    })).filter((participant) => participant.teacherId);
    if (normalizedParticipants.length !== participants.length || new Set(normalizedParticipants.map((participant) => participant.teacherId)).size !== normalizedParticipants.length || !normalizedParticipants.every((participant) => activeTeacherIds.has(participant.teacherId))) {
      return apiFailure(400, "Người được giao không tồn tại, đang tắt hoặc bị lặp.", undefined, requestId);
    }
    await Promise.all([
      ensureSheetHeaders("ActivityOccurrences", activityOccurrenceHeaders),
      ensureSheetHeaders("ActivityAssignments", activityAssignmentHeaders),
    ]);
    const now = new Date().toISOString();
    const activity = {
      id: createId("act"), activityTypeId, title, date,
      startTime: String(body.startTime || "").trim(), endTime: String(body.endTime || "").trim(),
      location: String(body.location || "").trim(), status: "SCHEDULED",
      note: String(body.note || "").trim(), createdBy: auth.user.id, createdAt: now, updatedAt: now,
    };
    const assignments = normalizedParticipants.map((participant) => ({
      id: createId("acta"), activityId: activity.id, teacherId: participant.teacherId, roleCode: participant.roleCode,
      status: "ASSIGNED", evidenceUrl: "", completedAt: "", approvedAt: "", approvedBy: "", approvalNote: "",
      integrationStatus: "", integrationEventId: "", hrmWorkLogId: "", mcpPoints: "", createdAt: now, updatedAt: now,
    }));
    await appendSheetRows("ActivityOccurrences", [activity]);
    await appendSheetRows("ActivityAssignments", assignments);
    return NextResponse.json({ activity, assignments }, { status: 201 });
  } catch (error) {
    return apiError(error, requestId, { route: "/api/activities", method: "POST" });
  }
}
