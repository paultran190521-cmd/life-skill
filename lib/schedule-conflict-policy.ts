import type { TeachingEnvironment } from "@/lib/types";

export type TeacherTimeSlot = {
  schoolId: string;
  teachingEnvironment?: TeachingEnvironment | string;
};

export type GroupClassTimeSlot = {
  groupId?: string;
  teachingEnvironment?: TeachingEnvironment | string;
};

/**
 * A teacher can run simultaneous activities only at the same school and only
 * when every overlapping activity is outside the classroom.
 */
export function hasTeacherTimeConflict(existingSlots: TeacherTimeSlot[], candidate: TeacherTimeSlot) {
  const candidateEnvironment = normalizeEnvironment(candidate.teachingEnvironment);
  return existingSlots.some(
    (existing) =>
      existing.schoolId !== candidate.schoolId ||
      normalizeEnvironment(existing.teachingEnvironment) === "in_class" ||
      candidateEnvironment === "in_class",
  );
}

/**
 * Multiple teacher rows belonging to one non-classroom activity represent the
 * same assignment. They may therefore repeat the participant classes without
 * being treated as separate class bookings.
 */
export function canShareClassTimeSlot(existing: GroupClassTimeSlot, candidate: GroupClassTimeSlot) {
  const existingGroupId = String(existing.groupId || "").trim();
  const candidateGroupId = String(candidate.groupId || "").trim();
  return Boolean(existingGroupId)
    && existingGroupId === candidateGroupId
    && normalizeEnvironment(existing.teachingEnvironment) !== "in_class"
    && normalizeEnvironment(candidate.teachingEnvironment) !== "in_class";
}

function normalizeEnvironment(value: TeacherTimeSlot["teachingEnvironment"]): TeachingEnvironment {
  const normalized = String(value || "").trim() as TeachingEnvironment;
  const allowed: TeachingEnvironment[] = ["in_class", "outdoor", "gym", "schoolyard_report", "hall"];
  return allowed.includes(normalized) ? normalized : "in_class";
}
