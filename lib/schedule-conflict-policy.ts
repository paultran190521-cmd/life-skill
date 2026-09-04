import type { TeachingEnvironment } from "@/lib/types";

export type TeacherTimeSlot = {
  schoolId: string;
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

function normalizeEnvironment(value: TeacherTimeSlot["teachingEnvironment"]): TeachingEnvironment {
  const normalized = String(value || "").trim() as TeachingEnvironment;
  const allowed: TeachingEnvironment[] = ["in_class", "outdoor", "gym", "schoolyard_report", "hall"];
  return allowed.includes(normalized) ? normalized : "in_class";
}
