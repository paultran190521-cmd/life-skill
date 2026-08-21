import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { google } from "googleapis";

const SHEETS = [
  {
    title: "Users",
    headers: [
      "id",
      "name",
      "email",
      "role",
      "teacherId",
      "avatarUrl",
      "isActive",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    title: "Teachers",
    headers: [
      "id",
      "name",
      "email",
      "phone",
      "avatarUrl",
      "specialty",
      "active",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    title: "Schools",
    headers: ["id", "name", "district", "address", "contactName", "contactPhone", "createdAt", "updatedAt"],
  },
  {
    title: "Classes",
    headers: ["id", "schoolId", "name", "grade", "academicYear", "createdAt", "updatedAt"],
  },
  {
    title: "Topics",
    headers: ["id", "grade", "title", "description", "active", "createdAt", "updatedAt"],
  },
  {
    title: "Lessons",
    headers: ["id", "topicId", "grade", "title", "lesson1Title", "lesson1Objective", "lesson2Title", "lesson2Objective", "objective", "objectives", "durationMinutes", "sortOrder", "active", "createdAt", "updatedAt", "samplePlanUrl"],
  },
  {
    title: "TimeSlots",
    headers: ["id", "label", "start", "end", "active", "createdAt", "updatedAt"],
  },
  {
    title: "Schedules",
    headers: [
      "id",
      "date",
      "teacherId",
      "schoolId",
      "classId",
      "lessonId",
      "lessonPeriods",
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
    ],
  },
  {
    title: "LessonPlans",
    headers: [
      "id",
      "scheduleId",
      "teacherId",
      "fileName",
      "driveFileId",
      "driveUrl",
      "uploadedAt",
      "createdAt",
      "updatedAt",
      "source",
    ],
  },
  {
    title: "Attendance",
    headers: ["id", "scheduleId", "teacherId", "checkedInAt", "note", "createdAt", "updatedAt"],
  },
  {
    title: "Notifications",
    headers: ["id", "title", "body", "role", "targetUserId", "read", "createdAt", "updatedAt"],
  },
  {
    title: "AppAnnouncements",
    headers: ["id", "title", "body", "priority", "active", "createdBy", "createdAt", "updatedAt"],
  },
  {
    title: "AuditLogs",
    headers: ["id", "actorId", "actorEmail", "action", "entityType", "entityId", "metadata", "createdAt"],
  },
  {
    title: "WeeklyUpdates",
    headers: ["id", "weekNumber", "updateDate", "schoolId", "classId", "teachingHours", "updatedBy", "note", "createdAt", "updatedAt"],
  },
  {
    title: "MailDebug",
    headers: [
      "id",
      "requestId",
      "source",
      "provider",
      "event",
      "to",
      "subject",
      "sent",
      "reason",
      "errorCode",
      "templateVersion",
      "gasVersion",
      "httpStatus",
      "scheduleIds",
      "teacherId",
      "htmlDigest",
      "inputHtmlDigest",
      "normalizedHtmlDigest",
      "htmlPreview",
      "createdAt",
    ],
  },
];

loadEnvFile(".env");
loadEnvFile(".env.local");

const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const serviceAccountPrivateKey = normalizePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);

if (!serviceAccountEmail || !serviceAccountPrivateKey) {
  fail(
    [
      "Missing Google service account credentials.",
      "Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in .env.local.",
      "The private key can be pasted with \\n line breaks.",
    ].join("\n"),
  );
}

const auth = new google.auth.JWT({
  email: serviceAccountEmail,
  key: serviceAccountPrivateKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
});

const sheetsApi = google.sheets({ version: "v4", auth });
const driveApi = google.drive({ version: "v3", auth });

let spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
let spreadsheetUrl = "";

if (!spreadsheetId) {
  const title = process.env.GOOGLE_SHEETS_TITLE || "HỌC VIỆN METTASOUL Database";
  const response = await sheetsApi.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [{ properties: { title: SHEETS[0].title } }],
    },
  });

  spreadsheetId = response.data.spreadsheetId;
  spreadsheetUrl = response.data.spreadsheetUrl || "";
  console.log(`Created spreadsheet: ${title}`);
  console.log(`GOOGLE_SHEETS_SPREADSHEET_ID=${spreadsheetId}`);
} else {
  const response = await sheetsApi.spreadsheets.get({ spreadsheetId });
  spreadsheetUrl = response.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  console.log(`Using spreadsheet: ${response.data.properties?.title || spreadsheetId}`);
}

await ensureSheetsAndHeaders(spreadsheetId);
await shareSpreadsheetIfRequested(spreadsheetId);

