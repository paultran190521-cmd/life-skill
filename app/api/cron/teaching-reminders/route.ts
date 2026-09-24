import { NextResponse } from "next/server";
import { runTeachingReminders } from "@/lib/teaching-reminders";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = String(process.env.CRON_SECRET || "").trim();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await runTeachingReminders("system:cron"));
}
