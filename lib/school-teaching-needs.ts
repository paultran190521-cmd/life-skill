import { createHash } from "node:crypto";
import type { ClassRoom, School, SchoolTeachingNeed, TeachingEnvironment } from "@/lib/types";

export type SchoolNeedInput = {
  id?: string;
  date?: string;
  school?: string;
  grade?: string;
  className?: string;
  session?: string;
  periodLabel?: string;
  start?: string;
  end?: string;
  environment?: string;
  sourceNote?: string;
};

export type NormalizedNeedInput = Omit<SchoolTeachingNeed, "id" | "status" | "scheduleId" | "assignedDate" | "assignedStart" | "assignedEnd" | "createdAt" | "updatedAt"> & { id?: string };

function comparable(value: unknown) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").trim().toLowerCase().replace(/\s+/g, " ");
}

function parseDate(value: unknown) {
  const raw = String(value || "").trim();
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw) || /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (!match) return "";
  const key = raw.includes("/") ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  const date = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === key ? key : "";
}

function parseTime(value: unknown) {
  const raw = String(value || "").trim().replace(/[gh]/i, ":");
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function environmentOf(value: unknown): TeachingEnvironment | null {
  const text = comparable(value);
  if (["trong lop", "in_class"].includes(text)) return "in_class";
  if (["ngoai san", "ngoai troi", "san truong", "outdoor"].includes(text)) return "outdoor";
  if (["nha thi dau", "nha the chat", "gym"].includes(text)) return "gym";
  if (["hoi truong", "hall"].includes(text)) return "hall";
  if (["bao cao chuyen de", "schoolyard_report"].includes(text)) return "schoolyard_report";
  return null;
}

export function normalizeSchoolNeedInput(input: SchoolNeedInput, schools: School[], classes: ClassRoom[]): NormalizedNeedInput {
  const date = parseDate(input.date);
  if (!date) throw new Error("Ngày dạy phải có dạng YYYY-MM-DD hoặc DD/MM/YYYY.");
  const school = schools.find((row) => row.id === input.school || comparable(row.name) === comparable(input.school));
  if (!school) throw new Error(`Không tìm thấy trường: ${input.school || "(trống)"}.`);
  const classRoom = classes.find((row) => row.schoolId === school.id && (!input.grade || comparable(row.grade) === comparable(input.grade)) && (row.id === input.className || comparable(row.name) === comparable(input.className)));
  if (!classRoom) throw new Error(`Lớp ${input.className || "(trống)"} không thuộc ${school.name}.`);
  const start = parseTime(input.start);
  const end = parseTime(input.end);
  if (!start || !end || start >= end) throw new Error("Giờ bắt đầu/kết thúc không hợp lệ.");
  const session = comparable(input.session);
  if (session && !["sang", "chieu"].includes(session)) throw new Error("Buổi phải là Sáng hoặc Chiều.");
  if (session && (start < "12:00" ? session !== "sang" : session !== "chieu")) throw new Error("Buổi không khớp giờ bắt đầu.");
  const periodLabel = String(input.periodLabel || "").trim();
  if (!periodLabel) throw new Error("Thiếu tên tiết hoặc số tiết.");
  const teachingEnvironment = environmentOf(input.environment);
  if (!teachingEnvironment) throw new Error(`Môi trường dạy không hợp lệ: ${input.environment}.`);
  return { id: String(input.id || "").trim() || undefined, date, schoolId: school.id, classId: classRoom.id, periodLabel, start, end, teachingEnvironment, sourceNote: String(input.sourceNote || "").trim().slice(0, 500) };
}

export function schoolNeedIdentity(row: Pick<NormalizedNeedInput, "date" | "schoolId" | "classId" | "start" | "end">) {
  return [row.date, row.schoolId, row.classId, row.start, row.end].join("|");
}

export function schoolNeedRequiresReview(current: SchoolTeachingNeed, next: NormalizedNeedInput) {
  return Boolean(current.scheduleId) && (current.status === "REVIEW" ||
    (["date", "schoolId", "classId", "start", "end", "teachingEnvironment"] as const)
      .some((key) => current[key] !== next[key]));
}

export function schoolNeedRevision(rows: SchoolTeachingNeed[]) {
  return createHash("sha256").update(JSON.stringify(rows.map((row) => [row.id, row.updatedAt, row.date, row.classId, row.start, row.end, row.status]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))))).digest("hex");
}

export function planSchoolNeedImport(incoming: NormalizedNeedInput[], existing: SchoolTeachingNeed[]) {
  const byId = new Map(existing.map((row) => [row.id, row]));
  const byIdentity = new Map(existing.map((row) => [schoolNeedIdentity(row), row]));
  const seen = new Set<string>();
  return incoming.map((row, index) => {
    if (row.id && !byId.has(row.id)) throw new Error(`Dòng ${index + 2}: mã dòng không có trong hệ thống; hãy dùng file xuất từ app.`);
    const identity = schoolNeedIdentity(row);
    const target = row.id ? byId.get(row.id) : byIdentity.get(identity);
    const existingAtIdentity = byIdentity.get(identity);
    if (target && existingAtIdentity && existingAtIdentity.id !== target.id) throw new Error(`Dòng ${index + 2}: ngày, trường, lớp và giờ đang thuộc một dòng lịch khác.`);
    const uniqueness = target ? `id:${target.id}` : `new:${identity}`;
    if (seen.has(uniqueness)) throw new Error(`Dòng ${index + 2}: trùng một dòng khác trong file.`);
    seen.add(uniqueness);
    if (!target) return { action: "NEW" as const, row };
    const changed = (["date", "schoolId", "classId", "periodLabel", "start", "end", "teachingEnvironment", "sourceNote"] as const)
      .some((key) => String(target[key] || "") !== String(row[key] || ""));
    return { action: changed ? "CHANGED" as const : "SAME" as const, row, target };
  });
}
