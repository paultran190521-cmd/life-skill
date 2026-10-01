import type { SchoolTeachingNeed } from "@/lib/types";

type AssignmentDraft = {
  schoolNeedIds?: string[];
  teacherIds: string[];
  lessonId: string;
  lessonPeriods: string[];
  timeSlotId: string;
};

/** Count source periods, so a merged teaching card still represents two school periods. */
export function getSchoolAssignmentProgress(needs: SchoolTeachingNeed[], drafts: AssignmentDraft[]) {
  const activeNeeds = needs.filter((need) => need.status !== "CANCELLED");
  const activeNeedIds = new Set(activeNeeds.map((need) => need.id));
  const assignedIds = new Set(activeNeeds.filter((need) => need.status === "ASSIGNED" && need.scheduleId).map((need) => need.id));
  const readyDraftIds = new Set(drafts
    .filter((item) => item.teacherIds.length > 0 && item.lessonId && item.lessonPeriods.length > 0 && item.timeSlotId)
    .flatMap((item) => item.schoolNeedIds || [])
    .filter((id) => activeNeedIds.has(id)));
  const coveredIds = new Set([...assignedIds, ...readyDraftIds]);
  const classIds = new Set(activeNeeds.map((need) => need.classId));
  const completedClassCount = [...classIds].filter((classId) => activeNeeds.filter((need) => need.classId === classId).every((need) => coveredIds.has(need.id))).length;
  return {
    totalNeedCount: activeNeeds.length,
    coveredNeedCount: coveredIds.size,
    remainingNeedCount: activeNeeds.length - coveredIds.size,
    assignedNeedCount: assignedIds.size,
    readyDraftNeedCount: [...readyDraftIds].filter((id) => !assignedIds.has(id)).length,
    totalClassCount: classIds.size,
    completedClassCount,
  };
}

export function isSchoolNeedEditHighlighted(need: Pick<SchoolTeachingNeed, "date" | "end" | "lastEditedAt">, nowMs: number) {
  if (!need.lastEditedAt || !/^\d{4}-\d{2}-\d{2}$/.test(need.date) || !/^\d{2}:\d{2}$/.test(need.end)) return false;
  const finishMs = Date.parse(`${need.date}T${need.end}:00+07:00`);
  return Number.isFinite(finishMs) && nowMs < finishMs;
}

export function schoolNeedEditLabel(need: Pick<SchoolTeachingNeed, "lastEditedAt" | "lastEditedBy">) {
  if (!need.lastEditedAt) return "";
  const edited = new Date(need.lastEditedAt);
  if (Number.isNaN(edited.getTime())) return "";
  const date = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "2-digit" }).format(edited);
  const time = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(edited);
  return `${date} - ${time} | ${need.lastEditedBy || "Quản trị viên"}`;
}
