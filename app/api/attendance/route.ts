import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { appendSheetRow, readSheetRowById, readSheetRows, updateSheetRowById } from "@/lib/google-sheets";
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
    const schedule = await readSheetRowById("Schedules", scheduleId);

    if (!schedule) {
      return apiFailure(404, "Không tìm thấy lịch.", undefined, requestId);
    }

    const permission = evaluatePermission({
      allowed: auth.user.role === "admin" || auth.user.teacherId === schedule.teacherId,
      reason: "teacher_must_own_schedule_attendance",
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

    const existingAttendance = await readSheetRows("Attendance");
    if (existingAttendance.some((item) => item.scheduleId === scheduleId)) {
      return apiFailure(409, "Tiết này đã được điểm danh.", undefined, requestId);
    }

    const slots = await readSheetRows("TimeSlots");
    const slot = slots.find((item) => item.id === schedule.timeSlotId);
    const timeValidation = validateAttendanceTime(schedule.date, slot?.start, slot?.end, checkedInAt);
    const timeError = timeValidation.error;
    if (timeError) {
      return apiFailure(400, timeError, undefined, requestId);
    }

    const attendance = {
      id: body.id || createId("att"),
      scheduleId,
      teacherId: schedule.teacherId,
      checkedInAt,
      note: body.note || timeValidation.note,
      createdAt: now,
      updatedAt: now,
    };

    await appendSheetRow("Attendance", attendance);
    await updateSheetRowById("Schedules", scheduleId, { status: "attended", updatedAt: now });
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "schedule.attend",
      entityType: "Schedule",
      entityId: scheduleId,
      route: "/api/attendance",
      method: "POST",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      before: { status: schedule.status, teacherId: schedule.teacherId },
      after: { status: "attended", teacherId: schedule.teacherId, checkedInAt },
    });

    return NextResponse.json({ attendance, schedule: { id: scheduleId, status: "attended", updatedAt: now } });
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
