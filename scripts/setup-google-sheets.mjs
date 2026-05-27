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
    title: "Lessons",
    headers: ["id", "grade", "title", "objective", "durationMinutes", "samplePlanUrl", "active", "createdAt", "updatedAt"],
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
      "timeSlotId",
      "teachingEnvironment",
      "status",
      "sentAt",
      "confirmedAt",
      "reassignedFrom",
      "cancelledAt",
      "createdBy",
      "createdAt",
      "updatedAt",
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
    title: "AuditLogs",
    headers: ["id", "actorId", "actorEmail", "action", "entityType", "entityId", "metadata", "createdAt"],
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

  await sheetsApi.spreadsheets.values.batchUpdate({
    spreadsheetId: targetSpreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: SHEETS.map((sheet) => ({
        range: quoteSheetName(sheet.title) + "!A1:" + columnName(sheet.headers.length) + "1",
        values: [sheet.headers],
      })),
    },
  });

  const formatRequests = SHEETS.flatMap((sheet) => {
    const sheetId = sheetIdByTitle.get(sheet.title);
    if (sheetId === undefined) {
      return [];
    }

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
            endColumnIndex: sheet.headers.length,
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
            endIndex: sheet.headers.length,
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

  console.log(`Updated headers for ${SHEETS.length} tabs.`);
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
