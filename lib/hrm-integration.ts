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

export type HrmTeachingResponse = {
  ok: boolean;
  code?: string;
  message?: string;
  eventId?: string;
  idempotencyKey?: string;
  workLogId?: string;
  money?: number;
  currency?: string;
  policyVersion?: string;
  idempotent?: boolean;
};

export function hrmIntegrationConfigured() {
  return integrationEnabled() && Boolean(webhookUrl() && webhookSecret());
}

export async function submitTeachingPeriodToHrm(payload: TeachingPeriodPayload) {
  return sendSignedPayload(payload);
}

async function sendSignedPayload(payload: Record<string, unknown>): Promise<HrmTeachingResponse> {
  if (!integrationEnabled()) {
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
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: "1", timestamp, nonce, payload: payloadText, signature }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw integrationFailure("HRM_UNREACHABLE", error instanceof Error ? error.message : "Không thể kết nối HRM.");
  }
  let result: HrmTeachingResponse;
  try {
    result = await response.json() as HrmTeachingResponse;
  } catch {
    throw integrationFailure("HRM_INVALID_RESPONSE", `HRM trả về dữ liệu không hợp lệ (${response.status}).`);
  }
  if (!response.ok || !result.ok) {
    throw integrationFailure(result.code || "HRM_REJECTED", result.message || `HRM từ chối yêu cầu (${response.status}).`);
  }
  return result;
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

function integrationFailure(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}
