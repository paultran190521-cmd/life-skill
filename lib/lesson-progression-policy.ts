import { normalizeScheduledLessonPeriods, type ScheduledLessonPeriod } from "@/lib/lessons";

type ProgressionSchedule = {
  id?: unknown;
  date?: unknown;
  teacherId?: unknown;
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
type RecentLessonOptions = { lookbackMonths?: number };

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
 * Chặn giao lại Tiết 1 khi cùng giáo viên đã dạy cùng bài cho cùng lớp tại cùng
 * trường trong năm tháng gần nhất. Cùng bài ở lớp khác vẫn được phép giao.
 * Các dòng đồng giảng thuộc cùng groupId là một hoạt động, không tự xung đột.
 */
export function findLessonProgressionConflicts(
  candidates: ProgressionSchedule[],
  existingSchedules: ProgressionSchedule[],
  options: RecentLessonOptions = {},
): LessonProgressionConflict[] {
  const conflicts: LessonProgressionConflict[] = [];
  const earlierCandidates: ProgressionSchedule[] = [];
  const lookbackMonths = validInteger(options.lookbackMonths, 1, 12, 5);

  for (const candidate of candidates) {
    const candidatePeriods = normalizeScheduledLessonPeriods(candidate.lessonPeriods);
    if (!candidatePeriods.includes("lesson1")) {
      earlierCandidates.push(candidate);
      continue;
    }
    const comparisons = [...existingSchedules, ...earlierCandidates];
    const existing = comparisons.find((schedule) => {
      if (String(schedule.status || "") === "cancelled") return false;
      if (String(schedule.id || "") && String(schedule.id) === String(candidate.id || "")) return false;
      if (candidate.groupId && String(schedule.groupId || "") === String(candidate.groupId)) return false;
      if (String(schedule.teacherId || "") !== String(candidate.teacherId || "")) return false;
      if (String(schedule.schoolId || "") !== String(candidate.schoolId || "")) return false;
      if (String(schedule.lessonId || "") !== String(candidate.lessonId || "")) return false;
      if (!normalizeScheduledLessonPeriods(schedule.lessonPeriods).includes("lesson1")) return false;
      if (!hasIntersection(participantClassIds(schedule), participantClassIds(candidate))) return false;
      return isWithinPreviousCalendarMonths(schedule.date, candidate.date, lookbackMonths);
    });
    if (existing) {
      conflicts.push({
        candidate,
        existing,
        periods: ["lesson1"],
      });
    }
    earlierCandidates.push(candidate);
  }

  return conflicts;
}

function isWithinPreviousCalendarMonths(existingDateKey: unknown, candidateDateKey: unknown, months: number) {
  const existing = parseDateKey(existingDateKey);
  const candidate = parseDateKey(candidateDateKey);
  if (!existing || !candidate || existing.getTime() > candidate.getTime()) return false;
  const earliest = new Date(candidate.getTime());
  earliest.setUTCMonth(earliest.getUTCMonth() - months);
  return existing.getTime() >= earliest.getTime();
}

function parseDateKey(value: unknown) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
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
