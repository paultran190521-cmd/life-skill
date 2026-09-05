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
  Topic,
  User,
  WeeklyUpdate,
} from "@/lib/types";

type SheetName =
  | "Users"
  | "Teachers"
  | "Schools"
  | "Classes"
  | "Topics"
  | "Lessons"
  | "TimeSlots"
  | "Schedules"
  | "LessonPlans"
  | "Attendance"
  | "Notifications"
  | "AuditLogs"
  | "AppAnnouncements"
  | "WeeklyUpdates"
  | "MailDebug";

export type { SheetName };

type SheetRow = Record<string, string>;

let sheetsClient: ReturnType<typeof google.sheets> | null = null;
const headerCache = new Map<SheetName, { headers: string[]; expiresAt: number }>();
const rowCache = new Map<SheetName, { rows: SheetRow[]; expiresAt: number }>();

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

export async function readSheetRowsCached(
  sheetName: SheetName,
  options?: {
    ttlMs?: number;
    forceRefresh?: boolean;
  },
) {
  if (!isFeatureEnabled("SHEETS_ROW_CACHE_ENABLED", true)) {
    return readSheetRows(sheetName);
  }

  const ttlMs = options?.ttlMs ?? readPositiveIntEnv("SHEETS_ROW_CACHE_TTL_MS", 60_000);
  if (ttlMs <= 0 || options?.forceRefresh) {
    const freshRows = await readSheetRows(sheetName);
    rowCache.set(sheetName, { rows: freshRows, expiresAt: Date.now() + Math.max(ttlMs, 1) });
    return freshRows;
  }

  const cached = rowCache.get(sheetName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rows.map((row) => ({ ...row }));
  }

  const freshRows = await readSheetRows(sheetName);
  rowCache.set(sheetName, { rows: freshRows, expiresAt: Date.now() + ttlMs });
  return freshRows;
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
  invalidateSheetRowsCache(sheetName);
}

export async function appendSheetRowWithHeaders(
  sheetName: SheetName,
  requiredHeaders: string[],
  row: Record<string, unknown>,
) {
  // Thu tu cot phai lay tu chinh Google Sheet, khong dung thu tu hardcode cua caller.
  // ensureSheetHeaders them cot moi vao CUOI hang header, nen neu ghi theo thu tu
  // hardcode thi du lieu se lech cot (su co LessonPlans: uploadedAt <-> source).
  const sheetHeaders = await ensureSheetHeaders(sheetName, requiredHeaders);
  const values = sheetHeaders.map((header) => stringifyCell(row[header]));

  await getSheetsClient().spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: quoteSheetName(sheetName),
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
  invalidateSheetRowsCache(sheetName);
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
    setHeaderCache(sheetName, headers);
    return headers;
  }

  const nextHeaders = [...headers, ...missingHeaders];
  await client.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `${quoteSheetName(sheetName)}!A1:${columnName(nextHeaders.length)}1`,
    valueInputOption: "RAW",
    requestBody: { values: [nextHeaders] },
  });
  setHeaderCache(sheetName, nextHeaders);

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
  invalidateSheetRowsCache(sheetName);
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
  invalidateSheetRowsCache(sheetName);
}

export async function updateSheetRowsById(
  sheetName: SheetName,
  updates: Array<{ id: string; patch: Record<string, unknown> }>,
) {
  if (updates.length === 0) {
    return;
  }

  const client = getSheetsClient();
  const response = await client.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: quoteSheetName(sheetName),
  });

  const values = response.data.values || [];
  const rawHeaders = (values[0] || []).map(String);
  const headers = rawHeaders.map((header) => normalizeSheetHeader(header));
  const rowIndexesById = new Map<string, number>();
  values.forEach((row, index) => {
    if (index > 0) {
      rowIndexesById.set(String(row[0] || ""), index);
    }
  });

  const data = updates.map(({ id, patch }) => {
    const rowIndex = rowIndexesById.get(id);
    if (rowIndex === undefined) {
      throw new Error(`Cannot find row ${id} in ${sheetName}.`);
    }
    const currentRow = values[rowIndex] || [];
    const nextRow = headers.map((header, index) =>
      Object.prototype.hasOwnProperty.call(patch, header) ? stringifyCell(patch[header]) : String(currentRow[index] ?? ""),
    );
    const sheetRowNumber = rowIndex + 1;
    return {
      range: `${quoteSheetName(sheetName)}!A${sheetRowNumber}:${columnName(rawHeaders.length)}${sheetRowNumber}`,
      values: [nextRow],
    };
  });

  await client.spreadsheets.values.batchUpdate({
    spreadsheetId: spreadsheetId(),
    requestBody: {
      valueInputOption: "RAW",
      data,
    },
  });
  invalidateSheetRowsCache(sheetName);
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
  invalidateSheetRowsCache(sheetName);
}

