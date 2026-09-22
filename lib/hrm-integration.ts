import { createHmac, randomUUID } from "node:crypto";

export type TeachingPeriodPayload = {
  source: "METTASOUL";
  action: "SUBMIT_TEACHING_PERIOD";
  eventId: string;
  idempotencyKey: string;
  scheduleId: string;
  periodId: string;
  userEmail: string;
  roleCode: "MAIN_TEACHER" | "CO_TEACHER" | "ASSISTANT";
  schoolId: string;
  schoolName: string;
  environmentCode: string;
  environmentName: string;
  classId: string;
  className: string;
  workDate: string;
  periodStartAt: string;
  periodEndAt: string;
};

export type ActivityCompletionPayload = {
  source: "METTASOUL";
  action: "SUBMIT_ACTIVITY_COMPLETION";
  eventId: string;
  idempotencyKey: string;
  activityId: string;
  assignmentId: string;
  activityTypeCode: string;
  activityTitle: string;
  userEmail: string;
  roleCode: string;
  unit: string;
  workDate: string;
  evidenceUrl?: string;
};

export type TeachingPeriodCancellationPayload = {
  source: "METTASOUL";
  action: "CANCEL_TEACHING_PERIOD";
  eventId: string;
  idempotencyKey: string;
  targetIdempotencyKey: string;
};

/** Minimal, non-payroll identity sent only when an administrator creates a teacher in METTASOUL. */
export type IdentityProvisionPayload = {
  source: "METTASOUL";
  action: "PROVISION_WORKER";
  eventId: string;
  idempotencyKey: string;
  userId: string;
  teacherId: string;
  name: string;
  userEmail: string;
  role: "teacher";
  avatarUrl?: string;
};

export type HrmTeachingResponse = {
  ok: boolean;
  code?: string;
  message?: string;
  eventId?: string;
  idempotencyKey?: string;
  workLogId?: string;
  money?: number;
  mcpPoints?: number;
  mcpLedgerId?: string;
  currency?: string;
  policyVersion?: string;
  schemaVersion?: number;
  idempotent?: boolean;
  userEmail?: string;
  created?: boolean;
  taskId?: string;
  taskName?: string;
};

export type HrmMcpLedgerEntry = {
  id: string;
  points: number;
  entryType: "CREDIT" | "REVERSAL";
  reasonCode: string;
  reasonName: string;
  schoolName: string;
  workDate: string;
  status: string;
  createdAt: string;
};

export type HrmMcpLedgerResponse = HrmTeachingResponse & {
  entries: HrmMcpLedgerEntry[];
};

export type HrmResponseDiagnostic = {
  status: number;
  contentType: string | null;
  redirected: boolean;
};

export type HrmNetworkDiagnostic = {
  errorName: string;
  errorMessage: string;
  causeCode?: string;
};

export function hrmIntegrationConfigured() {
  return integrationEnabled() && hrmIntegrationCredentialsConfigured();
}

/** Credentials permit a safe signed PING; this does not permit work-log writes. */
export function hrmIntegrationCredentialsConfigured() {
  return Boolean(webhookUrl() && webhookSecret());
}

export async function submitTeachingPeriodToHrm(payload: TeachingPeriodPayload) {
  return sendSignedPayload(payload);
}

export async function submitActivityCompletionToHrm(payload: ActivityCompletionPayload) {
  return sendSignedPayload(payload);
}

export async function cancelTeachingPeriodInHrm(payload: TeachingPeriodCancellationPayload) {
  return sendSignedPayload(payload);
}

/** HRM creates a non-password profile and assigns only its configured KNS teaching task. */
export async function provisionMettasoulTeacherInHrm(payload: IdentityProvisionPayload) {
  return sendSignedPayload(payload);
}

/** Performs a signed, read-only connectivity check. HRM does not create a work log for PING. */
export async function pingHrmIntegration() {
  const nonce = randomUUID();
  return sendSignedPayload({
    source: "METTASOUL",
    action: "PING",
    eventId: `MTS_PING_${nonce}`,
    idempotencyKey: `MTS_PING_${nonce}`,
  }, { requireEnabled: false });
}

/** HRM remains the MCP authority; this obtains only the signed, current user's ledger. */
export async function getMcpLedgerFromHrm(userEmail: string): Promise<HrmMcpLedgerResponse> {
  const nonce = randomUUID();
  return sendSignedPayload<HrmMcpLedgerResponse>({
    source: "METTASOUL",
    action: "GET_MCP_LEDGER",
    eventId: `MTS_MCP_${nonce}`,
    idempotencyKey: `MTS_MCP_${nonce}`,
    userEmail,
  }, { requireEnabled: false });
}

