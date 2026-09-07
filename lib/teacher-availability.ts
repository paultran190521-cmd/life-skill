import type { TeacherAvailability, TeacherAvailabilityScope, TimeSlot } from "@/lib/types";

export const teacherAvailabilityScopeLabels: Record<TeacherAvailabilityScope, string> = {
  all_day: "Cả ngày",
  morning: "Buổi sáng",
  afternoon: "Buổi chiều",
  time_slots: "Khung giờ cụ thể",
};

export function isMorningTimeSlot(slot: Pick<TimeSlot, "start">) {
  return timeToMinutes(slot.start) < 12 * 60;
}

export function availabilityMatchesTimeSlot(
  availability: Pick<TeacherAvailability, "scope" | "timeSlotId" | "status">,
  slot: Pick<TimeSlot, "id" | "start">,
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
  return availability.scope === "time_slots" && availability.timeSlotId === slot.id;
}

export function isTeacherAvailableForSlot(
  availabilities: Array<Pick<TeacherAvailability, "teacherId" | "date" | "scope" | "timeSlotId" | "status">>,
  teacherId: string,
  date: string,
  slot: Pick<TimeSlot, "id" | "start"> | undefined,
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

function timeToMinutes(value: string) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.POSITIVE_INFINITY;
  }
  return hours * 60 + minutes;
}
