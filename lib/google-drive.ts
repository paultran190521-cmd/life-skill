import { google } from "googleapis";

let driveAuth: InstanceType<typeof google.auth.JWT> | null = null;
let driveClient: ReturnType<typeof google.drive> | null = null;

function getDriveAuth() {
  if (driveAuth) {
    return driveAuth;
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = normalizePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);

  if (!email || !key) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.");
  }

  driveAuth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return driveAuth;
}

function getDriveClient() {
  if (driveClient) {
    return driveClient;
  }

  driveClient = google.drive({ version: "v3", auth: getDriveAuth() });
  return driveClient;
}

export async function createLessonPlanUploadSession({
  fileName,
  mimeType,
  fileSize,
  scheduleId,
}: {
  fileName: string;
  mimeType: string;
  fileSize: number;
  scheduleId: string;
}) {
  const folderId = process.env.GOOGLE_DRIVE_LESSON_PLANS_FOLDER_ID;
  if (!folderId) {
    throw new Error("Missing GOOGLE_DRIVE_LESSON_PLANS_FOLDER_ID.");
  }

  const token = await getAccessToken();
  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": String(fileSize),
      },
      body: JSON.stringify({
        name: `${scheduleId}-${fileName}`,
        parents: [folderId],
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Cannot create Google Drive upload session: ${response.status}`);
  }

  const uploadUrl = response.headers.get("location");
  if (!uploadUrl) {
    throw new Error("Google Drive did not return an upload session URL.");
  }

  return { uploadUrl };
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
  const response = await getDriveClient().files.create({
    fields: "id, webViewLink",
    requestBody: {
      name: `${scheduleId}-${fileName}`,
      parents: [driveFolderId()],
    },
    media: {
      mimeType,
      body: Buffer.from(buffer),
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

async function getAccessToken() {
  const response = await getDriveAuth().getAccessToken();
  const token = typeof response === "string" ? response : response?.token;
  if (!token) {
    throw new Error("Cannot get Google Drive access token.");
  }
  return token;
}

function driveFolderId() {
  const folderId = process.env.GOOGLE_DRIVE_LESSON_PLANS_FOLDER_ID;
  if (!folderId) {
    throw new Error("Missing GOOGLE_DRIVE_LESSON_PLANS_FOLDER_ID.");
  }
  return folderId;
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
