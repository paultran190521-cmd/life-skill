import { createHash } from "node:crypto";
import type { ClassRoom, School, SchoolSchedulePattern, SchoolTeachingNeed, TeachingEnvironment } from "@/lib/types";

export type SchoolSchedulePatternInput = {
  id?: string;
  school?: string;
  grade?: string;
  className?: string;
  weekday?: string | number;
  periodLabel?: string;
  start?: string;
  end?: string;
  environment?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  sourceNote?: string;
};

export type NormalizedPatternInput = Omit<SchoolSchedulePattern, "id" | "status" | "version" | "createdAt" | "updatedAt" | "lastEditedAt" | "lastEditedBy"> & { id?: string };

function comparable(value: unknown) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").trim().toLowerCase().replace(/\s+/g, " ");
}

function dateKey(value: unknown, label: string) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new Error(`${label} không hợp lệ.`);
  return date;
}

function timeKey(value: unknown, label: string) {
  const time = String(value || "").trim();
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error(`${label} không hợp lệ.`);
  return time;
}

function parseWeekday(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 7) return value;
  const key = comparable(value);
  const found = new Map([
    ["thu 2", 1], ["thu hai", 1], ["monday", 1],
    ["thu 3", 2], ["thu ba", 2], ["tuesday", 2],
    ["thu 4", 3], ["thu tu", 3], ["wednesday", 3],
    ["thu 5", 4], ["thu nam", 4], ["thursday", 4],
    ["thu 6", 5], ["thu sau", 5], ["friday", 5],
    ["thu 7", 6], ["thu bay", 6], ["saturday", 6],
    ["chu nhat", 7], ["sunday", 7],
  ]).get(key);
  if (!found) throw new Error("Thứ dạy không hợp lệ. Hãy chọn từ Thứ 2 đến Chủ nhật.");
  return found;
}

function parseEnvironment(value: unknown): TeachingEnvironment {
  const key = comparable(value || "Trong lớp");
  const found = new Map<string, TeachingEnvironment>([
    ["trong lop", "in_class"], ["in class", "in_class"],
    ["ngoai troi", "outdoor"], ["outdoor", "outdoor"],
    ["nha tap", "gym"], ["gym", "gym"],
    ["san truong", "schoolyard_report"], ["schoolyard report", "schoolyard_report"],
    ["hoi truong", "hall"], ["hall", "hall"],
  ]);
  const environment = found.get(key);
  if (!environment) throw new Error(`Môi trường dạy không hợp lệ: ${String(value || "")}.`);
  return environment;
}

export function normalizeSchoolSchedulePattern(input: SchoolSchedulePatternInput, schools: School[], classes: ClassRoom[]): NormalizedPatternInput {
  const schoolKey = comparable(input.school);
  const school = schools.find((row) => comparable(row.id) === schoolKey || comparable(row.name) === schoolKey);
  if (!school) throw new Error(`Không tìm thấy trường: ${String(input.school || "")}.`);
  const classKey = comparable(input.className);
  const candidates = classes.filter((row) => row.schoolId === school.id && (comparable(row.id) === classKey || comparable(row.name) === classKey));
  const grade = comparable(input.grade);
  const classRoom = candidates.find((row) => !grade || comparable(row.grade) === grade);
  if (!classRoom) throw new Error(`Không tìm thấy lớp ${String(input.className || "")} của trường ${school.name}.`);
  const effectiveFrom = dateKey(input.effectiveFrom, "Ngày bắt đầu");
  const effectiveTo = dateKey(input.effectiveTo, "Ngày kết thúc");
  if (effectiveTo < effectiveFrom) throw new Error("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
  const start = timeKey(input.start, "Giờ bắt đầu");
  const end = timeKey(input.end, "Giờ kết thúc");
  if (end <= start) throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");
  const periodLabel = String(input.periodLabel || "").trim();
  if (!periodLabel) throw new Error("Tiết dạy là bắt buộc.");
  return {
    id: String(input.id || "").trim() || undefined,
    schoolId: school.id,
    classId: classRoom.id,
    weekday: parseWeekday(input.weekday),
    periodLabel,
    start,
    end,
    teachingEnvironment: parseEnvironment(input.environment),
    effectiveFrom,
    effectiveTo,
    sourceNote: String(input.sourceNote || "").trim().slice(0, 500),
  };
}

export function schoolSchedulePatternIdentity(row: Pick<NormalizedPatternInput, "schoolId" | "classId" | "weekday" | "start" | "end" | "effectiveFrom" | "effectiveTo">) {
  return [row.schoolId, row.classId, row.weekday, row.start, row.end, row.effectiveFrom, row.effectiveTo].join("|");
}

export function schoolSchedulePatternChanged(current: SchoolSchedulePattern, next: NormalizedPatternInput) {
  return (["schoolId", "classId", "weekday", "periodLabel", "start", "end", "teachingEnvironment", "effectiveFrom", "effectiveTo", "sourceNote"] as const)
    .some((key) => String(current[key] || "") !== String(next[key] || ""));
}

export function planSchoolSchedulePatternImport(incoming: NormalizedPatternInput[], existing: SchoolSchedulePattern[]) {
  const byId = new Map(existing.filter((row) => row.status === "ACTIVE").map((row) => [row.id, row]));
  const byIdentity = new Map(existing.filter((row) => row.status === "ACTIVE").map((row) => [schoolSchedulePatternIdentity(row), row]));
  const seen = new Set<string>();
  return incoming.map((row, index) => {
    if (row.id && !byId.has(row.id)) throw new Error(`Dòng ${index + 2}: mã quy tắc không có trong hệ thống; hãy dùng file xuất từ app.`);
    const identity = schoolSchedulePatternIdentity(row);
    if (seen.has(row.id ? `id:${row.id}` : `new:${identity}`)) throw new Error(`Dòng ${index + 2}: quy tắc bị lặp trong file.`);
    seen.add(row.id ? `id:${row.id}` : `new:${identity}`);
    const target = row.id ? byId.get(row.id) : byIdentity.get(identity);
    return { action: !target ? "NEW" as const : schoolSchedulePatternChanged(target, row) ? "CHANGED" as const : "SAME" as const, target, row };
  });
}

export function mondayDateKey(value: string) {
  const date = new Date(`${dateKey(value, "Tuần") }T00:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

export function patternDateInWeek(pattern: SchoolSchedulePattern, weekStart: string) {
  const monday = mondayDateKey(weekStart);
  const date = new Date(`${monday}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + pattern.weekday - 1);
  const key = date.toISOString().slice(0, 10);
  return key >= pattern.effectiveFrom && key <= pattern.effectiveTo ? key : "";
}

export function materializePatternNeed(pattern: SchoolSchedulePattern, weekStart: string): Omit<SchoolTeachingNeed, "id" | "status"> | null {
  const date = patternDateInWeek(pattern, weekStart);
  if (!date) return null;
  return {
    date,
    schoolId: pattern.schoolId,
    classId: pattern.classId,
    periodLabel: pattern.periodLabel,
    start: pattern.start,
    end: pattern.end,
    teachingEnvironment: pattern.teachingEnvironment,
    sourceNote: pattern.sourceNote || "",
    sourceKind: "SEMESTER_BASE",
    patternId: pattern.id,
    sourceVersion: pattern.version,
  };
}

export function schoolScheduleImportChecksum(rows: unknown[]) {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
