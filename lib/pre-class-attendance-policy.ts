import { attendanceGroupKey } from "@/lib/attendance-grouping";
import type { Schedule } from "@/lib/types";

export type PreClassAttendanceSession = {
  key: string;
  teacherId: string;
  schoolId: string;
  date: string;
  startTime: string;
  startsAtMs: number;
  scheduleIds: string[];
};

type SlotRow = { id?: string; start?: string };
type AttendanceRow = { scheduleId?: string; teacherId?: string };

const alertLeadMs = 15 * 60_000;

export function selectPreClassAttendanceAlerts(
  schedules: Schedule[],
  attendance: AttendanceRow[],
  slots: SlotRow[],
  nowMs: number,
): PreClassAttendanceSession[] {
  const slotsById = new Map(slots.map((slot) => [String(slot.id || "").trim(), String(slot.start || "").trim()]));
  const groups = new Map<string, PreClassAttendanceSession>();
  const attended = new Set(attendance.map((row) => `${String(row.scheduleId || "").trim()}|${String(row.teacherId || "").trim()}`));

  for (const schedule of schedules) {
    if (schedule.status === "draft" || schedule.status === "cancelled") continue;
    const startTime = slotsById.get(schedule.timeSlotId) || "";
    if (!/^\d{2}:[0-5]\d$/.test(startTime) || !/^\d{4}-\d{2}-\d{2}$/.test(schedule.date)) continue;
    const startsAtMs = Date.parse(`${schedule.date}T${startTime}:00+07:00`);
    if (!Number.isFinite(startsAtMs)) continue;

    const participants = new Set([
      String(schedule.teacherId || "").trim(),
      ...String(schedule.assistantIds || "").split(",").map((id) => id.trim()),
    ].filter(Boolean));
    for (const teacherId of participants) {
      const key = attendanceGroupKey({ ...schedule, teacherId }, slots);
      if (!key) continue;
      const group = groups.get(key);
      if (!group) {
        groups.set(key, { key, teacherId, schoolId: schedule.schoolId, date: schedule.date, startTime, startsAtMs, scheduleIds: [schedule.id] });
      } else {
        group.scheduleIds.push(schedule.id);
        if (startsAtMs < group.startsAtMs) {
          group.startsAtMs = startsAtMs;
          group.startTime = startTime;
        }
      }
    }
  }

  return Array.from(groups.values())
    .filter((group) =>
      nowMs >= group.startsAtMs - alertLeadMs &&
      nowMs < group.startsAtMs &&
      !group.scheduleIds.some((scheduleId) => attended.has(`${scheduleId}|${group.teacherId}`)),
    )
    .sort((a, b) => a.startsAtMs - b.startsAtMs || a.key.localeCompare(b.key));
}
