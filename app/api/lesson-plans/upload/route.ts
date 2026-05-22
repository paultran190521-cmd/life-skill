import { NextResponse } from "next/server";
import type { LessonPlan } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const GAS_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 2;

type UploadRequestBody = {
  scheduleId: string;
  teacherId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileData: string;
};

type GasUploadResponse = {
  ok?: boolean;
  error?: string;
  errorCode?: string;
  message?: string;
  requestId?: string;
  lessonPlan?: LessonPlan;
  schedule?: unknown;
};

class UploadProxyError extends Error {
  status: number;
  errorCode: string;
  requestId: string;

  constructor(message: string, options: { status?: number; errorCode?: string; requestId: string }) {
    super(message);
    this.status = options.status ?? 500;
    this.errorCode = options.errorCode ?? "UPLOAD_PROXY_ERROR";
    this.requestId = options.requestId;
  }
}

export async function POST(request: Request) {
  const requestId = `lp-${crypto.randomUUID()}`;
  try {
    const webhookUrl = process.env.GAS_UPLOAD_WEBHOOK_URL || process.env.GAS_MAIL_WEBHOOK_URL;
    const secret = process.env.GAS_UPLOAD_WEBHOOK_SECRET || process.env.GAS_MAIL_WEBHOOK_SECRET;

    if (!webhookUrl || !secret) {
      throw new UploadProxyError("Missing GAS upload webhook configuration on server.", {
        status: 500,
        errorCode: "UPLOAD_WEBHOOK_CONFIG_MISSING",
        requestId,
      });
    }

    const body = parseUploadBody(await request.json(), requestId);
    const result = await callGasUploadWebhook({ webhookUrl, secret, requestId, body });

    if (!result.lessonPlan) {
      throw new UploadProxyError(
        `GAS replied without lessonPlan data. Request ID: ${requestId}`,
        {
          status: 502,
          errorCode: "GAS_LESSON_PLAN_MISSING",
          requestId,
        },
      );
    }

    return NextResponse.json({
      ok: true,
      requestId,
      lessonPlan: result.lessonPlan,
      schedule: result.schedule,
    });
  } catch (error) {
    if (error instanceof UploadProxyError) {
      return NextResponse.json(
        {
          error: error.message,
          errorCode: error.errorCode,
          requestId: error.requestId,
        },
        { status: error.status },
      );
    }

    const message = error instanceof Error ? error.message : "Unexpected upload proxy error.";
    return NextResponse.json(
      {
        error: `${message} Request ID: ${requestId}`,
        errorCode: "UPLOAD_PROXY_UNEXPECTED",
        requestId,
      },
      { status: 500 },
    );
  }
}

function parseUploadBody(raw: unknown, requestId: string): UploadRequestBody {
  if (!raw || typeof raw !== "object") {
    throw new UploadProxyError(`Invalid upload payload. Request ID: ${requestId}`, {
      status: 400,
      errorCode: "INVALID_UPLOAD_PAYLOAD",
      requestId,
    });
  }

  const body = raw as Record<string, unknown>;
  const scheduleId = String(body.scheduleId || "").trim();
  const teacherId = String(body.teacherId || "").trim();
  const fileName = String(body.fileName || "").trim();
  const mimeType = String(body.mimeType || "application/octet-stream").trim();
  const fileSize = Number(body.fileSize || 0);
  const fileData = String(body.fileData || "").trim();

  if (!scheduleId || !teacherId || !fileName || !fileData) {
    throw new UploadProxyError(`Missing required upload fields. Request ID: ${requestId}`, {
      status: 400,
      errorCode: "UPLOAD_FIELDS_MISSING",
      requestId,
    });
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new UploadProxyError(`Invalid file size. Request ID: ${requestId}`, {
      status: 400,
      errorCode: "UPLOAD_FILE_SIZE_INVALID",
      requestId,
    });
  }
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw new UploadProxyError(`Lesson plan file exceeds 10 MB limit. Request ID: ${requestId}`, {
      status: 413,
      errorCode: "UPLOAD_FILE_TOO_LARGE",
      requestId,
    });
  }

  return { scheduleId, teacherId, fileName, mimeType, fileSize, fileData };
}

