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

export type NormalizedNeedInput = Omit<SchoolTeachingNeed, "id" | "status" | "scheduleId" | "assignedDate" | "assignedStart" | "assignedEnd" | "createdAt" | "updatedAt" | "lastEditedAt" | "lastEditedBy"> & { id?: string };

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

export function schoolNeedContentChanged(current: SchoolTeachingNeed, next: NormalizedNeedInput) {
  return (["date", "schoolId", "classId", "periodLabel", "start", "end", "teachingEnvironment", "sourceNote"] as const)
    .some((key) => String(current[key] || "") !== String(next[key] || ""));
}

export function planSchoolNeedDeletion(needs: SchoolTeachingNeed[], rawIds: unknown, rawExpectedRows?: unknown):
  { ok: true; ids: string[]; rows: SchoolTeachingNeed[] } |
  { ok: false; error: string; status: 400 | 409 } {
  if (!Array.isArray(rawIds) || rawIds.length === 0 || rawIds.length > 200 || rawIds.some((id) => typeof id !== "string" || !id.trim())) {
    return { ok: false, error: "Chọn từ 1 đến 200 tiết hợp lệ để xóa.", status: 400 };
  }
  const ids = rawIds.map((id: string) => id.trim());
  if (new Set(ids).size !== ids.length) return { ok: false, error: "Danh sách tiết cần xóa bị trùng.", status: 400 };
  const byId = new Map(needs.map((need) => [need.id, need]));
  const rows = ids.map((id) => byId.get(id));
  if (rows.some((row) => !row)) return { ok: false, error: "Lịch trường đã thay đổi. Hãy tải lại danh sách trước khi xóa.", status: 409 };
  if (ids.length > 1) {
    if (!Array.isArray(rawExpectedRows) || rawExpectedRows.length !== ids.length || rawExpectedRows.some((row) => !row || typeof row.id !== "string" || typeof row.updatedAt !== "string")) {
      return { ok: false, error: "Thiếu phiên bản lịch cần xóa. Hãy tải lại danh sách trước khi xóa.", status: 400 };
    }
    const expectedById = new Map(rawExpectedRows.map((row: { id: string; updatedAt: string }) => [row.id, row.updatedAt]));
    if (expectedById.size !== ids.length || rows.some((row) => expectedById.get(row!.id) !== row!.updatedAt)) {
      return { ok: false, error: "Lịch trường đã được sửa trong lúc chọn. Hãy tải lại và chọn lại các tiết cần xóa.", status: 409 };
    }
  }
  if (rows.some((row) => row!.scheduleId || row!.status === "ASSIGNED" || row!.status === "REVIEW")) {
    return { ok: false, error: "Có tiết đã giao giáo viên hoặc đang chờ đối chiếu. Hãy xử lý lịch đã gửi trước khi xóa nguồn.", status: 409 };
  }
  return { ok: true, ids, rows: rows as SchoolTeachingNeed[] };
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
    const changed = schoolNeedContentChanged(target, row);
    return { action: changed ? "CHANGED" as const : "SAME" as const, row, target };
  });
}
