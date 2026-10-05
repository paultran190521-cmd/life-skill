import { availabilityMatchesTimeSlot, teacherAvailabilityRegistrationKey } from "@/lib/teacher-availability";
import type { Attendance, Schedule, Teacher, TeacherAvailability, TimeSlot } from "@/lib/types";

const activeSchedule = (schedule: Schedule) => schedule.status !== "draft" && schedule.status !== "cancelled";

function periodCount(schedule: Schedule) {
  return new Set(String(schedule.lessonPeriods || "lesson1").split(",")
    .map((period) => period.trim())
    .filter((period) => period === "lesson1" || period === "lesson2")).size || 1;
}

export function teacherWorkloadRows(
  teachers: Teacher[],
  schedules: Schedule[],
  attendance: Attendance[],
  availability: TeacherAvailability[],
) {
  const attended = new Set(attendance.map((row) => `${row.scheduleId}\u0000${row.teacherId}`));
  const totals = new Map(teachers.map((teacher) => [teacher.id, {
    teacherId: teacher.id,
    name: teacher.name,
    assigned: 0,
    taught: 0,
    registeredDays: 0,
  }]));
  for (const schedule of schedules) {
    if (!activeSchedule(schedule)) continue;
    const row = totals.get(schedule.teacherId);
    if (!row) continue;
    const periods = periodCount(schedule);
    row.assigned += periods;
    if (attended.has(`${schedule.id}\u0000${schedule.teacherId}`)) row.taught += periods;
  }
  const registeredDates = new Set<string>();
  for (const entry of availability) {
    if (entry.status !== "available" || !totals.has(entry.teacherId)) continue;
    registeredDates.add(`${entry.teacherId}\u0000${entry.date}`);
  }
  for (const key of registeredDates) totals.get(key.split("\u0000")[0])!.registeredDays += 1;
  return [...totals.values()].sort((left, right) =>
    right.taught - left.taught || right.assigned - left.assigned || left.name.localeCompare(right.name, "vi"),
  );
}

export function unassignedAvailabilityWarnings(
  availability: TeacherAvailability[],
  schedules: Schedule[],
  slots: TimeSlot[],
  today: string,
  noticeDays = 4,
) {
  const until = new Date(`${today}T00:00:00Z`);
  until.setUTCDate(until.getUTCDate() + noticeDays);
  const lastDate = until.toISOString().slice(0, 10);
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]));
  const scheduledByTeacherDate = new Map<string, Schedule[]>();
  for (const schedule of schedules) {
    if (!activeSchedule(schedule) || schedule.date < today || schedule.date > lastDate) continue;
    for (const teacherId of [schedule.teacherId, ...String(schedule.assistantIds || "").split(",").map((id) => id.trim()).filter(Boolean)]) {
      const key = `${teacherId}\u0000${schedule.date}`;
      const rows = scheduledByTeacherDate.get(key) ?? [];
      rows.push(schedule);
      scheduledByTeacherDate.set(key, rows);
    }
  }
  const groups = new Map<string, { teacherId: string; date: string; entries: TeacherAvailability[] }>();
  for (const entry of availability) {
    if (entry.status !== "available" || entry.date < today || entry.date > lastDate) continue;
    const assignments = scheduledByTeacherDate.get(`${entry.teacherId}\u0000${entry.date}`) ?? [];
    const assigned = assignments.some((schedule) => {
      const slot = slotsById.get(schedule.timeSlotId);
      return slot ? availabilityMatchesTimeSlot(entry, slot)
        : entry.scope === "all_day" || (entry.scope === "time_slots" && entry.timeSlotId === schedule.timeSlotId);
    });
    if (assigned) continue;
    const key = `${entry.teacherId}\u0000${entry.date}\u0000${teacherAvailabilityRegistrationKey(entry)}`;
    const group = groups.get(key) ?? { teacherId: entry.teacherId, date: entry.date, entries: [] };
    group.entries.push(entry);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) => left.date.localeCompare(right.date) || left.teacherId.localeCompare(right.teacherId));
}
