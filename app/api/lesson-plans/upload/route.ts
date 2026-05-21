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
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        ...body,
        action: "uploadLessonPlan",
        secret,
      }),
    });

    const result = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      lessonPlan?: unknown;
      schedule?: unknown;
    };

    if (!response.ok || !result.ok) {
      throw new Error(result.error || `GAS upload webhook failed: ${response.status}`);
    }

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
