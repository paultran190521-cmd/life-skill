import { NextResponse } from "next/server";
import { runPreClassAttendanceAlerts } from "@/lib/pre-class-attendance-alerts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runPreClassAttendanceAlerts();
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    console.error("[pre-class-attendance] Scan failed", error);
    return NextResponse.json({ error: "Alert scan failed" }, { status: 500 });
  }
}
