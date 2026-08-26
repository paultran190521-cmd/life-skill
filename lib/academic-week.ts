const DAY_IN_MS = 24 * 60 * 60 * 1000;

type AcademicWeek = {
  week: number;
  schoolYear: string;
};

/**
 * Tuần năm học METTASOUL bắt đầu từ ngày 01/09.
 * Vì vậy 01-07/09 là tuần 1, 08-14/09 là tuần 2, ...
 */
export function getAcademicWeek(dateInput: string): AcademicWeek | null {
  const match = String(dateInput || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = Date.UTC(year, month - 1, day);
  const validDate = new Date(date);
  if (
    validDate.getUTCFullYear() !== year ||
    validDate.getUTCMonth() !== month - 1 ||
    validDate.getUTCDate() !== day
  ) {
    return null;
  }

  const academicStartYear = month >= 9 ? year : year - 1;
  const academicStart = Date.UTC(academicStartYear, 8, 1);
  const week = Math.floor((date - academicStart) / DAY_IN_MS / 7) + 1;

  return {
    week,
    schoolYear: `${academicStartYear}-${academicStartYear + 1}`,
  };
}

export function formatAcademicWeekLabel(dates: string[]) {
  const groupedWeeks = new Map<string, number[]>();

  for (const date of dates) {
    const academicWeek = getAcademicWeek(date);
    if (!academicWeek) continue;

    const weeks = groupedWeeks.get(academicWeek.schoolYear) ?? [];
    weeks.push(academicWeek.week);
    groupedWeeks.set(academicWeek.schoolYear, weeks);
  }

  if (!groupedWeeks.size) {
    const currentYear = new Date().getFullYear();
    return `tuần ? năm học ${currentYear}-${currentYear + 1}`;
  }

  return Array.from(groupedWeeks.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([schoolYear, weeks]) => {
      const minWeek = Math.min(...weeks);
      const maxWeek = Math.max(...weeks);
      const weekText = minWeek === maxWeek ? String(minWeek) : `${minWeek}-${maxWeek}`;
      return `tuần ${weekText} năm học ${schoolYear}`;
    })
    .join(" và ");
}
