import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { appendSheetRows, readSheetRows } from "@/lib/google-sheets";
import type { Notification } from "@/lib/types";

export async function GET() {
  try {
    return NextResponse.json(await readSheetRows("Notifications"));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const rawNotifications = Array.isArray(body?.notifications)
      ? body.notifications
      : Array.isArray(body)
        ? body
        : [body];

    const notifications = rawNotifications.map((item: Record<string, unknown>) => ({
      id: String(item.id || createId("n")),
      title: String(item.title || "Thông báo").trim(),
      body: String(item.body || "").trim(),
      role: normalizeRole(item.role),
      createdAt: String(item.createdAt || now),
      read: item.read ?? false,
      updatedAt: now,
    }));

    await appendSheetRows("Notifications", notifications);
    return NextResponse.json({ notifications });
  } catch (error) {
    return apiError(error);
  }
}

function normalizeRole(role: unknown): Notification["role"] {
  return role === "admin" || role === "teacher" || role === "all" ? role : "all";
}
