import { createHash } from "node:crypto";
import { google } from "googleapis";
import { appendIntakeRows, buildIntakeDropdownRows, intakeInputFirstDataRow, intakeInputLastRow, readIntakeTab, readIntakeWeekLocks, schoolIntakeSpreadsheetId, weekStartOf, writeIntakeRanges } from "@/lib/school-intake-storage";
import type { ClassRoom, School, SchoolTeachingNeed, TeachingEnvironment } from "@/lib/types";

const environmentNames: Record<TeachingEnvironment, string> = {
  in_class: "Trong lớp", outdoor: "Ngoài sân", gym: "Nhà thi đấu", hall: "Hội trường", schoolyard_report: "Báo cáo chuyên đề",
};
export const intakeConflictMessage = "Dòng này đã được sửa hoặc đang chờ duyệt trên Google Sheet. Hãy hoàn tất/đối chiếu bản Sheet trước khi sửa trong app.";

export type IntakeLink = { rowId: string; inputNumber: number; effectiveNumber: number; input: string[]; effective: string[] };

export function intakeLinkRevision(link: IntakeLink | null) {
  return createHash("sha256").update(JSON.stringify(link ? [link.rowId, link.inputNumber, link.effectiveNumber, link.input, link.effective] : null)).digest("hex");
}

export function needFields(need: SchoolTeachingNeed, schools: School[], classes: ClassRoom[]) {
  const school = schools.find((item) => item.id === need.schoolId);
  const classroom = classes.find((item) => item.id === need.classId && item.schoolId === need.schoolId);
  if (!school || !classroom) throw new Error("Không tìm thấy trường hoặc lớp của lịch cần đồng bộ.");
  const [year, month, day] = need.date.split("-");
  if (!year || !month || !day) throw new Error("Ngày dạy của lịch không hợp lệ.");
  return [`${day}/${month}/${year}`, school.name, classroom.grade, classroom.name, need.start < "12:00" ? "Sáng" : "Chiều", need.periodLabel, need.start, need.end, environmentNames[need.teachingEnvironment], need.status === "CANCELLED" ? "Trường hủy tiết" : "Dạy", need.sourceNote || ""];
}

export function isIntakeRowDirty(input: string[], effective: string[]) {
  if ((input[16] || "") !== "Đã đồng bộ") return true;
  if (!effective.length || (input[0] || "") !== (effective[0] || "")) return true;
  return Array.from({ length: 11 }, (_, index) => index + 1).some((column) => {
    const value = input[column] || "";
    const expected = effective[column] || "";
    // Sheets can render a time-formatted numeric cell as a localized Excel fraction.
    if (column === 7 || column === 8) return normalizeIntakeTime(value) !== normalizeIntakeTime(expected);
    return value !== expected;
  });
}

