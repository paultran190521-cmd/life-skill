import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLogs } from "@/lib/audit";
import { attendanceGroupKey } from "@/lib/attendance-grouping";
import { appendSheetRows, readSheetRowsBatch, updateSheetRowsById } from "@/lib/google-sheets";
import { evaluatePermission, requireSessionUser } from "@/lib/route-auth";

const attendanceEarlyMinutes = 30;
const attendanceLateAfterEndMinutes = 90;

export async function POST(request: Request) {
  const requestId = createRequestId("attendance");
  try {
    const auth = await requireSessionUser(request);
    const body = await request.json();
    const scheduleId = String(body.scheduleId || "").trim();
    const now = new Date().toISOString();
    const checkedInAt = body.checkedInAt || now;
    const rows = await readSheetRowsBatch(["Schedules", "Attendance", "TimeSlots"] as const);
    const schedule = rows.Schedules.find((item) => item.id === scheduleId);

    if (!schedule) {
      return apiFailure(404, "Không tìm thấy lịch.", undefined, requestId);
    }

    const participantId = auth.user.role === "admin"
      ? String(schedule.teacherId || "").trim()
      : String(auth.user.teacherId || "").trim();
    const participantRole = schedule.teacherId === participantId
      ? "teacher"
      : parseIds(schedule.assistantIds).includes(participantId)
        ? "assistant"
        : "teacher";
    const permission = evaluatePermission({
      allowed: Boolean(participantId) && (
        auth.user.role === "admin"
        || participantId === schedule.teacherId
        || parseIds(schedule.assistantIds).includes(participantId)
      ),
      reason: "participant_must_be_assigned_to_schedule_attendance",
    });
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] attendance.create ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền điểm danh tiết này.", undefined, requestId);
    }

    if (schedule.status === "cancelled") {
      return apiFailure(400, "Không thể điểm danh lịch đã hủy.", undefined, requestId);
    }

    const anchorGroupKey = attendanceGroupKey({ ...schedule, teacherId: participantId }, rows.TimeSlots);
    if (!anchorGroupKey) {
      return apiFailure(400, "Lịch thiếu khung giờ hợp lệ để xác định buổi điểm danh.", undefined, requestId);
    }
    const groupSchedules = rows.Schedules.filter((item) =>
      item.status !== "cancelled"
      && isParticipantAssigned(item, participantId, participantRole)
      && attendanceGroupKey({ ...item, teacherId: participantId }, rows.TimeSlots) === anchorGroupKey,
    );
    const existingAttendanceKeys = new Set(rows.Attendance.map((item) => `${item.scheduleId}|${item.teacherId}`));
    const targetSchedules = groupSchedules.filter((item) => !existingAttendanceKeys.has(`${item.id}|${participantId}`));
    if (targetSchedules.length === 0) {
      return apiFailure(409, "Buổi dạy này đã được điểm danh.", undefined, requestId);
    }

    const groupSlots = groupSchedules
      .map((item) => rows.TimeSlots.find((slot) => slot.id === item.timeSlotId))
      .filter((slot): slot is Record<string, string> => Boolean(slot));
    if (groupSlots.length !== groupSchedules.length) {
      return apiFailure(400, "Một lịch trong buổi dạy thiếu khung giờ hợp lệ.", undefined, requestId);
    }
    const groupStart = groupSlots.map((slot) => slot.start).sort()[0];
    const groupEnd = groupSlots.map((slot) => slot.end).sort().at(-1);
    const timeValidation = validateAttendanceTime(schedule.date, groupStart, groupEnd, checkedInAt);
    const timeError = timeValidation.error;
    if (timeError) {
      return apiFailure(400, timeError, undefined, requestId);
    }

    const attendance = targetSchedules.map((item) => ({
      id: createId("att"),
      scheduleId: item.id,
      teacherId: participantId,
      checkedInAt,
      note: body.note || timeValidation.note,
      createdAt: now,
      updatedAt: now,
    }));
    const scheduleUpdates = participantRole === "teacher"
      ? targetSchedules.map((item) => ({ id: item.id, patch: { status: "attended", updatedAt: now } }))
      : [];

    await appendSheetRows("Attendance", attendance);
    await updateSheetRowsById("Schedules", scheduleUpdates);
    await appendAuditLogs(targetSchedules.map((item) => ({
      requestId,
      actor: auth.user,
      action: participantRole === "assistant" ? "schedule.assistant_attend" : "schedule.attend",
      entityType: "Schedule",
      entityId: item.id,
      route: "/api/attendance",
      method: "POST",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      before: { status: item.status, participantId, participantRole },
      after: { status: participantRole === "teacher" ? "attended" : item.status, participantId, participantRole, checkedInAt, attendanceGroupKey: anchorGroupKey },
    })));

    return NextResponse.json({
      attendance,
      schedules: participantRole === "teacher"
        ? targetSchedules.map((item) => ({ id: item.id, status: "attended", updatedAt: now }))
        : [],
      group: { key: anchorGroupKey, scheduleCount: targetSchedules.length },
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}

function validateAttendanceTime(date: string | undefined, start: string | undefined, end: string | undefined, value: string) {
  if (!date || !start || !end) {
    return { error: "Lịch thiếu ngày dạy hoặc khung giờ.", note: "" };
  }

  const checkedInAt = new Date(value);
  const startsAt = parseScheduleDateTime(date, start);
  const endsAt = parseScheduleDateTime(date, end);
  const windowStart = new Date(startsAt.getTime() - attendanceEarlyMinutes * 60_000);
  const windowEnd = new Date(endsAt.getTime() + attendanceLateAfterEndMinutes * 60_000);

  if (Number.isNaN(checkedInAt.getTime())) {
    return { error: "Thời gian điểm danh không hợp lệ.", note: "" };
  }

  if (checkedInAt < windowStart) {
    return { error: `Chỉ được điểm danh sớm tối đa ${attendanceEarlyMinutes} phút trước giờ bắt đầu.`, note: "" };
  }

  if (checkedInAt > windowEnd) {
    return { error: "", note: `late_after_deadline_${attendanceLateAfterEndMinutes}_minutes` };
  }

  return { error: "", note: "" };
}

function parseScheduleDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00+07:00`);
}

function parseIds(value: unknown) {
  return String(value || "").split(",").map((id) => id.trim()).filter(Boolean);
}

function isParticipantAssigned(schedule: Record<string, string>, participantId: string, role: "teacher" | "assistant") {
  return role === "teacher"
    ? schedule.teacherId === participantId
    : parseIds(schedule.assistantIds).includes(participantId);
}
