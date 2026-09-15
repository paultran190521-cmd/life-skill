import { normalizeScheduledLessonPeriods, type ScheduledLessonPeriod } from "@/lib/lessons";

type ProgressionSchedule = {
  id?: unknown;
  date?: unknown;
  schoolId?: unknown;
  classId?: unknown;
  participantClassIds?: unknown;
  lessonId?: unknown;
  lessonPeriods?: unknown;
  groupId?: unknown;
  status?: unknown;
};

export type LessonProgressionConflict = {
  candidate: ProgressionSchedule;
  existing: ProgressionSchedule;
  periods: ScheduledLessonPeriod[];
};

type AcademicYearOptions = { startMonth?: number; startDay?: number };

export function academicYearKey(dateKey: unknown, options: AcademicYearOptions = {}) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || "").trim());
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const startMonth = validInteger(options.startMonth, 1, 12, 8);
  const startDay = validInteger(options.startDay, 1, 31, 1);
  const startsThisCalendarYear = month > startMonth || (month === startMonth && day >= startDay);
  return String(startsThisCalendarYear ? year : year - 1);
}

/**
 * Chặn lặp cùng tiết/bài cho nhóm học sinh giao nhau trong cùng trường và năm học.
 * Các dòng đồng giảng chung groupId được xem là một hoạt động, không tự xung đột.
 */
export function findLessonProgressionConflicts(
  candidates: ProgressionSchedule[],
  existingSchedules: ProgressionSchedule[],
  options: AcademicYearOptions = {},
): LessonProgressionConflict[] {
  const conflicts: LessonProgressionConflict[] = [];
  const earlierCandidates: ProgressionSchedule[] = [];

  for (const candidate of candidates) {
    const candidateYear = academicYearKey(candidate.date, options);
    const candidatePeriods = normalizeScheduledLessonPeriods(candidate.lessonPeriods);
    const candidateClassIds = participantClassIds(candidate);
    const comparisons = [...existingSchedules, ...earlierCandidates];
    const existing = comparisons.find((schedule) => {
      if (String(schedule.status || "") === "cancelled") return false;
      if (String(schedule.id || "") && String(schedule.id) === String(candidate.id || "")) return false;
      if (candidate.groupId && String(schedule.groupId || "") === String(candidate.groupId)) return false;
      if (!candidateYear || academicYearKey(schedule.date, options) !== candidateYear) return false;
      if (String(schedule.schoolId || "") !== String(candidate.schoolId || "")) return false;
      if (String(schedule.lessonId || "") !== String(candidate.lessonId || "")) return false;
      if (!hasIntersection(candidateClassIds, participantClassIds(schedule))) return false;
      return hasIntersection(candidatePeriods, normalizeScheduledLessonPeriods(schedule.lessonPeriods));
    });
    if (existing) {
      conflicts.push({
        candidate,
        existing,
        periods: candidatePeriods.filter((period) => normalizeScheduledLessonPeriods(existing.lessonPeriods).includes(period)),
      });
    }
    earlierCandidates.push(candidate);
  }

  return conflicts;
}

function participantClassIds(schedule: ProgressionSchedule) {
  return Array.from(new Set(String(schedule.participantClassIds || schedule.classId || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)));
}

function hasIntersection<T>(left: T[], right: T[]) {
  const rightSet = new Set(right);
  return left.some((item) => rightSet.has(item));
}

function validInteger(value: number | undefined, min: number, max: number, fallback: number) {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max ? Number(value) : fallback;
}
