import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const webhookUrl = process.env.GAS_UPLOAD_WEBHOOK_URL || process.env.GAS_MAIL_WEBHOOK_URL;
    const secret = process.env.GAS_UPLOAD_WEBHOOK_SECRET || process.env.GAS_MAIL_WEBHOOK_SECRET;

    if (!webhookUrl || !secret) {
      throw new Error("Missing GAS upload webhook configuration.");
    }

    const body = await request.json();
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=utf-8" },
      body: JSON.stringify({
        ...body,
        action: "uploadLessonPlan",
        secret,
      }),
    });

    const responseText = await response.text();
    const result = parseGasResponse(responseText) as {
      ok?: boolean;
      error?: string;
      lessonPlan?: unknown;
      schedule?: unknown;
    };

    if (!response.ok || !result.ok) {
      throw new Error(result.error || gasResponseError(response.status, responseText));
    }
    if (!result.lessonPlan) {
      throw new Error("GAS đã phản hồi OK nhưng thiếu lessonPlan. Hãy cập nhật và deploy lại Apps Script bản mới nhất.");
    }

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}

function parseGasResponse(responseText: string) {
  try {
    return JSON.parse(responseText);
  } catch {
    return {};
  }
}

function gasResponseError(status: number, responseText: string) {
  const text = responseText.trim();
  if (!text) {
    return `GAS upload webhook trả về rỗng với HTTP ${status}. Hãy kiểm tra Apps Script deployment và quyền truy cập Web App.`;
  }
  if (text.startsWith("<")) {
    return [
      `GAS upload webhook trả về HTML với HTTP ${status}, không phải JSON.`,
      "Thường là Web App chưa để quyền Anyone, URL /exec sai, hoặc Apps Script chưa deploy phiên bản mới.",
    ].join(" ");
  }
  return `GAS upload webhook trả về dữ liệu không hợp lệ với HTTP ${status}: ${text.slice(0, 300)}`;
}