async function sendSignedPayload<T extends HrmTeachingResponse = HrmTeachingResponse>(
  payload: Record<string, unknown>,
  { requireEnabled = true }: { requireEnabled?: boolean } = {},
): Promise<T> {
  if (requireEnabled && !integrationEnabled()) {
    throw integrationFailure("HRM_INTEGRATION_DISABLED", "Kết nối HRM đang được quản trị viên giữ ở trạng thái tắt.");
  }
  const url = webhookUrl();
  const secret = webhookSecret();
  if (!url || !secret) {
    throw integrationFailure("HRM_NOT_CONFIGURED", "Kết nối HRM chưa được cấu hình trên máy chủ METTASOUL.");
  }
  const payloadText = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = randomUUID();
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${nonce}.${payloadText}`)
    .digest("hex");
  const envelopeText = JSON.stringify({ version: "1", timestamp, nonce, payload: payloadText, signature });
  let response: Response;
  try {
    response = await fetchHrmResponse(url, envelopeText);
  } catch (error) {
    throw integrationFailure(
      "HRM_UNREACHABLE",
      error instanceof Error ? error.message : "Không thể kết nối HRM.",
      networkDiagnostic(error),
    );
  }
  let result: T;
  try {
    result = await response.json() as T;
  } catch {
    throw integrationFailure(
      "HRM_INVALID_RESPONSE",
      `HRM trả về dữ liệu không hợp lệ (${response.status}).`,
      responseDiagnostic(response),
    );
  }
  if (!response.ok || !result.ok) {
    throw integrationFailure(result.code || "HRM_REJECTED", result.message || `HRM từ chối yêu cầu (${response.status}).`);
  }
  return result;
}

async function fetchHrmResponse(url: string, envelopeText: string) {
  const initialResponse = await fetchWithSingleRetry(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: envelopeText,
    cache: "no-store",
    redirect: "manual",
  });

  if (![301, 302, 303, 307, 308].includes(initialResponse.status)) {
    return initialResponse;
  }

  const location = initialResponse.headers.get("location");
  if (!location) {
    throw new Error("HRM_REDIRECT_MISSING_LOCATION");
  }
  const redirectUrl = new URL(location, url);
  if (!isAllowedHrmRedirect(url, redirectUrl)) {
    throw new Error("HRM_REDIRECT_REJECTED");
  }

  const preservePost = initialResponse.status === 307 || initialResponse.status === 308;
  return fetchWithSingleRetry(redirectUrl, {
    method: preservePost ? "POST" : "GET",
    headers: preservePost
      ? { Accept: "application/json", "Content-Type": "application/json" }
      : { Accept: "application/json" },
    body: preservePost ? envelopeText : undefined,
    cache: "no-store",
    redirect: "error",
  });
}

async function fetchWithSingleRetry(url: string | URL, init: RequestInit) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function isAllowedHrmRedirect(originalUrl: string, redirectUrl: URL) {
  const original = new URL(originalUrl);
  return original.protocol === "https:"
    && original.hostname === "script.google.com"
    && redirectUrl.protocol === "https:"
    && redirectUrl.hostname === "script.googleusercontent.com";
}

function webhookUrl() {
  return String(process.env.HRM_METTASOUL_WEBHOOK_URL || "").trim();
}

function webhookSecret() {
  return String(process.env.HRM_METTASOUL_WEBHOOK_SECRET || "").trim();
}

function integrationEnabled() {
  return String(process.env.HRM_METTASOUL_INTEGRATION_ENABLED || "").trim().toLowerCase() === "true";
}

function responseDiagnostic(response: Response): HrmResponseDiagnostic {
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    redirected: response.redirected,
  };
}

function networkDiagnostic(error: unknown): HrmNetworkDiagnostic {
  const causeCode = error && typeof error === "object" && "cause" in error
    ? String((error as { cause?: { code?: unknown } }).cause?.code || "")
    : "";
  return {
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorMessage: error instanceof Error ? error.message : "Không thể kết nối HRM.",
    ...(causeCode ? { causeCode } : {}),
  };
}

function integrationFailure(code: string, message: string, diagnostic?: HrmResponseDiagnostic | HrmNetworkDiagnostic) {
  return Object.assign(new Error(message), { code, diagnostic });
}
