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
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error(`${label} không hợp lệ.`);
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

/** Replace one school's exact effective range as a complete recurring-rule snapshot. */
export function planSchoolSchedulePatternSnapshot(incoming: NormalizedPatternInput[], existing: SchoolSchedulePattern[], schoolId: string, effectiveFrom: string, effectiveTo: string) {
  if (!schoolId || !incoming.length) throw new Error("Lịch nền cần trường và ít nhất một quy tắc.");
  const from = dateKey(effectiveFrom, "Ngày bắt đầu hiệu lực");
  const to = dateKey(effectiveTo, "Ngày kết thúc hiệu lực");
  if (to < from) throw new Error("Ngày kết thúc hiệu lực phải sau hoặc bằng ngày bắt đầu.");
  if (incoming.some((row) => row.schoolId !== schoolId || row.effectiveFrom !== from || row.effectiveTo !== to)) throw new Error("File có quy tắc nằm ngoài trường hoặc thời hạn đã chọn.");
  const activeSchool = existing.filter((row) => row.status === "ACTIVE" && row.schoolId === schoolId);
  if (activeSchool.some((row) => row.effectiveFrom <= to && row.effectiveTo >= from && (row.effectiveFrom !== from || row.effectiveTo !== to))) {
    throw new Error("Khoảng hiệu lực giao với lịch nền đang có. Hãy dùng đúng khoảng hiệu lực cũ hoặc sửa lịch nền hiện có trong file CRM.");
  }
  const scoped = activeSchool.filter((row) => row.effectiveFrom === from && row.effectiveTo === to);
  const logicalKey = (row: Pick<NormalizedPatternInput, "schoolId" | "classId" | "weekday" | "periodLabel" | "effectiveFrom" | "effectiveTo">) =>
    [row.schoolId, row.classId, row.weekday, comparable(row.periodLabel), row.effectiveFrom, row.effectiveTo].join("|");
  const byId = new Map(scoped.map((row) => [row.id, row]));
  const byIdentity = new Map(scoped.map((row) => [schoolSchedulePatternIdentity(row), row]));
  const logicalGroups = new Map<string, SchoolSchedulePattern[]>();
  for (const row of scoped) logicalGroups.set(logicalKey(row), [...(logicalGroups.get(logicalKey(row)) || []), row]);
  const matched = new Set<string>();
  const seen = new Set<string>();
  const rows = incoming.map((row, index) => {
    const identity = schoolSchedulePatternIdentity(row);
    if (seen.has(identity)) throw new Error(`Dòng ${index + 2}: quy tắc bị lặp trong file.`);
    seen.add(identity);
    if (row.id && !byId.has(row.id)) throw new Error(`Dòng ${index + 2}: mã quy tắc không thuộc trường và khoảng hiệu lực đang thay.`);
    const logical = logicalGroups.get(logicalKey(row)) || [];
    const target = row.id ? byId.get(row.id) : byIdentity.get(identity) || (logical.length === 1 ? logical[0] : undefined);
    if (target && matched.has(target.id)) throw new Error(`Dòng ${index + 2}: nhiều dòng cùng thay một quy tắc cũ.`);
    if (target) matched.add(target.id);
    return { action: !target ? "NEW" as const : schoolSchedulePatternChanged(target, row) ? "CHANGED" as const : "SAME" as const, target, row };
  });
  return { rows, superseded: scoped.filter((row) => !matched.has(row.id)) };
}

