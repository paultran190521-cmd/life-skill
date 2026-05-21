import { Readable } from "node:stream";
import { google } from "googleapis";

let driveClient: ReturnType<typeof google.drive> | null = null;

function getDriveClient() {
  if (driveClient) {
    return driveClient;
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = normalizePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);

  if (!email || !key) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.");
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

export async function uploadLessonPlanToDrive({
  fileName,
  mimeType,
  buffer,
  scheduleId,
}: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  scheduleId: string;
}) {
  const folderId = process.env.GOOGLE_DRIVE_LESSON_PLANS_FOLDER_ID;
  if (!folderId) {
    throw new Error("Missing GOOGLE_DRIVE_LESSON_PLANS_FOLDER_ID.");
  }

  const response = await getDriveClient().files.create({
    fields: "id, webViewLink",
    requestBody: {
      name: `${scheduleId}-${fileName}`,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
  });

  const fileId = response.data.id;
  if (!fileId) {
    throw new Error("Google Drive did not return a file id.");
  }

  return {
    driveFileId: fileId,
    driveUrl: response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
  };
}

function normalizePrivateKey(value: string | undefined) {
  if (!value) {
    return "";
  }

  let key = value.trim().replace(/^\uFEFF/, "");
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }

  key = key.replace(/\\n/g, "\n").trim();
  if (!key.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is not a valid private key.");
  }

  return `${key}\n`;
}
