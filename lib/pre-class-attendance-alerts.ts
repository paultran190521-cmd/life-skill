import { createHash } from "node:crypto";
import { sendPreClassAttendanceAlertEmail } from "@/lib/email";
import { appendSheetRows, ensureSheetHeaders, readSheetRows, readSheetRowsBatch, reminderRunHeaders } from "@/lib/google-sheets";
import { selectPreClassAttendanceAlerts } from "@/lib/pre-class-attendance-policy";
import type { Schedule } from "@/lib/types";

const reminderType = "pre-class-attendance-admin";

export async function runPreClassAttendanceAlerts() {
  const coreRows = await readSheetRowsBatch(["Schedules", "Attendance", "TimeSlots"] as const);
  const schedules = coreRows.Schedules as Schedule[];
  if (selectPreClassAttendanceAlerts(schedules, coreRows.Attendance, coreRows.TimeSlots, Date.now()).length === 0) {
    return { ok: true, candidateCount: 0, sentEmailCount: 0, recordedAlertCount: 0, failedEmailCount: 0 };
  }

  await ensureSheetHeaders("ReminderRuns", reminderRunHeaders);
  const [details, attendance] = await Promise.all([
    readSheetRowsBatch(["Users", "Teachers", "Schools", "Classes", "ReminderRuns"] as const),
    readSheetRows("Attendance"),
  ]);
  const sessions = selectPreClassAttendanceAlerts(schedules, attendance, coreRows.TimeSlots, Date.now());
  if (sessions.length === 0) return { ok: true, candidateCount: 0, sentEmailCount: 0, recordedAlertCount: 0, failedEmailCount: 0 };

  const admins = Array.from(new Map(details.Users
    .filter((row) => row.role === "admin" && !["false", "0", "no"].includes(String(row.isActive || "").trim().toLowerCase()))
    .map((row) => ({ name: String(row.name || "").trim(), email: String(row.email || "").trim().toLowerCase() }))
    .filter((row) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
    .map((row) => [row.email, row] as const)).values());
  if (admins.length === 0) {
    console.error("[pre-class-attendance] No active administrator email is configured.");
    return { ok: false, candidateCount: sessions.length, sentEmailCount: 0, recordedAlertCount: 0, failedEmailCount: 1 };
  }

  const completedIds = new Set(details.ReminderRuns.map((row) => String(row.id || "").trim()));
  const scheduleById = new Map(schedules.map((schedule) => [schedule.id, schedule]));
  const teacherById = new Map(details.Teachers.map((row) => [String(row.id || "").trim(), row]));
  const schoolById = new Map(details.Schools.map((row) => [String(row.id || "").trim(), row]));
  const classById = new Map(details.Classes.map((row) => [String(row.id || "").trim(), row]));
  const results = await Promise.all(admins.map(async (admin) => {
    const pending = sessions.filter((session) => !completedIds.has(alertId(session.key, session.startsAtMs, admin.email)));
    if (pending.length === 0) return { admin, pending, sent: false, skipped: true, emailId: "" };
    try {
      const result = await sendPreClassAttendanceAlertEmail({
        admin,
        sessions: pending.map((session) => ({
          teacherName: String(teacherById.get(session.teacherId)?.name || session.teacherId),
          schoolName: String(schoolById.get(session.schoolId)?.name || session.schoolId),
          date: session.date,
          startTime: session.startTime,
          classNames: Array.from(new Set(session.scheduleIds.flatMap((id) => {
            const schedule = scheduleById.get(id);
            return String(schedule?.participantClassIds || schedule?.classId || "").split(",").map((classId) => String(classById.get(classId.trim())?.name || "").trim()).filter(Boolean);
          }))),
          scheduleIds: session.scheduleIds,
        })),
      });
      if (!result.sent) console.error(`[pre-class-attendance] Email failed for ${admin.email}: ${result.reason || "unknown"}`);
      return { admin, pending, sent: result.sent, skipped: false, emailId: "id" in result ? result.id || "" : "" };
    } catch (error) {
      console.error(`[pre-class-attendance] Email failed for ${admin.email}`, error);
      return { admin, pending, sent: false, skipped: false, emailId: "" };
    }
  }));

  const sentAt = new Date().toISOString();
  const recorded = results.filter((result) => result.sent).flatMap(({ admin, pending, emailId }) => pending.map((session) => ({
    id: alertId(session.key, session.startsAtMs, admin.email),
    reminderType,
    scheduleId: session.scheduleIds[0],
    teacherId: session.teacherId,
    reminderIndex: 1,
    emailId,
    createdAt: sentAt,
  })));
  if (recorded.length > 0) await appendSheetRows("ReminderRuns", recorded);
  const failedEmailCount = results.filter((result) => !result.sent && !result.skipped).length;
  return {
    ok: failedEmailCount === 0,
    candidateCount: sessions.length,
    sentEmailCount: results.filter((result) => result.sent).length,
    recordedAlertCount: recorded.length,
    failedEmailCount,
  };
}

function alertId(groupKey: string, startsAtMs: number, adminEmail: string) {
  return `preclass-${createHash("sha256").update(`${groupKey}|${startsAtMs}|${adminEmail}`).digest("hex").slice(0, 32)}`;
}
