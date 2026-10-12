import type { SchoolNeedInput } from "./school-teaching-needs";
import type { SchoolSchedulePatternInput } from "./school-schedule-patterns";

export const fixedBaselineSchoolLabels = ["Nam Sài Gòn", "Chi Lăng", "Tân Túc", "Dương Văn Thì"] as const;

export type FixedBaselineScope = { schoolId: string; effectiveFrom: string; effectiveTo: string };

function comparable(value: unknown) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").trim().toLowerCase().replace(/\s+/g, " ");
}

function dateKey(value: unknown, label: string) {
  const raw = String(value || "").trim();
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  const key = dmy ? `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}` : raw;
  const parsed = new Date(`${key}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== key) throw new Error(`${label} không hợp lệ.`);
  return key;
}

function mondayDateKey(value: string) {
  const date = new Date(`${dateKey(value, "Tuần mẫu")}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

function recurringSignature(row: SchoolNeedInput) {
  const day = dateKey(row.date, "Ngày dạy");
  const weekday = ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
  return [weekday, comparable(row.grade), comparable(row.className), comparable(row.session), comparable(row.periodLabel), row.start, row.end, comparable(row.environment)].join("|");
}

/** One existing workbook supplies four schools; the first effective week must be a complete recurring sample. */
export function buildFixedSchoolBaselineBatch(
  rows: SchoolNeedInput[], schools: Array<{ id: string; name: string }>, effectiveFrom: string, effectiveTo: string,
): {
  patterns: SchoolSchedulePatternInput[];
  scopes: FixedBaselineScope[];
  diagnostics: Array<{ school: string; sampleWeekStart: string; weeklyPeriods: number; sourceWeeks: number }>;
} {
  const from = dateKey(effectiveFrom, "Ngày bắt đầu hiệu lực");
  const to = dateKey(effectiveTo, "Ngày kết thúc hiệu lực");
  if (to < from) throw new Error("Ngày kết thúc hiệu lực phải sau hoặc bằng ngày bắt đầu.");
  const sampleWeekStart = mondayDateKey(from);
  if (sampleWeekStart !== from) throw new Error("Ngày bắt đầu lịch nền phải là thứ Hai của tuần mẫu.");
  const patterns: SchoolSchedulePatternInput[] = [];
  const scopes: FixedBaselineScope[] = [];
  const diagnostics: Array<{ school: string; sampleWeekStart: string; weeklyPeriods: number; sourceWeeks: number }> = [];
  for (const label of fixedBaselineSchoolLabels) {
    const key = comparable(label);
    const sourceNames = [...new Set(rows.map((row) => String(row.school || "").trim()))].filter((name) => comparable(name).includes(key));
    const catalogSchools = schools.filter((school) => comparable(school.name).includes(key));
    if (sourceNames.length !== 1 || catalogSchools.length !== 1) throw new Error(`Không xác định duy nhất trường ${label} trong Excel và danh mục CRM.`);
    const sourceName = sourceNames[0];
    const catalogSchool = catalogSchools[0];
    const built = buildRecurringPatternsFromWeeklyRows(rows, sourceName, sampleWeekStart, from, to);
    const sampleRows = rows.filter((row) => comparable(row.school) === comparable(sourceName) && mondayDateKey(dateKey(row.date, "Ngày dạy")) === sampleWeekStart);
    const expected = sampleRows.map(recurringSignature).sort().join("\n");
    const representedWeeks = new Map<string, SchoolNeedInput[]>();
    for (const row of rows.filter((item) => comparable(item.school) === comparable(sourceName))) {
      const day = dateKey(row.date, "Ngày dạy");
      if (day < from || day > to) continue;
      const week = mondayDateKey(day);
      representedWeeks.set(week, [...(representedWeeks.get(week) || []), row]);
    }
    for (const [week, weekRows] of representedWeeks) {
      const fingerprint = weekRows.map(recurringSignature).sort().join("\n");
      if (fingerprint !== expected) throw new Error(`${label}: tuần ${week} khác lịch nền mẫu. Hãy cập nhật tuần ngoại lệ riêng, không nhập đè âm thầm.`);
    }
    patterns.push(...built.patterns.map((pattern) => ({ ...pattern, school: catalogSchool.name })));
    scopes.push({ schoolId: catalogSchool.id, effectiveFrom: from, effectiveTo: to });
    diagnostics.push({ school: catalogSchool.name, sampleWeekStart, weeklyPeriods: built.patterns.length, sourceWeeks: representedWeeks.size });
  }
  return { patterns, scopes, diagnostics };
}

/** Convert one explicit dated week into recurring rules, with a user supplied validity range. */
export function buildRecurringPatternsFromWeeklyRows(
  rows: SchoolNeedInput[], schoolName: string, sampleWeekStart: string, effectiveFrom: string, effectiveTo: string,
): {
  patterns: SchoolSchedulePatternInput[];
  diagnostics: { totalSchoolRows: number; selectedWeekRows: number; weekCounts: Array<{ weekStart: string; count: number }>; isMinorityWeek: boolean };
} {
  const monday = mondayDateKey(sampleWeekStart);
  const from = dateKey(effectiveFrom, "Ngày bắt đầu hiệu lực");
  const to = dateKey(effectiveTo, "Ngày kết thúc hiệu lực");
  if (to < from) throw new Error("Ngày kết thúc hiệu lực phải sau hoặc bằng ngày bắt đầu.");
  if (!schoolName.trim()) throw new Error("Hãy chọn trường cho lịch nền.");
  const selectedSchoolRows = rows.filter((row) => comparable(row.school) === comparable(schoolName));
  const weeks = new Map<string, Array<{ row: SchoolNeedInput; day: string }>>();
  for (const row of selectedSchoolRows) {
    const day = dateKey(row.date, "Ngày dạy");
    const week = mondayDateKey(day);
    const group = weeks.get(week) || [];
    group.push({ row, day });
    weeks.set(week, group);
  }
  const selected = weeks.get(monday) || [];
  if (!selected.length) throw new Error("Tuần mẫu của trường không có lịch trong file.");
  if (selected.some(({ row }) => comparable(row.sourceStatus) === "truong huy tiet")) throw new Error("Tuần mẫu có tiết trường hủy; hãy chọn tuần lịch cố định bình thường.");
  const weekCounts = [...weeks.entries()].map(([weekStart, group]) => ({ weekStart, count: group.length })).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const maxWeekCount = Math.max(...weekCounts.map((week) => week.count));
  const isMinorityWeek = weeks.size > 1 && selected.length < maxWeekCount;
  if (isMinorityWeek) throw new Error(`Tuần mẫu ${monday} có ${selected.length} tiết, ít hơn tuần đầy đủ ${maxWeekCount} tiết. Hãy chọn tuần cố định đại diện.`);
  const signatureOf = ({ row, day }: { row: SchoolNeedInput; day: string }) => {
    const weekday = ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
    return [weekday, comparable(row.grade), comparable(row.className), comparable(row.session), comparable(row.periodLabel), row.start, row.end, comparable(row.environment)].join("|");
  };
  const fingerprint = (group: Array<{ row: SchoolNeedInput; day: string }>) => group.map(signatureOf).sort().join("\n");
  if (weeks.size > 1 && ![...weeks.entries()].some(([week, group]) => week !== monday && fingerprint(group) === fingerprint(selected))) {
    throw new Error("Tuần mẫu không trùng lịch với tuần nào khác trong file. Hãy chọn tuần cố định đại diện hoặc dùng lịch tuần cập nhật.");
  }
  const signatures = new Set<string>();
  const patterns = selected.map(({ row, day }, index) => {
    const weekday = ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
    const signature = signatureOf({ row, day });
    if (signatures.has(signature)) throw new Error(`Tuần mẫu có tiết trùng ở dòng ${index + 1}.`);
    signatures.add(signature);
    return {
      school: schoolName, grade: row.grade, className: row.className, weekday, periodLabel: row.periodLabel,
      start: row.start, end: row.end, environment: row.environment, effectiveFrom: from, effectiveTo: to, sourceNote: row.sourceNote,
    };
  });
  return { patterns, diagnostics: { totalSchoolRows: selectedSchoolRows.length, selectedWeekRows: selected.length, weekCounts, isMinorityWeek } };
}