async function callGasUploadWebhook(params: {
  webhookUrl: string;
  secret: string;
  requestId: string;
  body: UploadRequestBody;
}) {
  const payload = {
    action: "uploadLessonPlan",
    secret: params.secret,
    requestId: params.requestId,
    ...params.body,
  };

  let lastError: UploadProxyError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(params.webhookUrl, params.requestId, {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const responseText = await response.text();
      const result = parseGasResponse(response.status, responseText, params.requestId);

      if (response.ok && result.ok) {
        return result;
      }

      const mapped = createMappedGasError(
        response.status,
        result.errorCode,
        result.error || result.message || "Unknown GAS upload error.",
        params.requestId,
      );

      if (attempt < MAX_ATTEMPTS && shouldRetry(response.status, mapped.errorCode)) {
        lastError = mapped;
        continue;
      }

      throw mapped;
    } catch (error) {
      if (error instanceof UploadProxyError) {
        if (attempt < MAX_ATTEMPTS && shouldRetry(error.status, error.errorCode)) {
          lastError = error;
          continue;
        }
        throw error;
      }

      const networkError = createMappedGasError(
        502,
        "GAS_NETWORK_ERROR",
        error instanceof Error ? error.message : "Cannot reach GAS upload webhook.",
        params.requestId,
      );
      if (attempt < MAX_ATTEMPTS) {
        lastError = networkError;
        continue;
      }
      throw networkError;
    }
  }

  throw (
    lastError ||
    new UploadProxyError(`Upload failed after retry. Request ID: ${params.requestId}`, {
      status: 502,
      errorCode: "GAS_RETRY_EXHAUSTED",
      requestId: params.requestId,
    })
  );
}

async function fetchWithTimeout(url: string, requestId: string, init: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GAS_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new UploadProxyError(`GAS upload timeout after ${GAS_TIMEOUT_MS}ms.`, {
        status: 504,
        errorCode: "GAS_TIMEOUT",
        requestId,
      });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseGasResponse(status: number, responseText: string, requestId: string): GasUploadResponse {
  const text = responseText.trim();
  if (!text) {
    return {
      ok: false,
      errorCode: "GAS_EMPTY_RESPONSE",
      error: `GAS upload webhook returned an empty body. HTTP ${status}.`,
      requestId,
    };
  }

  if (text.startsWith("<")) {
    return {
      ok: false,
      errorCode: "GAS_HTML_RESPONSE",
      error: `GAS upload webhook returned HTML instead of JSON. HTTP ${status}.`,
      requestId,
    };
  }

  try {
    const result = JSON.parse(text) as GasUploadResponse;
    return { ...result, requestId: result.requestId || requestId };
  } catch {
    return {
      ok: false,
      errorCode: "GAS_INVALID_JSON",
      error: `GAS upload webhook returned invalid JSON. HTTP ${status}.`,
      requestId,
    };
  }
}

function createMappedGasError(status: number, errorCode: string | undefined, rawMessage: string, requestId: string) {
  const mappedCode = errorCode || "GAS_UPLOAD_FAILED";
  const fallbackMessage = rawMessage || "Unknown GAS upload error.";
  const baseMessage =
    mapGasErrorMessage(mappedCode) ||
    (status >= 500
      ? "GAS upload service is temporarily unavailable."
      : fallbackMessage);
  const message = `${baseMessage} Request ID: ${requestId}`;
  return new UploadProxyError(message, { status: mapStatus(status, mappedCode), errorCode: mappedCode, requestId });
}

function mapGasErrorMessage(errorCode: string) {
  switch (errorCode) {
    case "UNAUTHORIZED":
      return "Upload request is unauthorized. Please verify GAS webhook secret.";
    case "UPLOAD_FIELDS_MISSING":
      return "Upload request is missing required fields.";
    case "PAYLOAD_TOO_LARGE":
    case "UPLOAD_FILE_TOO_LARGE":
      return "Lesson plan file is too large. Maximum supported size is 10 MB.";
    case "DRIVE_PERMISSION_DENIED":
      return "GAS deployment is missing Drive permission. Re-authorize DriveApp and deploy a new version.";
    case "DRIVE_FOLDER_NOT_FOUND":
      return "Configured Google Drive folder was not found or is inaccessible.";
    case "SCHEDULE_NOT_FOUND":
      return "Schedule was not found when updating upload status.";
    case "SHEET_APPEND_FAILED":
    case "SHEET_UPDATE_FAILED":
      return "GAS cannot update Google Sheets right now.";
    case "GAS_TIMEOUT":
      return "GAS upload timed out. Please retry.";
    case "GAS_NETWORK_ERROR":
      return "Cannot reach GAS upload service. Please retry.";
    default:
      return "";
  }
}

function mapStatus(status: number, errorCode: string) {
  if (status >= 400 && status <= 599) {
    return status;
  }

  switch (errorCode) {
    case "UNAUTHORIZED":
      return 401;
    case "UPLOAD_FIELDS_MISSING":
      return 400;
    case "UPLOAD_FILE_TOO_LARGE":
    case "PAYLOAD_TOO_LARGE":
      return 413;
    case "DRIVE_PERMISSION_DENIED":
      return 500;
    case "SCHEDULE_NOT_FOUND":
      return 404;
    default:
      return 502;
  }
}

function shouldRetry(status: number, errorCode: string) {
  if (errorCode === "GAS_TIMEOUT" || errorCode === "GAS_NETWORK_ERROR") {
    return true;
  }
  return [408, 429, 500, 502, 503, 504].includes(status);
}
