import { google } from "googleapis";
import { getAvatarUrl } from "@/lib/avatar";
import type {
  Attendance,
  AppAnnouncement,
  AppAnnouncementPriority,
  AuditLog,
  ClassRoom,
  Lesson,
  LessonPlan,
  Notification,
  Role,
  Schedule,
  ScheduleStatus,
  School,
  Teacher,
  TeachingEnvironment,
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
  | "Notifications"
  | "AuditLogs"
  | "AppAnnouncements"
  | "MailDebug";

export type { SheetName };

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

  return toRows(response.data.values || []);
}

export async function readSheetRowsBatch<T extends SheetName>(sheetNames: readonly T[]) {
  const uniqueNames = Array.from(new Set(sheetNames)) as T[];
  if (uniqueNames.length === 0) {
    return {} as Record<T, SheetRow[]>;
  }

  const response = await getSheetsClient().spreadsheets.values.batchGet({
    spreadsheetId: spreadsheetId(),
    ranges: uniqueNames.map((sheetName) => quoteSheetName(sheetName)),
  });

  const batches = response.data.valueRanges || [];
  const bySheet = {} as Record<T, SheetRow[]>;

  for (const [index, sheetName] of uniqueNames.entries()) {
    const values = batches[index]?.values ?? findBatchValuesBySheetName(batches, sheetName);
    bySheet[sheetName] = toRows(values || []);
  }

  return bySheet;
}

function findBatchValuesBySheetName(
  batches: Array<{ range?: string | null; values?: unknown[][] | null }>,
  sheetName: SheetName,
) {
  const expectedNames = new Set([sheetName, quoteSheetName(sheetName)]);
  return batches.find((batch) => {
    const title = String(batch.range || "").split("!")[0] || "";
    return expectedNames.has(title);
  })?.values;
}

export async function readSheetRowById(sheetName: SheetName, id: string) {
  const rows = await readSheetRows(sheetName);
  const targetId = String(id || "").trim();
  return rows.find((row) => String(row.id || "").trim() === targetId) || null;
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

export async function appendSheetRowWithHeaders(
  sheetName: SheetName,
  headers: string[],
  row: Record<string, unknown>,
) {
  const values = headers.map((header) => stringifyCell(row[header]));

  await getSheetsClient().spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: quoteSheetName(sheetName),
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

export async function ensureSheetHeaders(sheetName: SheetName, requiredHeaders: string[]) {
  await ensureSheetExists(sheetName, requiredHeaders.length);

  const client = getSheetsClient();
  const response = await client.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${quoteSheetName(sheetName)}!1:1`,
  });

  const headers = (response.data.values?.[0] || []).map((header) => normalizeSheetHeader(header));
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length === 0) {
    return headers;
  }

  const nextHeaders = [...headers, ...missingHeaders];
  await client.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `${quoteSheetName(sheetName)}!A1:${columnName(nextHeaders.length)}1`,
    valueInputOption: "RAW",
    requestBody: { values: [nextHeaders] },
  });

  return nextHeaders;
}

async function ensureSheetExists(sheetName: SheetName, minColumnCount: number) {
  const client = getSheetsClient();
  const response = await client.spreadsheets.get({
    spreadsheetId: spreadsheetId(),
    fields: "sheets(properties(title))",
  });
  const exists = response.data.sheets?.some((sheet) => sheet.properties?.title === sheetName);
  if (exists) {
    return;
  }

  await client.spreadsheets.batchUpdate({
    spreadsheetId: spreadsheetId(),
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,
              gridProperties: {
                rowCount: 1000,
                columnCount: Math.max(minColumnCount, 10),
                frozenRowCount: 1,
              },
            },
          },
        },
      ],
    },
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
  const rawHeaders = (values[0] || []).map(String);
  const headers = rawHeaders.map((header) => normalizeSheetHeader(header));
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
    range: `${quoteSheetName(sheetName)}!A${sheetRowNumber}:${columnName(rawHeaders.length)}${sheetRowNumber}`,
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
    notifications,
    appAnnouncements,
    auditLogs,
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
    readSheetRows("Notifications").then(toNotifications),
    ensureSheetHeaders("AppAnnouncements", appAnnouncementHeaders).then(() =>
      readSheetRows("AppAnnouncements").then(toAppAnnouncements),
    ),
    readSheetRows("AuditLogs").then(toAuditLogs),
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
    notifications,
    appAnnouncements,
    auditLogs,
  };
}

export const appAnnouncementHeaders = [
  "id",
  "title",
  "body",
  "priority",
  "active",
  "createdBy",
  "createdAt",
  "updatedAt",
];

async function getHeaders(sheetName: SheetName) {
  const response = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${quoteSheetName(sheetName)}!1:1`,
  });

  const headers = (response.data.values?.[0] || []).map((header) => normalizeSheetHeader(header));
  if (headers.length === 0) {
    throw new Error(`${sheetName} is missing a header row.`);
  }

  return headers;
}

