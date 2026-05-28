import { NextResponse } from "next/server";
import { apiError, createRequestId } from "@/lib/api";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";
import { forbiddenError } from "@/lib/app-error";
import { readSheetRows } from "@/lib/google-sheets";

type ServiceStatus = {
  status: "ok" | "degraded" | "down";
  reason: string;
};

export async function GET(request: Request) {
  const requestId = createRequestId("health");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_healthcheck");
    if (!permission.allowed) {
      throw forbiddenError();
    }

    const [sheets, gasMail, emailProvider] = await Promise.all([
      checkSheets(),
      checkGasMail(),
      checkEmailProvider(),
    ]);

    const statuses = [sheets.status, gasMail.status, emailProvider.status];
    const status = statuses.includes("down") ? "down" : statuses.includes("degraded") ? "degraded" : "ok";

    return NextResponse.json({
      status,
      checkedAt: new Date().toISOString(),
      requestId,
      services: {
        sheets,
        gas_mail: gasMail,
        email_provider: emailProvider,
      },
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}

async function checkSheets(): Promise<ServiceStatus> {
  try {
    await readSheetRows("Users");
    return { status: "ok", reason: "Google Sheets đọc được dữ liệu." };
  } catch {
    return { status: "down", reason: "Không thể đọc Google Sheets." };
  }
}

async function checkGasMail(): Promise<ServiceStatus> {
  const webhookUrl = process.env.GAS_MAIL_WEBHOOK_URL || process.env.GAS_UPLOAD_WEBHOOK_URL;
  const secret = process.env.GAS_MAIL_WEBHOOK_SECRET || process.env.GAS_UPLOAD_WEBHOOK_SECRET;

  if (!webhookUrl || !secret) {
    return { status: "degraded", reason: "Thiếu cấu hình GAS webhook." };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "ping",
        secret,
      }),
    });
    const parsed = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    if (!response.ok || !parsed?.ok) {
      return { status: "degraded", reason: "GAS ping lỗi hoặc phản hồi không hợp lệ." };
    }
    return { status: "ok", reason: "GAS webhook phản hồi bình thường." };
  } catch {
    return { status: "degraded", reason: "Không kết nối được GAS webhook." };
  }
}

async function checkEmailProvider(): Promise<ServiceStatus> {
  const provider = process.env.EMAIL_PROVIDER === "gas" ? "gas" : "resend";
  if (provider === "gas") {
    const hasConfig = Boolean(
      (process.env.GAS_MAIL_WEBHOOK_URL || process.env.GAS_UPLOAD_WEBHOOK_URL) &&
        (process.env.GAS_MAIL_WEBHOOK_SECRET || process.env.GAS_UPLOAD_WEBHOOK_SECRET),
    );
    return hasConfig
      ? { status: "ok", reason: "Provider email GAS đã đủ cấu hình." }
      : { status: "degraded", reason: "Provider GAS thiếu webhook URL hoặc secret." };
  }

  const hasResendConfig = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  return hasResendConfig
    ? { status: "ok", reason: "Provider Resend đã đủ cấu hình." }
    : { status: "degraded", reason: "Provider Resend thiếu API key hoặc EMAIL_FROM." };
}