/**
 * Xóa nhiều dòng theo id trong cùng một batch request. Xóa từ dưới lên để
 * chỉ số dòng không bị thay đổi khi Google Sheets xử lý các deleteDimension.
 */
export async function deleteSheetRowsByIds(sheetName: SheetName, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.map((id) => String(id || "").trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return 0;
  }

  const client = getSheetsClient();
  const response = await client.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: quoteSheetName(sheetName),
  });
  const idSet = new Set(uniqueIds);
  const rowIndexes = (response.data.values || [])
    .map((row, index) => ({ id: String(row[0] || "").trim(), index }))
    .filter(({ id, index }) => index > 0 && idSet.has(id))
    .map(({ index }) => index)
    .sort((left, right) => right - left);

  if (rowIndexes.length === 0) {
    return 0;
  }

  const sheetMeta = await client.spreadsheets.get({
    spreadsheetId: spreadsheetId(),
    fields: "sheets(properties(sheetId,title))",
  });
  const sheetId = sheetMeta.data.sheets?.find((sheet) => sheet.properties?.title === sheetName)?.properties?.sheetId;
  if (sheetId === undefined) {
    throw new Error(`Cannot find sheet metadata for ${sheetName}.`);
  }

  await client.spreadsheets.batchUpdate({
    spreadsheetId: spreadsheetId(),
    requestBody: {
      requests: rowIndexes.map((rowIndex) => ({
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 },
        },
      })),
    },
  });
  invalidateSheetRowsCache(sheetName);
  return rowIndexes.length;
}

/**
 * Xóa toàn bộ dữ liệu trong sheet nhưng giữ nguyên hàng header (row 1).
 * Thử deleteDimension trước, nếu lỗi thì fallback sang values.clear.
 */
export async function clearSheetData(sheetName: SheetName) {
  const client = getSheetsClient();

  // Đếm số dòng dữ liệu hiện có
  const dataResponse = await client.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: quoteSheetName(sheetName),
  });
  const allValues = dataResponse.data.values || [];
  const dataRowCount = Math.max(0, allValues.length - 1);

  if (dataRowCount === 0) {
    return 0;
  }

  // Thử xóa bằng deleteDimension (xóa hẳn dòng)
  try {
    const sheetMeta = await client.spreadsheets.get({
      spreadsheetId: spreadsheetId(),
      fields: "sheets(properties(sheetId,title,gridProperties(rowCount)))",
    });

    const targetSheet = sheetMeta.data.sheets?.find((sheet) => sheet.properties?.title === sheetName);
    const sheetId = targetSheet?.properties?.sheetId;
    const rowCount = targetSheet?.properties?.gridProperties?.rowCount ?? 0;

    if (sheetId != null && rowCount > 1) {
      await client.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId(),
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: "ROWS",
                  startIndex: 1,
                  endIndex: rowCount,
                },
              },
            },
          ],
        },
      });
      invalidateSheetRowsCache(sheetName);
      return dataRowCount;
    }
  } catch (deleteError) {
    console.warn(
      `[clearSheetData] deleteDimension failed for ${sheetName}, falling back to values.clear:`,
      deleteError instanceof Error ? deleteError.message : deleteError,
    );
  }

  // Fallback: xóa giá trị ô (dòng rỗng sẽ bị toRows lọc bỏ)
  await client.spreadsheets.values.clear({
    spreadsheetId: spreadsheetId(),
    range: `${quoteSheetName(sheetName)}!A2:ZZ`,
  });

  invalidateSheetRowsCache(sheetName);
  return dataRowCount;
}

export async function getAppDataFromSheets() {
  const [
    teachers,
    users,
    schools,
    classes,
    topics,
    lessons,
    timeSlots,
    schedules,
    lessonPlans,
    attendance,
    notifications,
    appAnnouncements,
    auditLogs,
    weeklyUpdates,
  ] = await Promise.all([
    readSheetRows("Teachers").then(toTeachers),
    readSheetRows("Users").then(toUsers),
    readSheetRows("Schools").then(toSchools),
    readSheetRows("Classes").then(toClasses),
    ensureSheetHeaders("Topics", topicHeaders)
      .then(() => readSheetRows("Topics").then(toTopics))
      .catch(() => [] as Topic[]),
    readSheetRows("Lessons").then(toLessons),
    readSheetRows("TimeSlots").then(toTimeSlots),
    readSheetRows("Schedules").then(toSchedules),
    readSheetRows("LessonPlans").then(toLessonPlans),
    readSheetRows("Attendance").then(toAttendance),
    readSheetRows("Notifications").then(toNotifications),
    ensureSheetHeaders("AppAnnouncements", appAnnouncementHeaders)
      .then(() => readSheetRows("AppAnnouncements").then(toAppAnnouncements))
      .catch(() => [] as AppAnnouncement[]),
    readSheetRows("AuditLogs").then(toAuditLogs).catch(() => [] as AuditLog[]),
    ensureSheetHeaders("WeeklyUpdates", weeklyUpdateHeaders)
      .then(() => readSheetRows("WeeklyUpdates").then(toWeeklyUpdates))
      .catch(() => [] as WeeklyUpdate[]),
  ]);

  return {
    teachers,
    users,
    schools,
    classes,
    topics,
    lessons,
    timeSlots,
    schedules,
    lessonPlans,
    attendance,
    notifications,
    appAnnouncements,
    auditLogs,
    weeklyUpdates,
  };
}