function normalizeIntakeTime(value: string) {
  const fraction = Number(value.replace(",", "."));
  if (value.trim() && Number.isFinite(fraction) && fraction >= 0 && fraction < 1) {
    const minutes = Math.round(fraction * 1440);
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  return value.trim();
}

export function appNeedDiffersFromEffective(need: SchoolTeachingNeed, effective: string[], schools: School[], classes: ClassRoom[]) {
  const fields = needFields(need, schools, classes);
  return fields.some((value, index) => value !== (effective[index + 1] || ""));
}

export async function findIntakeLink(needId: string): Promise<IntakeLink | null> {
  const [inputRows, effectiveRows] = await Promise.all([
    readIntakeTab("Nhập lịch", "T", intakeInputLastRow),
    readIntakeTab("Lịch hiệu lực", "O", 1000),
  ]);
  const inputMatches = inputRows.slice(intakeInputFirstDataRow - 1).flatMap((row, index) => row[17] === needId ? [{ row, number: index + intakeInputFirstDataRow }] : []);
  const effectiveMatches = effectiveRows.slice(1).flatMap((row, index) => row[12] === needId ? [{ row, number: index + 2 }] : []);
  if (!inputMatches.length && !effectiveMatches.length) return null;
  if (inputMatches.length > 1 || effectiveMatches.length > 1 || (inputMatches.length && effectiveMatches.length && inputMatches[0].row[0] !== effectiveMatches[0].row[0])) {
    throw new Error("Liên kết mã lịch app trên Google Sheet bị thiếu hoặc trùng. Cần đối chiếu trước khi sửa.");
  }
  return { rowId: inputMatches[0]?.row[0] || effectiveMatches[0]?.row[0] || "", inputNumber: inputMatches[0]?.number || 0, effectiveNumber: effectiveMatches[0]?.number || 0, input: inputMatches[0]?.row || [], effective: effectiveMatches[0]?.row || [] };
}

export async function assertIntakeWeeksUnlocked(dates: string[]) {
  const locks = await readIntakeWeekLocks();
  if (dates.some((date) => locks.get(weekStartOf(date))?.locked)) throw new Error("Tuần này đã khóa trên Google Sheet. Nguyễn Phương cần mở khóa trước khi sửa lịch.");
}

export async function assertAppNeedCanEditIntake(needId: string, dates: string[]) {
  const link = await findIntakeLink(needId);
  if (link && isIntakeRowDirty(link.input, link.effective)) throw new Error(intakeConflictMessage);
  await assertIntakeWeeksUnlocked(dates);
  return link;
}

function excelDate(iso: string) {
  return (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000;
}

function eventId(need: SchoolTeachingNeed, link: IntakeLink | null, allowDirty: boolean) {
  return `app-${createHash("sha256").update(`${need.id}:${need.updatedAt}:${need.status}:${allowDirty ? intakeLinkRevision(link) : ""}`).digest("hex").slice(0, 12)}`;
}

export async function mirrorAppNeedToIntake(need: SchoolTeachingNeed, previous: SchoolTeachingNeed | null, actor: string, schools: School[], classes: ClassRoom[], knownLink?: IntakeLink | null, allowDirty = false) {
  const fields = needFields(need, schools, classes);
  const link = knownLink === undefined ? await findIntakeLink(need.id) : knownLink;
  if (link && !allowDirty && isIntakeRowDirty(link.input, link.effective)) throw new Error(intakeConflictMessage);
  await assertIntakeWeeksUnlocked([need.date, ...(previous ? [previous.date] : [])]);
  const now = new Date().toISOString();
  const id = eventId(need, link, allowDirty);
  const action = allowDirty ? "APP_RESOLVED" : link ? "APP_CHANGED" : "APP_NEW";
  const rowId = link?.rowId || `intake-${createHash("sha256").update(need.id).digest("hex").slice(0, 12)}`;
  let inputNumber = link?.inputNumber;
  if (!inputNumber) {
    const input = await readIntakeTab("Nhập lịch", "T", intakeInputLastRow);
    const blank = input.slice(intakeInputFirstDataRow - 1).findIndex((row) => !row[0] && !row[1] && !row[2]);
    inputNumber = blank >= 0 ? blank + intakeInputFirstDataRow : Math.max(intakeInputFirstDataRow, input.length + 1);
    if (inputNumber > intakeInputLastRow) throw new Error("Google Sheet nhập lịch đã hết dòng trống.");
  }
  const date = excelDate(need.date);
  await ensureIntakeRowControls(inputNumber, fields);
  // Keep M:N formulas and row styling intact.
  const effectiveValue = [rowId, ...fields, need.id, id, now];
  await writeIntakeRanges([
    { range: `'Nhập lịch'!A${inputNumber}:L${inputNumber}`, values: [[rowId, date, ...fields.slice(1, 6), need.start, need.end, ...fields.slice(8)]] },
    { range: `'Nhập lịch'!O${inputNumber}:T${inputNumber}`, values: [[action, "", "Đã đồng bộ", need.id, now, id]] },
    ...(link?.effectiveNumber ? [{ range: `'Lịch hiệu lực'!A${link.effectiveNumber}:O${link.effectiveNumber}`, values: [effectiveValue] }] : []),
  ]);
  if (!link?.effectiveNumber) await appendIntakeRows("Lịch hiệu lực", "O", [effectiveValue]);
  const history = await readIntakeTab("Lịch sử", "R", 3000);
  if (!history.slice(1).some((row) => row[0] === id && row[1] === rowId)) {
    await appendIntakeRows("Lịch sử", "R", [[id, rowId, ...fields, need.id, action, now, actor, JSON.stringify({ previousApp: previous, previousSheet: allowDirty ? link?.input || null : null })]]);
  }
  return { rowId, inputNumber, eventId: id };
}

async function ensureIntakeRowControls(number: number, fields: string[]) {
  let key = String(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1);
  key = key.replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: schoolIntakeSpreadsheetId, fields: "sheets(properties(sheetId,title))" });
  const inputSheetId = metadata.data.sheets?.find((item) => item.properties?.title === "Nhập lịch")?.properties?.sheetId;
  if (inputSheetId == null) throw new Error("Không tìm thấy tab Nhập lịch để cập nhật danh sách chọn.");
  const catalog = (await readIntakeTab("Danh mục", "Q", 1000)).slice(1);
  const row = ["", fields[0], fields[1], fields[2], fields[3], fields[4], fields[5]];
  const dropdowns = buildIntakeDropdownRows(catalog, [row])[0];
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: schoolIntakeSpreadsheetId, requestBody: { requests: [
    { updateCells: { start: { sheetId: inputSheetId, rowIndex: number - 1, columnIndex: 3 }, rows: [dropdowns], fields: "dataValidation" } },
    { repeatCell: { range: { sheetId: inputSheetId, startRowIndex: number - 1, endRowIndex: number, startColumnIndex: 1, endColumnIndex: 2 }, cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd/mm/yyyy" } } }, fields: "userEnteredFormat.numberFormat" } },
    { repeatCell: { range: { sheetId: inputSheetId, startRowIndex: number - 1, endRowIndex: number, startColumnIndex: 7, endColumnIndex: 9 }, cell: { userEnteredFormat: { numberFormat: { type: "TIME", pattern: "hh:mm" } } }, fields: "userEnteredFormat.numberFormat" } },
  ] } });
}