/** Check the proposed active set, but do not reject unrelated conflicts that predate this import. */
export function findSchoolSchedulePatternImportConflicts(
  plan: ReturnType<typeof planSchoolSchedulePatternImport>, existing: SchoolSchedulePattern[], superseded: SchoolSchedulePattern[] = [],
) {
  const replacedIds = new Set([...superseded.map((row) => row.id), ...plan.filter((item) => item.action === "CHANGED" && item.target).map((item) => item.target!.id)]);
  const proposed = [
    ...existing.filter((row) => row.status === "ACTIVE" && !replacedIds.has(row.id)).map((row) => ({ row, changed: false })),
    ...plan.filter((item) => item.action === "NEW" || item.action === "CHANGED").map((item) => ({ row: item.row, changed: true })),
  ];
  const conflicts: Array<{ first: string; second: string }> = [];
  for (let i = 0; i < proposed.length; i += 1) {
    for (let j = i + 1; j < proposed.length; j += 1) {
      const left = proposed[i];
      const right = proposed[j];
      if (!left.changed && !right.changed) continue;
      const a = left.row;
      const b = right.row;
      if (a.schoolId !== b.schoolId || a.classId !== b.classId || a.weekday !== b.weekday) continue;
      if (a.effectiveFrom > b.effectiveTo || b.effectiveFrom > a.effectiveTo) continue;
      if (a.start >= b.end || b.start >= a.end) continue;
      conflicts.push({ first: String(a.id || schoolSchedulePatternIdentity(a)), second: String(b.id || schoolSchedulePatternIdentity(b)) });
    }
  }
  return conflicts;
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

function materializedIdentity(row: Pick<SchoolTeachingNeed, "date" | "schoolId" | "classId" | "start" | "end">) {
  return [row.date, row.schoolId, row.classId, row.start, row.end].join("|");
}

function materializedContentChanged(current: SchoolTeachingNeed, next: Omit<SchoolTeachingNeed, "id" | "status">) {
  return (["date", "schoolId", "classId", "periodLabel", "start", "end", "teachingEnvironment", "sourceNote"] as const)
    .some((key) => String(current[key] || "") !== String(next[key] || ""));
}

function materializedNeedsReview(current: SchoolTeachingNeed, next: Omit<SchoolTeachingNeed, "id" | "status">) {
  return Boolean(current.scheduleId) && (current.status === "REVIEW" ||
    (["date", "schoolId", "classId", "start", "end", "teachingEnvironment"] as const).some((key) => current[key] !== next[key]));
}

/** Reconcile only rows still owned by their recurring rule. Weekly uploads and direct edits take precedence. */
export function planPatternMaterialization(patterns: SchoolSchedulePattern[], needs: SchoolTeachingNeed[], schoolId: string, weekStart: string) {
  const monday = mondayDateKey(weekStart);
  const sunday = new Date(`${monday}T00:00:00Z`);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const weekEnd = sunday.toISOString().slice(0, 10);
  const scopedNeeds = needs.filter((need) => need.schoolId === schoolId && need.date >= monday && need.date <= weekEnd);
  const supersededIds = new Set(patterns.filter((pattern) => pattern.status === "SUPERSEDED").map((pattern) => pattern.id));
  const retirements = scopedNeeds.filter((need) => need.sourceKind === "SEMESTER_BASE" && supersededIds.has(need.patternId || "") && need.status !== "CANCELLED" && !(need.status === "REVIEW" && need.sourceStatus === "Trường hủy tiết"))
    .map((target) => ({ target, status: target.scheduleId ? "REVIEW" as const : "CANCELLED" as const }));
  const hasPendingSupersededReview = scopedNeeds.some((need) => need.sourceKind === "SEMESTER_BASE" && supersededIds.has(need.patternId || "") && Boolean(need.scheduleId) && need.status !== "CANCELLED");
  const retiringIds = new Set(retirements.map((item) => item.target.id));
  const activeNeeds = scopedNeeds.filter((need) => !retiringIds.has(need.id) && !(need.sourceKind === "SEMESTER_BASE" && supersededIds.has(need.patternId || "") && (need.status === "CANCELLED" || need.status === "REVIEW" && need.sourceStatus === "Trường hủy tiết")));
  const byPatternDate = new Map(activeNeeds.filter((need) => need.patternId).map((need) => [`${need.patternId}|${need.date}`, need]));
  const byPatternId = new Map(activeNeeds.filter((need) => need.patternId).map((need) => [need.patternId!, need]));
  const byIdentity = new Map(activeNeeds.map((need) => [materializedIdentity(need), need]));
  const hasWeeklySnapshot = scopedNeeds.some((need) => need.sourceKind === "WEEKLY_OVERRIDE");
  const creates: Array<Omit<SchoolTeachingNeed, "id" | "status">> = [];
  const updates: Array<{ target: SchoolTeachingNeed; row: Omit<SchoolTeachingNeed, "id" | "status">; status: SchoolTeachingNeed["status"] }> = [];
  const conflicts: string[] = [];
  let skippedCount = 0;
  let candidateCount = 0;
  for (const pattern of patterns) {
    if (pattern.status !== "ACTIVE" || pattern.schoolId !== schoolId) continue;
    const row = materializePatternNeed(pattern, monday);
    if (!row) continue;
    candidateCount += 1;
    if (hasWeeklySnapshot || hasPendingSupersededReview) { skippedCount += 1; continue; }
    const patternDate = `${pattern.id}|${row.date}`;
    const identity = materializedIdentity(row);
    const existing = byPatternDate.get(patternDate) || byPatternId.get(pattern.id);
    const occupying = byIdentity.get(identity);
    if (existing) {
      if (existing.sourceKind !== "SEMESTER_BASE" || existing.status === "CANCELLED") { skippedCount += 1; continue; }
      if (occupying && occupying.id !== existing.id) { conflicts.push(patternDate); continue; }
      if (materializedContentChanged(existing, row) || Number(existing.sourceVersion || 0) !== Number(pattern.version || 0)) {
        const status = materializedNeedsReview(existing, row) ? "REVIEW" : existing.scheduleId ? "ASSIGNED" : "OPEN";
        updates.push({ target: existing, row, status });
        byIdentity.delete(materializedIdentity(existing));
        byIdentity.set(identity, existing);
      } else skippedCount += 1;
      continue;
    }
    if (occupying) { skippedCount += 1; continue; }
    creates.push(row);
    byIdentity.set(identity, { ...row, id: patternDate, status: "OPEN" });
  }
  return { candidateCount, creates, updates, retirements, skippedCount, hasPendingSupersededReview, conflicts };
}

export function schoolScheduleImportChecksum(rows: unknown[]) {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
