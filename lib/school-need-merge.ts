import { getTimeSlotDurationMinutes, isTimeSlotAllowedForSchool } from "@/lib/time-slots";
import type { SchoolTeachingNeed, TimeSlot } from "@/lib/types";

function minuteOf(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

/** A UI merge changes the assignment frame, not the two underlying periods. */
export function findConfiguredSchoolNeedMergeSlot(
  first: Pick<SchoolTeachingNeed, "date" | "schoolId" | "classId" | "teachingEnvironment" | "start" | "end">,
  second: Pick<SchoolTeachingNeed, "date" | "schoolId" | "classId" | "teachingEnvironment" | "start" | "end">,
  slots: TimeSlot[],
  schoolName: string,
) {
  if (first.date !== second.date || first.schoolId !== second.schoolId || first.classId !== second.classId || first.teachingEnvironment !== second.teachingEnvironment) return null;
  const gap = minuteOf(second.start) - minuteOf(first.end);
  if (gap < 0 || gap > 30 || first.start >= second.start) return null;
  return slots.find((slot) => slot.active !== false && slot.start === first.start &&
    minuteOf(slot.end) >= minuteOf(second.end) && minuteOf(slot.end) - minuteOf(second.end) <= 15 &&
    [90, 95].includes(getTimeSlotDurationMinutes(slot.start, slot.end)) && isTimeSlotAllowedForSchool(slot, schoolName)) || null;
}