function normalizeSheetHeader(value: unknown) {
  const raw = String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!raw) {
    return "";
  }

  const normalizedKey = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");

  const headerAliases: Record<string, string> = {
    id: "id",
    name: "name",
    email: "email",
    role: "role",
    priority: "priority",
    mucdo: "priority",
    douutien: "priority",
    teacherid: "teacherId",
    teachername: "teacherName",
    teacheremail: "teacherEmail",
    teacherphone: "teacherPhone",
    avatarurl: "avatarUrl",
    isactive: "isActive",
    active: "active",
    phone: "phone",
    specialty: "specialty",
    district: "district",
    address: "address",
    contactname: "contactName",
    contactphone: "contactPhone",
    schoolid: "schoolId",
    classid: "classId",
    lessonid: "lessonId",
    timeslotid: "timeSlotId",
    grade: "grade",
    khoi: "grade",
    title: "title",
    tieude: "title",
    baihoc: "title",
    tenbai: "title",
    tenbaihoc: "title",
    objective: "objective",
    muctieu: "objective",
    durationminutes: "durationMinutes",
    thoiluong: "durationMinutes",
    sampleplanurl: "samplePlanUrl",
    giaoanmau: "samplePlanUrl",
    label: "label",
    start: "start",
    end: "end",
    date: "date",
    teachingenvironment: "teachingEnvironment",
    status: "status",
    sentat: "sentAt",
    confirmedat: "confirmedAt",
    reassignedfrom: "reassignedFrom",
    scheduleid: "scheduleId",
    filename: "fileName",
    drivefileid: "driveFileId",
    driveurl: "driveUrl",
    source: "source",
    nguon: "source",
    linkngoai: "source",
    uploadedat: "uploadedAt",
    checkedinat: "checkedInAt",
    note: "note",
    body: "body",
    createdat: "createdAt",
    updatedat: "updatedAt",
    createdby: "createdBy",
    actorid: "actorId",
    actoremail: "actorEmail",
    action: "action",
    entitytype: "entityType",
    entityid: "entityId",
    metadata: "metadata",
    read: "read",
    academicyear: "academicYear",
  };

  return headerAliases[normalizedKey] || raw;
}

function toRows(values: unknown[][]): SheetRow[] {
  const [headers = [], ...rows] = values;
  const normalizedHeaders = headers.map((header) => normalizeSheetHeader(header));

  return rows
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) =>
      normalizedHeaders.reduce<SheetRow>((record, header, index) => {
        if (!header) {
          return record;
        }
        record[header] = String(row[index] ?? "");
        return record;
      }, {}),
    );
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
    id: String(row.id || "").trim(),
    label: row.label,
    start: row.start,
    end: row.end,
    active: parseBoolean(row.active ?? row.isActive, true),
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
    teachingEnvironment: parseTeachingEnvironment(row.teachingEnvironment),
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
    source: row.source === "external_link" ? "external_link" : "upload",
  }));
}

function toAttendance(rows: SheetRow[]): Attendance[] {
  return rows.map((row) => ({
    id: row.id,
    scheduleId: row.scheduleId,
    teacherId: row.teacherId,
    checkedInAt: row.checkedInAt,
    note: row.note || undefined,
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

function toAppAnnouncements(rows: SheetRow[]): AppAnnouncement[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    priority: parseAnnouncementPriority(row.priority),
    active: parseBoolean(row.active, true),
    createdBy: row.createdBy || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt || undefined,
  }));
}

function toAuditLogs(rows: SheetRow[]): AuditLog[] {
  return rows.map((row) => ({
    id: row.id,
    actorId: row.actorId,
    actorEmail: row.actorEmail,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: row.metadata || undefined,
    createdAt: row.createdAt,
  }));
}

function parseAnnouncementPriority(value: string | undefined): AppAnnouncementPriority {
  return value === "important_not_urgent" ? "important_not_urgent" : "important_urgent";
}

function parseTeachingEnvironment(value: string | undefined): TeachingEnvironment | undefined {
  const normalized = String(value || "").trim() as TeachingEnvironment;
  const allowed: TeachingEnvironment[] = ["in_class", "outdoor", "gym", "schoolyard_report"];
  return allowed.includes(normalized) ? normalized : undefined;
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