console.log("");
console.log("Google Sheets database is ready.");
console.log(`URL: ${spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`}`);
console.log("");
console.log("Next step: put this value in .env.local and Vercel Environment Variables:");
console.log(`GOOGLE_SHEETS_SPREADSHEET_ID=${spreadsheetId}`);

async function ensureSheetsAndHeaders(targetSpreadsheetId) {
  const spreadsheet = await sheetsApi.spreadsheets.get({ spreadsheetId: targetSpreadsheetId });
  const existingSheets = new Map(
    (spreadsheet.data.sheets || []).map((sheet) => [sheet.properties?.title, sheet.properties]),
  );

  const addSheetRequests = SHEETS.filter((sheet) => !existingSheets.has(sheet.title)).map((sheet) => ({
    addSheet: {
      properties: {
        title: sheet.title,
        gridProperties: {
          rowCount: 1000,
          columnCount: Math.max(sheet.headers.length, 10),
          frozenRowCount: 1,
        },
      },
    },
  }));

  if (addSheetRequests.length > 0) {
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: targetSpreadsheetId,
      requestBody: { requests: addSheetRequests },
    });
    console.log(`Created ${addSheetRequests.length} missing tabs.`);
  }

  const refreshed = await sheetsApi.spreadsheets.get({ spreadsheetId: targetSpreadsheetId });
  const sheetIdByTitle = new Map(
    (refreshed.data.sheets || []).map((sheet) => [sheet.properties?.title, sheet.properties?.sheetId]),
  );

  // QUAN TRONG: khong bao gio ghi de hang header cua tab da co du lieu.
  // Ghi de bang thu tu hardcode se lam lech toan bo cot ben duoi (header doi cho
  // nhung du lieu thi khong), pha huy du lieu that. Chi giu nguyen thu tu cot dang
  // co va them cac cot con thieu vao CUOI - dung dung quy uoc cua
  // ensureSheetHeaders() trong lib/google-sheets.ts.
  const existingHeaderRows = await sheetsApi.spreadsheets.values.batchGet({
    spreadsheetId: targetSpreadsheetId,
    ranges: SHEETS.map((sheet) => quoteSheetName(sheet.title) + "!1:1"),
  });

  const headerUpdates = [];
  const headersByTitle = new Map();

  SHEETS.forEach((sheet, index) => {
    const currentHeaders = (existingHeaderRows.data.valueRanges?.[index]?.values?.[0] || [])
      .map((header) => String(header || "").trim())
      .filter(Boolean);

    if (currentHeaders.length === 0) {
      // Tab moi hoac chua co header -> ghi bo header chuan.
      headersByTitle.set(sheet.title, sheet.headers);
      headerUpdates.push({
        range: quoteSheetName(sheet.title) + "!A1:" + columnName(sheet.headers.length) + "1",
        values: [sheet.headers],
      });
      return;
    }

    const missingHeaders = sheet.headers.filter((header) => !currentHeaders.includes(header));
    const nextHeaders = [...currentHeaders, ...missingHeaders];
    headersByTitle.set(sheet.title, nextHeaders);

    if (missingHeaders.length === 0) {
      return;
    }

    console.log(`  ${sheet.title}: them cot moi -> ${missingHeaders.join(", ")}`);
    headerUpdates.push({
      range: quoteSheetName(sheet.title) + "!A1:" + columnName(nextHeaders.length) + "1",
      values: [nextHeaders],
    });
  });

  if (headerUpdates.length > 0) {
    await sheetsApi.spreadsheets.values.batchUpdate({
      spreadsheetId: targetSpreadsheetId,
      requestBody: { valueInputOption: "RAW", data: headerUpdates },
    });
    console.log(`Updated headers for ${headerUpdates.length} tabs.`);
  } else {
    console.log("Headers already up to date, nothing to change.");
  }

  const formatRequests = SHEETS.flatMap((sheet) => {
    const sheetId = sheetIdByTitle.get(sheet.title);
    if (sheetId === undefined) {
      return [];
    }

    const columnCount = (headersByTitle.get(sheet.title) || sheet.headers).length;

    return [
      {
        updateSheetProperties: {
          properties: {
            sheetId,
            gridProperties: { frozenRowCount: 1 },
          },
          fields: "gridProperties.frozenRowCount",
        },
      },
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: columnCount,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.09, green: 0.57, blue: 0.69 },
              textFormat: {
                foregroundColor: { red: 1, green: 1, blue: 1 },
                bold: true,
              },
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat)",
        },
      },
      {
        autoResizeDimensions: {
          dimensions: {
            sheetId,
            dimension: "COLUMNS",
            startIndex: 0,
            endIndex: columnCount,
          },
        },
      },
    ];
  });

  if (formatRequests.length > 0) {
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: targetSpreadsheetId,
      requestBody: { requests: formatRequests },
    });
  }

}

async function shareSpreadsheetIfRequested(targetSpreadsheetId) {
  const shareWithEmail = process.env.GOOGLE_SHEETS_SHARE_WITH_EMAIL?.trim();
  if (!shareWithEmail) {
    return;
  }

  await driveApi.permissions.create({
    fileId: targetSpreadsheetId,
    sendNotificationEmail: true,
    requestBody: {
      type: "user",
      role: "writer",
      emailAddress: shareWithEmail,
    },
  });

  console.log(`Shared spreadsheet with ${shareWithEmail}.`);
}

function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function normalizePrivateKey(value) {
  return value?.replace(/\\n/g, "\n");
}

function quoteSheetName(title) {
  return `'${title.replaceAll("'", "''")}'`;
}

function columnName(columnCount) {
  let columnNameValue = "";
  let dividend = columnCount;

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnNameValue = String.fromCharCode(65 + modulo) + columnNameValue;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return columnNameValue;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
