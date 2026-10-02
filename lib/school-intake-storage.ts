import { createHash } from "node:crypto";
import { google } from "googleapis";
import type { SchoolNeedInput } from "@/lib/school-teaching-needs";

export const schoolIntakeSpreadsheetId = process.env.SCHOOL_INTAKE_SPREADSHEET_ID || "1UPtukz6CQoQbe9Tq1s8Zwwfj1AL01XEwa7STeZ7dedg";
export const intakeInputFirstDataRow = 6;
export const intakeInputLastRow = 1004;
export const intakeSettingsOwner = "paultran190521@gmail.com";

export type IntakeSettings = { submitter: string; reviewer: string; director: string };

export async function readIntakeSettings(): Promise<IntakeSettings> {
  const rows = await readIntakeTab("Cấu hình duyệt", "B", 4);
  const emails = [1, 2, 3].map((index) => String(rows[index]?.[1] || "").trim().toLowerCase());
  if (emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("Cấu hình email duyệt lịch chưa hợp lệ.");
  return { submitter: emails[0], reviewer: emails[1], director: emails[2] };
}

export type IntakeSourceRow = SchoolNeedInput & {
  rowId: string;
  intakeStatus: "Dạy" | "Trường hủy tiết";
};

export type IntakeBatch = {
  number: number;
  id: string;
  school: string;
  weekStart: string;
  fingerprint: string;
  status: string;
  count: number;
  submittedBy: string;
  submittedAt: string;
  approvedBy: string;
  approvedAt: string;
  note: string;
  revision: string;
  raw: string[];
};

let client: ReturnType<typeof google.sheets> | null = null;
function sheets() {
  if (client) return client;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = String(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1);
  key = key.replace(/\\n/g, "\n");
  if (!email || !key.includes("-----BEGIN PRIVATE KEY-----")) throw new Error("Thiếu tài khoản tích hợp Google Sheets.");
  const auth = new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  client = google.sheets({ version: "v4", auth });
  return client;
}

const tab = (name: string) => `'${name.replace(/'/g, "''")}'`;
export async function readIntakeTab(name: string, lastColumn: string, lastRow: number) {
  const response = await sheets().spreadsheets.values.get({
    spreadsheetId: schoolIntakeSpreadsheetId,
    range: `${tab(name)}!A1:${lastColumn}${lastRow}`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return (response.data.values || []).map((row) => row.map((value) => String(value ?? "")));
}

export async function appendIntakeRows(name: string, lastColumn: string, rows: string[][]) {
  if (!rows.length) return;
  const width = lastColumn.charCodeAt(0) - 64;
  if (rows.some((row) => row.length > width)) throw new Error(`Dòng ${name} vượt quá cột ${lastColumn}.`);
  const metadata = await sheets().spreadsheets.get({
    spreadsheetId: schoolIntakeSpreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });
  const sheetId = metadata.data.sheets?.find((sheet) => sheet.properties?.title === name)?.properties?.sheetId;
  if (sheetId == null) throw new Error(`Không tìm thấy tab ${name}.`);
  await sheets().spreadsheets.batchUpdate({
    spreadsheetId: schoolIntakeSpreadsheetId,
    requestBody: { requests: [{ appendCells: {
      sheetId,
      rows: rows.map((row) => ({ values: row.map((value) => ({ userEnteredValue: { stringValue: String(value ?? "") } })) })),
      fields: "userEnteredValue",
    } }] },
  });
}

export async function writeIntakeRanges(data: Array<{ range: string; values: string[][] }>) {
  if (!data.length) return;
  await sheets().spreadsheets.values.batchUpdate({
    spreadsheetId: schoolIntakeSpreadsheetId,
    requestBody: { valueInputOption: "RAW", data: data.map((item) => ({ range: item.range, values: item.values })) },
  });
}

export async function readIntakeWeekLocks() {
  const rows = await readIntakeTab("Khóa tuần", "F", 1000);
  const latest = new Map<string, { weekStart: string; locked: boolean; by: string; at: string }>();
  for (const row of rows.slice(1)) {
    if (!weekStartOf(row[0] || "") || weekStartOf(row[0]) !== row[0]) continue;
    latest.set(row[0], { weekStart: row[0], locked: row[1] === "LOCKED", by: row[2] || "", at: row[3] || "" });
  }
  return latest;
}

export async function setIntakeWeekLock(weekStart: string, locked: boolean, actor: string) {
  const input = (await sheets().spreadsheets.get({
    spreadsheetId: schoolIntakeSpreadsheetId,
    fields: "sheets(properties(sheetId,title),protectedRanges(protectedRangeId,description))",
  })).data.sheets?.find((item) => item.properties?.title === "Nhập lịch");
  if (input?.properties?.sheetId == null) throw new Error("Không tìm thấy tab Nhập lịch.");
  const tag = `INTAKE_WEEK_LOCK:${weekStart}`;
  const existing = (input.protectedRanges || []).filter((item) => item.description === tag && item.protectedRangeId != null);
  const requests: object[] = existing.map((item) => ({ deleteProtectedRange: { protectedRangeId: item.protectedRangeId } }));
  if (locked) {
    const rows = (await readIntakeTab("Nhập lịch", "T", intakeInputLastRow)).slice(intakeInputFirstDataRow - 1);
    const numbers = rows.flatMap((values, index) => weekStartOf(values[1] || "") === weekStart ? [index + intakeInputFirstDataRow] : []);
    const groups: Array<{ first: number; last: number }> = [];
    for (const number of numbers) {
      const last = groups.at(-1);
      if (last && last.last + 1 === number) last.last = number;
      else groups.push({ first: number, last: number });
    }
    const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    if (!serviceEmail) throw new Error("Thiếu tài khoản tích hợp để khóa tuần.");
    for (const group of groups) requests.push({ addProtectedRange: { protectedRange: {
      range: { sheetId: input.properties.sheetId, startRowIndex: group.first - 1, endRowIndex: group.last, startColumnIndex: 1, endColumnIndex: 12 },
      description: tag,
      warningOnly: false,
      editors: { users: [serviceEmail] },
    } } });
  }
  if (requests.length) await sheets().spreadsheets.batchUpdate({ spreadsheetId: schoolIntakeSpreadsheetId, requestBody: { requests } });
  await appendIntakeRows("Khóa tuần", "F", [[weekStart, locked ? "LOCKED" : "UNLOCKED", actor, new Date().toISOString(), String(requests.length), ""]]);
}

export async function replaceIntakeCatalog(rows: string[][], schoolNames: string[], counts: { schools: number; classes: number; periods: number }) {
  if (!rows.length || !schoolNames.length || rows.some((row) => row.length !== 17)) throw new Error("Danh mục METTASOUL chưa đủ dữ liệu để đồng bộ.");
  const metadata = await sheets().spreadsheets.get({
    spreadsheetId: schoolIntakeSpreadsheetId,
    fields: "sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))",
  });
  const catalog = metadata.data.sheets?.find((sheet) => sheet.properties?.title === "Danh mục")?.properties;
  const input = metadata.data.sheets?.find((sheet) => sheet.properties?.title === "Nhập lịch")?.properties;
  const overview = metadata.data.sheets?.find((sheet) => sheet.properties?.title === "Tổng quan")?.properties;
  if (catalog?.sheetId == null || input?.sheetId == null || overview?.sheetId == null || !catalog.gridProperties?.rowCount || !input.gridProperties?.rowCount || rows.length >= catalog.gridProperties.rowCount) {
    throw new Error("Cấu trúc Sheet nhập lịch không khớp hoặc danh mục vượt quá số dòng hiện có.");
  }
  const previous = (await readIntakeTab("Danh mục", "Q", catalog.gridProperties.rowCount)).slice(1);
  const normalized = (row: string[]) => Array.from({ length: 17 }, (_, index) => row[index] || "");
  const changed = JSON.stringify(previous.map(normalized)) !== JSON.stringify(rows.map(normalized));
  const now = new Date();
  const stamp = `${new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now)}.${String(now.getMilliseconds()).padStart(3, "0")}`;
  const requests: object[] = [];
  if (changed) {
    requests.push({ updateCells: {
      start: { sheetId: catalog.sheetId, rowIndex: 1, columnIndex: 0 },
      rows: rows.map((row) => ({ values: row.map((value) => ({ userEnteredValue: { stringValue: value } })) })),
      fields: "userEnteredValue",
    } });
    if (previous.length > rows.length) requests.push({ repeatCell: {
      range: { sheetId: catalog.sheetId, startRowIndex: rows.length + 1, endRowIndex: previous.length + 1, startColumnIndex: 0, endColumnIndex: 17 },
      cell: {}, fields: "userEnteredValue",
    } });
    requests.push({ setDataValidation: {
      range: { sheetId: input.sheetId, startRowIndex: intakeInputFirstDataRow - 1, endRowIndex: input.gridProperties.rowCount, startColumnIndex: 2, endColumnIndex: 3 },
      rule: { condition: { type: "ONE_OF_LIST", values: schoolNames.map((name) => ({ userEnteredValue: name })) }, strict: true, showCustomUi: true, inputMessage: "Chỉ chọn trường có đủ lớp và khung giờ trong METTASOUL." },
    } });
    requests.push({ setDataValidation: {
      range: { sheetId: input.sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 5, endColumnIndex: 6 },
      rule: { condition: { type: "ONE_OF_LIST", values: ["Tất cả", ...schoolNames].map((name) => ({ userEnteredValue: name })) }, strict: true, showCustomUi: true, inputMessage: "Lọc theo trường đã đồng bộ từ METTASOUL." },
    } });
  }
  requests.push({ updateCells: {
    start: { sheetId: overview.sheetId, rowIndex: 20, columnIndex: 1 },
    rows: [
      { values: [{ userEnteredValue: { stringValue: stamp } }] },
      { values: [{ userEnteredValue: { stringValue: `${counts.schools} trường · ${counts.classes} lớp · ${counts.periods} khung giờ` } }] },
    ],
    fields: "userEnteredValue",
  } });
  await sheets().spreadsheets.batchUpdate({ spreadsheetId: schoolIntakeSpreadsheetId, requestBody: { requests } });
  return { ...counts, changed, syncedAt: stamp };
}

export function parseIntakeSourceRow(values: string[], number: number): IntakeSourceRow & { number: number } {
  return {
    number,
    rowId: String(values[0] || "").trim(),
    date: String(values[1] || "").trim(),
    school: String(values[2] || "").trim(),
    grade: String(values[3] || "").trim(),
    className: String(values[4] || "").trim(),
    session: String(values[5] || "").trim(),
    periodLabel: String(values[6] || "").trim(),
    start: String(values[7] || "").trim(),
    end: String(values[8] || "").trim(),
    environment: String(values[9] || "").trim(),
    intakeStatus: String(values[10] || "").trim() as IntakeSourceRow["intakeStatus"],
    sourceNote: String(values[11] || "").trim(),
    id: String(values[17] || "").trim(),
  };
}

export function intakeFingerprint(rows: IntakeSourceRow[]) {
  const values = rows.map((row) => [row.rowId, row.id || "", row.date || "", row.school || "", row.grade || "", row.className || "", row.session || "", row.periodLabel || "", row.start || "", row.end || "", row.environment || "", row.intakeStatus, row.sourceNote || ""]);
  values.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return createHash("sha256").update(JSON.stringify(values)).digest("hex");
}

export function dateKey(value: string) {
  const raw = String(value || "").trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  const vi = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  const key = iso ? `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}` : vi ? `${vi[3]}-${vi[2].padStart(2, "0")}-${vi[1].padStart(2, "0")}` : "";
  if (!key) return "";
  const date = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === key ? key : "";
}

export function weekStartOf(value: string) {
  const key = dateKey(value);
  if (!key) return "";
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function parseIntakeBatch(row: string[], number: number): IntakeBatch {
  return { number, id: row[0] || "", school: row[1] || "", weekStart: row[2] || "", fingerprint: row[3] || "", status: row[4] || "", count: Number(row[5] || 0), submittedBy: row[10] || "", submittedAt: row[11] || "", approvedBy: row[12] || "", approvedAt: row[13] || "", note: row[14] || "", revision: row[17] || "", raw: row };
}

export function snapshotSourceRow(values: string[]): IntakeSourceRow {
  return { rowId: values[1] || "", date: values[2] || "", school: values[3] || "", grade: values[4] || "", className: values[5] || "", session: values[6] || "", periodLabel: values[7] || "", start: values[8] || "", end: values[9] || "", environment: values[10] || "", intakeStatus: (values[11] || "") as IntakeSourceRow["intakeStatus"], sourceNote: values[12] || "", id: values[13] || "" };
}