export const lessonHeaders = [
  "id",
  "topicId",
  "grade",
  "title",
  "objective",
  "objectives",
  "durationMinutes",
  "sortOrder",
  "active",
  "createdAt",
  "updatedAt",
  "samplePlanUrl",
];

export const scheduleHeaders = [
  "id",
  "date",
  "teacherId",
  "schoolId",
  "classId",
  "lessonId",
  "timeSlotId",
  "status",
  "sentAt",
  "confirmedAt",
  "reassignedFrom",
  "cancelledAt",
  "createdBy",
  "createdAt",
  "updatedAt",
  "teachingEnvironment",
  "groupId",
  "assistantIds",
];

export const topicHeaders = [
  "id",
  "grade",
  "title",
  "description",
  "active",
  "createdAt",
  "updatedAt",
];

export const weeklyUpdateHeaders = [
  "id",
  "weekNumber",
  "updateDate",
  "schoolId",
  "classId",
  "teachingHours",
  "updatedBy",
  "note",
  "createdAt",
  "updatedAt",
];

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
  if (isFeatureEnabled("SHEETS_HEADER_CACHE_ENABLED", true)) {
    const cached = headerCache.get(sheetName);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.headers;
    }
  }

  const response = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${quoteSheetName(sheetName)}!1:1`,
  });

  const headers = (response.data.values?.[0] || []).map((header) => normalizeSheetHeader(header));
  if (headers.length === 0) {
    throw new Error(`${sheetName} is missing a header row.`);
  }

  setHeaderCache(sheetName, headers);
  return headers;
}

function invalidateSheetRowsCache(sheetName: SheetName) {
  rowCache.delete(sheetName);
}

function setHeaderCache(sheetName: SheetName, headers: string[]) {
  if (!isFeatureEnabled("SHEETS_HEADER_CACHE_ENABLED", true)) {
    headerCache.delete(sheetName);
    return;
  }

  const ttlMs = readPositiveIntEnv("SHEETS_HEADER_CACHE_TTL_MS", 300_000);
  headerCache.set(sheetName, {
    headers: [...headers],
    expiresAt: Date.now() + ttlMs,
  });
}

function isFeatureEnabled(key: string, fallback: boolean) {
  const raw = String(process.env[key] ?? "").trim().toLowerCase();
  if (!raw) {
    return fallback;
  }
  return ["1", "true", "yes", "on", "enabled"].includes(raw);
}

function readPositiveIntEnv(key: string, fallback: number) {
  const value = Number(process.env[key] || fallback);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
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
    topicid: "topicId",
    objectives: "objectives",
    sortorder: "sortOrder",
    groupid: "groupId",
    assistantids: "assistantIds",
    weeknumber: "weekNumber",
    updatedate: "updateDate",
    teachinghours: "teachingHours",
    updatedby: "updatedBy",
    description: "description",
    targetuserid: "targetUserId",
    cancelledat: "cancelledAt",
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
    role: row.role === "teacher" || row.role === "assistant" ? row.role : "admin",
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
    topicId: row.topicId || undefined,
    grade: row.grade,
    title: row.title,
    objective: row.objective,
    objectives: row.objectives || undefined,
    durationMinutes: Number(row.durationMinutes || 45),
    sortOrder: row.sortOrder ? Number(row.sortOrder) : undefined,
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
    groupId: row.groupId || undefined,
    assistantIds: row.assistantIds || undefined,
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

function toTopics(rows: SheetRow[]): Topic[] {
  return rows.map((row) => ({
    id: row.id,
    grade: row.grade,
    title: row.title,
    description: row.description || undefined,
    active: parseBoolean(row.active, true),
  }));
}

function toWeeklyUpdates(rows: SheetRow[]): WeeklyUpdate[] {
  return rows.map((row) => ({
    id: row.id,
    weekNumber: Number(row.weekNumber || 0),
    updateDate: row.updateDate,
    schoolId: row.schoolId,
    classId: row.classId,
    teachingHours: Number(row.teachingHours || 0),
    updatedBy: row.updatedBy || "",
    note: row.note || undefined,
    createdAt: row.createdAt,
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
  const allowed: TeachingEnvironment[] = ["in_class", "outdoor", "gym", "schoolyard_report", "hall"];
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
