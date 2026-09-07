import type { Role, TeacherAvailability, TeacherAvailabilityScope, TimeSlot } from "@/lib/types";

export const teacherAvailabilityScopeLabels: Record<TeacherAvailabilityScope, string> = {
  all_day: "Cả ngày",
  morning: "Buổi sáng",
  afternoon: "Buổi chiều",
  time_slots: "Khung giờ cụ thể",
};

export const TEACHER_AVAILABILITY_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function teacherAvailabilityLockDeadline(
  entries: Array<Pick<TeacherAvailability, "createdAt">>,
) {
  if (entries.length === 0) return null;
  const timestamps = entries.map((entry) => Date.parse(entry.createdAt));
  if (timestamps.some((timestamp) => !Number.isFinite(timestamp))) return null;
  return Math.min(...timestamps) + TEACHER_AVAILABILITY_EDIT_WINDOW_MS;
}

export function isTeacherAvailabilityLocked(
  entries: Array<Pick<TeacherAvailability, "createdAt">>,
  now = Date.now(),
) {
  if (entries.length === 0) return false;
  const deadline = teacherAvailabilityLockDeadline(entries);
  return deadline === null || now >= deadline;
}

export type TeacherAvailabilityDraft = {
  scope: TeacherAvailabilityScope;
  timeSlotIds: string[];
};

export function buildTeacherAvailabilityEntries(drafts: Record<string, TeacherAvailabilityDraft>) {
  return Object.keys(drafts).sort().map((date) => ({
    date,
    scope: drafts[date].scope,
    timeSlotIds: drafts[date].scope === "time_slots" ? drafts[date].timeSlotIds : [],
  }));
}

export function canRegisterTeacherAvailability(role: Role, teacherId: string) {
  return (role === "teacher" || role === "assistant") && Boolean(teacherId.trim());
}

export function availabilityTimeRangeKey(slot: Pick<TimeSlot, "start" | "end">) {
  return `time:${slot.start}-${slot.end}`;
}

export function uniqueAvailabilityTimeRanges(slots: TimeSlot[]) {
  const ranges = new Map<string, Pick<TimeSlot, "id" | "label" | "start" | "end">>();
  for (const slot of slots) {
    const id = availabilityTimeRangeKey(slot);
    if (!ranges.has(id)) {
      ranges.set(id, { id, label: `${slot.start}-${slot.end}`, start: slot.start, end: slot.end });
    }
  }
  return Array.from(ranges.values()).sort((left, right) =>
    left.start.localeCompare(right.start) || left.end.localeCompare(right.end),
  );
}

export function isMorningTimeSlot(slot: Pick<TimeSlot, "start">) {
  return timeToMinutes(slot.start) < 12 * 60;
}

export function availabilityMatchesTimeSlot(
  availability: Pick<TeacherAvailability, "scope" | "timeSlotId" | "status">,
  slot: Pick<TimeSlot, "id" | "start" | "end">,
) {
  if (availability.status !== "available") {
    return false;
  }
  if (availability.scope === "all_day") {
    return true;
  }
  if (availability.scope === "morning") {
    return isMorningTimeSlot(slot);
  }
  if (availability.scope === "afternoon") {
    return !isMorningTimeSlot(slot);
  }
  return availability.scope === "time_slots" && (
    availability.timeSlotId === slot.id || availability.timeSlotId === availabilityTimeRangeKey(slot)
  );
}

export function isTeacherAvailableForSlot(
  availabilities: Array<Pick<TeacherAvailability, "teacherId" | "date" | "scope" | "timeSlotId" | "status">>,
  teacherId: string,
  date: string,
  slot: Pick<TimeSlot, "id" | "start" | "end"> | undefined,
) {
  if (!teacherId || !date || !slot) {
    return false;
  }
  return availabilities.some(
    (availability) =>
      availability.teacherId === teacherId &&
      availability.date === date &&
      availabilityMatchesTimeSlot(availability, slot),
  );
}

export function isTeacherAvailableOnDate(
  availabilities: Array<Pick<TeacherAvailability, "teacherId" | "date" | "status">>,
  teacherId: string,
  date: string,
) {
  if (!teacherId || !date) return false;
  return availabilities.some(
    (availability) =>
      availability.teacherId === teacherId &&
      availability.date === date &&
      availability.status === "available",
  );
}

function timeToMinutes(value: string) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.POSITIVE_INFINITY;
  }
  return hours * 60 + minutes;
}
