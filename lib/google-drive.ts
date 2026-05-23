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

function isGoogleApiStatus(error: unknown, status: number) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    Number((error as { code?: unknown }).code) === status
  );
}
