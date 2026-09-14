import { google } from "googleapis";
import { Readable } from "node:stream";

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

export async function trashDriveFileById(fileId: string) {
  if (!fileId) {
    return;
  }

  try {
    await getDriveClient().files.update({
      fileId,
      requestBody: { trashed: true },
      supportsAllDrives: true,
    });
  } catch (error) {
    if (isGoogleApiStatus(error, 404)) {
      return;
    }
    throw error;
  }
}

export async function uploadLessonPlanChatFile(input: {
  lessonPlanId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}) {
  const parentId = String(process.env.GOOGLE_DRIVE_LESSON_PLAN_CHAT_FOLDER_ID || "1CoRFcMAFz0zk_OooXkiIdNKZ_j0QgAIF").trim();

  const drive = getDriveClient();
  const folderName = `lesson-plan-${input.lessonPlanId}`;
  const existing = await drive.files.list({
    q: `'${parentId.replaceAll("'", "\\'")}' in parents and name = '${folderName.replaceAll("'", "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const folderId = existing.data.files?.[0]?.id || (await drive.files.create({
    requestBody: { name: folderName, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id",
    supportsAllDrives: true,
  })).data.id;
  if (!folderId) {
    throw new Error("Cannot create lesson-plan chat folder in Google Drive.");
  }

  const file = await drive.files.create({
    requestBody: { name: input.fileName, parents: [folderId] },
    media: { mimeType: input.mimeType || "application/octet-stream", body: Readable.from(input.bytes) },
    fields: "id,webViewLink,webContentLink,size,mimeType",
    supportsAllDrives: true,
  });
  if (!file.data.id) {
    throw new Error("Google Drive did not return an uploaded file ID.");
  }
  return {
    id: file.data.id,
    url: file.data.webViewLink || `https://drive.google.com/file/d/${file.data.id}/view`,
    sizeBytes: Number(file.data.size || input.bytes.byteLength),
    mimeType: file.data.mimeType || input.mimeType,
  };
}

function isGoogleApiStatus(error: unknown, status: number) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    Number((error as { code?: unknown }).code) === status
  );
}
