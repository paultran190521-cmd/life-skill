import type { ScheduleParticipantScope, TeachingEnvironment } from "@/lib/types";

type ParticipantClass = { id: string; grade?: string };

type ParticipantSelectionInput = {
  teachingEnvironment: TeachingEnvironment;
  participantScope?: unknown;
  participantGrade?: unknown;
  requestedClassIds: string[];
};

export function normalizeScheduleParticipantScope(value: unknown): ScheduleParticipantScope {
  return value === "whole_grade" || value === "whole_school" ? value : "selected_classes";
}

/** Mở rộng preset phạm vi thành snapshot classIds để kiểm tra xung đột ổn định. */
export function resolveScheduleParticipantSelection(
  input: ParticipantSelectionInput,
  availableClasses: ParticipantClass[],
) {
  const participantScope = input.teachingEnvironment === "in_class"
    ? "selected_classes"
    : normalizeScheduleParticipantScope(input.participantScope);
  const availableById = new Map(availableClasses.map((classRoom) => [classRoom.id, classRoom]));
  const requestedClasses = Array.from(new Set(input.requestedClassIds))
    .map((id) => availableById.get(id))
    .filter((classRoom): classRoom is ParticipantClass => Boolean(classRoom));
  const fallbackGrade = requestedClasses[0]?.grade || "";
  const participantGrade = participantScope === "whole_grade"
    ? String(input.participantGrade || fallbackGrade).trim()
    : "";
  const classIds = participantScope === "whole_school"
    ? availableClasses.map((classRoom) => classRoom.id)
    : participantScope === "whole_grade"
      ? availableClasses
          .filter((classRoom) => normalizeComparableText(classRoom.grade) === normalizeComparableText(participantGrade))
          .map((classRoom) => classRoom.id)
      : requestedClasses.map((classRoom) => classRoom.id).slice(0, input.teachingEnvironment === "in_class" ? 1 : undefined);

  return { participantScope, participantGrade, classIds: Array.from(new Set(classIds)) };
}

function normalizeComparableText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
