import { google } from "googleapis";
import { getAvatarUrl } from "@/lib/avatar";
import type {
  Attendance,
  ChatMessage,
  ChatThread,
  ClassRoom,
  Lesson,
  LessonPlan,
  Notification,
  Role,
  Schedule,
  ScheduleStatus,
  School,
  Teacher,
  User,
} from "@/lib/types";

type SheetName =
  | "Users"
  | "Teachers"
  | "Schools"
  | "Classes"
  | "Lessons"
  | "TimeSlots"
  | "Schedules"
  | "LessonPlans"
  | "Attendance"
  | "ChatThreads"
  | "ChatMessages"
  | "Notifications"
  | "AuditLogs";

type SheetRow = Record<string, string>;

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

function getSheetsClient() {
  if (sheetsClient) {
    return sheetsClient;
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = normalizePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);

  if (!email || !key) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.");
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

function normalizePrivateKey(value: string | undefined) {
  if (!value) {
    return "";
  }

  let key = value.trim().replace(/^\uFEFF/, "");

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  key = key.replace(/\\n/g, "\n").trim();

  if (!key.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is not a valid private key.");
  }

  return `${key}\n`;
}

function spreadsheetId() {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id) {
    throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID.");
  }
  return id;
}

export async function readSheetRows(sheetName: SheetName) {
  const response = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: quoteSheetName(sheetName),
  });

  const values = response.data.values || [];
  const [headers = [], ...rows] = values;

  return rows
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) =>
      headers.reduce<SheetRow>((record, header, index) => {
        record[String(header)] = String(row[index] ?? "");
        return record;
      }, {}),
    );
}

export async function readSheetRowById(sheetName: SheetName, id: string) {
  const rows = await readSheetRows(sheetName);
  return rows.find((row) => row.id === id) || null;
}

export async function appendSheetRow(sheetName: SheetName, row: Record<string, unknown>) {
  const headers = await getHeaders(sheetName);
  const values = headers.map((header) => stringifyCell(row[header]));

  await getSheetsClient().spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: quoteSheetName(sheetName),
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

export async function appendSheetRows(sheetName: SheetName, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    return;
  }

  const headers = await getHeaders(sheetName);
  const values = rows.map((row) => headers.map((header) => stringifyCell(row[header])));

  await getSheetsClient().spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: quoteSheetName(sheetName),
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
}

export async function updateSheetRowById(sheetName: SheetName, id: string, patch: Record<string, unknown>) {
  const client = getSheetsClient();
  const response = await client.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: quoteSheetName(sheetName),
  });

  const values = response.data.values || [];
  const headers = (values[0] || []).map(String);
  const rowIndex = values.findIndex((row, index) => index > 0 && String(row[0] || "") === id);

  if (rowIndex === -1) {
    throw new Error(`Cannot find row ${id} in ${sheetName}.`);
  }

  const currentRow = values[rowIndex] || [];
  const nextRow = headers.map((header, index) =>
    Object.prototype.hasOwnProperty.call(patch, header) ? stringifyCell(patch[header]) : String(currentRow[index] ?? ""),
  );

  const sheetRowNumber = rowIndex + 1;
  await client.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `${quoteSheetName(sheetName)}!A${sheetRowNumber}:${columnName(headers.length)}${sheetRowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [nextRow] },
  });
}

export async function deleteSheetRowById(sheetName: SheetName, id: string) {
  const client = getSheetsClient();
  const response = await client.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: quoteSheetName(sheetName),
  });

  const values = response.data.values || [];
  const rowIndex = values.findIndex((row, index) => index > 0 && String(row[0] || "") === id);

  if (rowIndex === -1) {
    throw new Error(`Cannot find row ${id} in ${sheetName}.`);
  }

  const sheetMeta = await client.spreadsheets.get({
    spreadsheetId: spreadsheetId(),
    fields: "sheets(properties(sheetId,title))",
  });

  const targetSheet = sheetMeta.data.sheets?.find((sheet) => sheet.properties?.title === sheetName);
  const sheetId = targetSheet?.properties?.sheetId;

  if (sheetId === undefined) {
    throw new Error(`Cannot find sheet metadata for ${sheetName}.`);
  }

  await client.spreadsheets.batchUpdate({
    spreadsheetId: spreadsheetId(),
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });
}

export async function getAppDataFromSheets() {
  const [
    teachers,
    users,
    schools,
    classes,
    lessons,
    timeSlots,
    schedules,
    lessonPlans,
    attendance,
    chatThreads,
    chatMessages,
    notifications,
  ] = await Promise.all([
    readSheetRows("Teachers").then(toTeachers),
    readSheetRows("Users").then(toUsers),
    readSheetRows("Schools").then(toSchools),
    readSheetRows("Classes").then(toClasses),
    readSheetRows("Lessons").then(toLessons),
    readSheetRows("TimeSlots").then(toTimeSlots),
    readSheetRows("Schedules").then(toSchedules),
    readSheetRows("LessonPlans").then(toLessonPlans),
    readSheetRows("Attendance").then(toAttendance),
    readSheetRows("ChatThreads").then(toChatThreads),
    readSheetRows("ChatMessages").then(toChatMessages),
    readSheetRows("Notifications").then(toNotifications),
  ]);

  return {
    teachers,
    users,
    schools,
    classes,
    lessons,
    timeSlots,
    schedules,
    lessonPlans,
    attendance,
    chatThreads,
    chatMessages,
    notifications,
  };
}

async function getHeaders(sheetName: SheetName) {
  const response = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${quoteSheetName(sheetName)}!1:1`,
  });

  const headers = (response.data.values?.[0] || []).map(String);
  if (headers.length === 0) {
    throw new Error(`${sheetName} is missing a header row.`);
  }

  return headers;
}

