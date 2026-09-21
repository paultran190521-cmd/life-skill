import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLogs } from "@/lib/audit";
import { readSheetRowsBatch } from "@/lib/google-sheets";
import { sendAttendanceReminderEmail } from "@/lib/email";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";

export async function POST(request: Request) {
  const requestId = createRequestId("attendance-reminder");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_attendance_reminder");
    if (!permission.allowed) return apiFailure(403, "Chỉ quản trị viên được gửi nhắc chấm công.", undefined, requestId);

    const body = (await request.json()) as { teacherIds?: unknown };
    const requestedTeacherIds = Array.from(new Set((Array.isArray(body.teacherIds) ? body.teacherIds : []).map((value) => String(value || "").trim()).filter(Boolean)));
    if (requestedTeacherIds.length === 0) return apiFailure(400, "Chọn ít nhất một giáo viên để gửi nhắc.", undefined, requestId);

    const rows = await readSheetRowsBatch(["Schedules", "Attendance", "Teachers", "Schools", "Classes", "Lessons", "TimeSlots"] as const);
    const attendanceKeys = new Set(rows.Attendance.map((row) => `${String(row.scheduleId || "").trim()}|${String(row.teacherId || "").trim()}`));
    const now = Date.now();
    const results = await Promise.all(requestedTeacherIds.map(async (teacherId) => {
      const teacher = rows.Teachers.find((row) => String(row.id || "").trim() === teacherId);
      const schedules = rows.Schedules.filter((schedule) =>
        String(schedule.teacherId || "").trim() === teacherId
        && !["cancelled", "draft"].includes(String(schedule.status || "").trim())
        && hasEnded(schedule, rows.TimeSlots, now)
        && !attendanceKeys.has(`${String(schedule.id || "").trim()}|${teacherId}`),
      );
      if (!teacher || schedules.length === 0) return { teacherId, schedules: [], sent: false, skipped: true, reason: !teacher ? "Không tìm thấy giáo viên." : "Không có tiết đã kết thúc cần nhắc." };
      const result = await sendAttendanceReminderEmail({
        teacher,
        schedules: schedules as never[],
        rows: schedules.map((schedule) => ({
          schedule: schedule as never,
          school: rows.Schools.find((school) => String(school.id || "").trim() === String(schedule.schoolId || "").trim()),
          classRoom: rows.Classes.find((classRoom) => String(classRoom.id || "").trim() === String(schedule.classId || "").trim()),
          participantClassNames: String(schedule.participantClassIds || schedule.classId || "").split(",").map((classId) => rows.Classes.find((classRoom) => String(classRoom.id || "").trim() === classId.trim())?.name).filter(Boolean) as string[],
          lesson: rows.Lessons.find((lesson) => String(lesson.id || "").trim() === String(schedule.lessonId || "").trim()),
          slot: rows.TimeSlots.find((slot) => String(slot.id || "").trim() === String(schedule.timeSlotId || "").trim()),
        })),
      });
      return { teacherId, schedules, ...result, skipped: false };
    }));
    const sent = results.filter((result) => result.sent);
    await appendAuditLogs(sent.map((result) => ({
      requestId,
      actor: auth.user,
      action: "attendance.reminder_email",
      entityType: "Teacher",
      entityId: result.teacherId,
      route: "/api/attendance/reminders",
      method: "POST",
      authMode: permission.authMode,
      decision: permission.decision,
      source: auth.source,
      after: { scheduleIds: (result.schedules || []).map((schedule) => String(schedule.id || "")), channel: "email" },
    })));
    return NextResponse.json({ sentCount: sent.length, skippedCount: results.filter((result) => result.skipped).length, failedCount: results.filter((result) => !result.sent && !result.skipped).length });
  } catch (error) {
    return apiError(error, requestId);
  }
}

function hasEnded(schedule: Record<string, string>, slots: Array<Record<string, string>>, now: number) {
  const slot = slots.find((item) => String(item.id || "").trim() === String(schedule.timeSlotId || "").trim());
  const date = String(schedule.date || "").trim();
  const end = String(slot?.end || "").trim();
  const endsAt = new Date(`${date}T${end}:00+07:00`).getTime();
  return Boolean(date && end) && !Number.isNaN(endsAt) && endsAt <= now;
}
