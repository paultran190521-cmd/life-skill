import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { canonicalSchoolTimeSlotLabel } from "../lib/school-time-slot-names.ts";
import { normalizeTimeSlotLabel } from "../lib/time-slots.ts";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const { google } = require("googleapis");
const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets(properties(sheetId,title))" });
const timeSlotsSheetId = metadata.data.sheets.find((sheet) => sheet.properties.title === "TimeSlots")?.properties.sheetId;
const auditSheetId = metadata.data.sheets.find((sheet) => sheet.properties.title === "AuditLogs")?.properties.sheetId;
if (timeSlotsSheetId === undefined || auditSheetId === undefined) throw new Error("Thiếu tab TimeSlots hoặc AuditLogs.");
const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: "TimeSlots!A1:G250" });
const values = response.data.values || [];
if (JSON.stringify(values[0]?.slice(0, 7)) !== JSON.stringify(["id", "label", "start", "end", "active", "createdAt", "updatedAt"])) {
  throw new Error("Cột TimeSlots đã thay đổi; dừng để kiểm tra.");
}
const slots = values.slice(1).map((row, index) => ({ row: index + 2, id: row[0] || "", label: row[1] || "", start: row[2] || "", end: row[3] || "", active: row[4] === "true" }));
const changes = slots.filter((slot) => slot.id && slot.active).map((slot) => ({ ...slot, next: canonicalSchoolTimeSlotLabel(slot, slots) }))
  .filter((slot) => slot.next !== slot.label);
const changedById = new Map(changes.map((slot) => [slot.id, slot.next]));
const names = new Map();
for (const slot of slots.filter((item) => item.id)) {
  const label = changedById.get(slot.id) || slot.label;
  const key = normalizeTimeSlotLabel(label);
  const existing = names.get(key);
  if (existing) throw new Error(`Tên bị trùng sau khi chuẩn hóa: ${existing} / ${slot.id} (${label})`);
  names.set(key, slot.id);
}
console.log(JSON.stringify({ count: changes.length, changes: changes.map(({ id, label, next, start, end }) => ({ id, before: label, after: next, start, end })) }, null, 2));
if (!process.argv.includes("--apply") || !changes.length) process.exit(0);

// Read the affected cells again immediately before applying the batch.
const latest = await sheets.spreadsheets.values.get({ spreadsheetId, range: "TimeSlots!A1:G250" });
for (const slot of changes) {
  const row = latest.data.values?.[slot.row - 1] || [];
  if (row[0] !== slot.id || row[1] !== slot.label || row[2] !== slot.start || row[3] !== slot.end || row[4] !== "true") {
    throw new Error(`TimeSlots row ${slot.row} đã thay đổi; dừng ghi.`);
  }
}
const now = new Date().toISOString();
const cell = (value) => ({ userEnteredValue: { stringValue: value } });
const requests = changes.flatMap((slot) => [
  { updateCells: { range: { sheetId: timeSlotsSheetId, startRowIndex: slot.row - 1, endRowIndex: slot.row, startColumnIndex: 1, endColumnIndex: 2 }, rows: [{ values: [cell(slot.next)] }], fields: "userEnteredValue" } },
  { updateCells: { range: { sheetId: timeSlotsSheetId, startRowIndex: slot.row - 1, endRowIndex: slot.row, startColumnIndex: 6, endColumnIndex: 7 }, rows: [{ values: [cell(now)] }], fields: "userEnteredValue" } },
]);
const audit = [
  `audit-${randomUUID()}`, "codex-data-migration", "", "time_slot.bulk_rename", "TimeSlot", "*",
  JSON.stringify({ source: "user_request", changedCount: changes.length, changes: changes.map(({ id, label, next }) => ({ id, before: label, after: next })) }),
  now,
];
requests.push({ appendCells: { sheetId: auditSheetId, rows: [{ values: audit.map(cell) }], fields: "userEnteredValue" } });
await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
const verified = await sheets.spreadsheets.values.get({ spreadsheetId, range: "TimeSlots!A1:G250" });
for (const slot of changes) {
  if (verified.data.values?.[slot.row - 1]?.[1] !== slot.next) throw new Error(`Chưa xác minh được ${slot.id}.`);
}
console.log(`Đã cập nhật và đọc lại ${changes.length} khung giờ; giữ nguyên ID và giờ học.`);