function toUsers(rows: SheetRow[]): User[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role === "teacher" ? "teacher" : "admin",
    teacherId: row.teacherId || undefined,
    avatarUrl: row.avatarUrl || getAvatarUrl(row.email, row.name),
    isActive: parseBoolean(row.isActive, true),
  }));
}

function toTeachers(rows: SheetRow[]): Teacher[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatarUrl || getAvatarUrl(row.email, row.name),
    specialty: row.specialty,
    active: parseBoolean(row.active, true),
  }));
}

function toSchools(rows: SheetRow[]): School[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    district: row.district,
  }));
}

function toClasses(rows: SheetRow[]): ClassRoom[] {
  return rows.map((row) => ({
    id: row.id,
    schoolId: row.schoolId,
    name: row.name,
    grade: row.grade,
  }));
}

function toLessons(rows: SheetRow[]): Lesson[] {
  return rows.map((row) => ({
    id: row.id,
    grade: row.grade,
    title: row.title,
    objective: row.objective,
    durationMinutes: Number(row.durationMinutes || 45),
    samplePlanUrl: row.samplePlanUrl || undefined,
    active: parseBoolean(row.active, true),
  }));
}

function toTimeSlots(rows: SheetRow[]) {
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    start: row.start,
    end: row.end,
  }));
}

function toSchedules(rows: SheetRow[]): Schedule[] {
  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    teacherId: row.teacherId,
    schoolId: row.schoolId,
    classId: row.classId,
    lessonId: row.lessonId,
    timeSlotId: row.timeSlotId,
    status: (row.status || "sent") as ScheduleStatus,
    sentAt: row.sentAt || undefined,
    confirmedAt: row.confirmedAt || undefined,
    reassignedFrom: row.reassignedFrom || undefined,
  }));
}

function toLessonPlans(rows: SheetRow[]): LessonPlan[] {
  return rows.map((row) => ({
    id: row.id,
    scheduleId: row.scheduleId,
    teacherId: row.teacherId,
    fileName: row.fileName,
    driveFileId: row.driveFileId || undefined,
    driveUrl: row.driveUrl,
    uploadedAt: row.uploadedAt,
  }));
}

function toAttendance(rows: SheetRow[]): Attendance[] {
  return rows.map((row) => ({
    id: row.id,
    scheduleId: row.scheduleId,
    teacherId: row.teacherId,
    checkedInAt: row.checkedInAt,
  }));
}

function toChatThreads(rows: SheetRow[]): ChatThread[] {
  return rows.map((row) => ({
    id: row.id,
    type: row.type === "schedule" ? "schedule" : "teacher",
    teacherId: row.teacherId,
    scheduleId: row.scheduleId || undefined,
    title: row.title,
  }));
}

function toChatMessages(rows: SheetRow[]): ChatMessage[] {
  return rows.map((row) => ({
    id: row.id,
    threadId: row.threadId,
    senderId: row.senderId,
    senderName: row.senderName,
    senderRole: (row.senderRole || "admin") as Role,
    body: row.body,
    createdAt: row.createdAt,
  }));
}

function toNotifications(rows: SheetRow[]): Notification[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    role: (row.role || "all") as Role | "all",
    createdAt: row.createdAt,
    read: parseBoolean(row.read, false),
  }));
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  return ["true", "1", "yes", "active"].includes(value.toLowerCase());
}

function stringifyCell(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

function quoteSheetName(title: string) {
  return `'${title.replaceAll("'", "''")}'`;
}

function columnName(columnCount: number) {
  let columnNameValue = "";
  let dividend = columnCount;

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnNameValue = String.fromCharCode(65 + modulo) + columnNameValue;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return columnNameValue;
}
