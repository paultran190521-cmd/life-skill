import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import {
  appAnnouncementHeaders,
  appendSheetRowWithHeaders,
  ensureSheetHeaders,
  readSheetRows,
} from "@/lib/google-sheets";
import type { AppAnnouncementPriority } from "@/lib/types";

export async function GET() {
  try {
    await ensureSheetHeaders("AppAnnouncements", appAnnouncementHeaders);
    return NextResponse.json(await readSheetRows("AppAnnouncements"));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await ensureSheetHeaders("AppAnnouncements", appAnnouncementHeaders);
    const body = await request.json();
    const title = String(body.title || "").trim();
    const announcementBody = String(body.body || "").trim();

    if (!title || !announcementBody) {
      return NextResponse.json({ error: "Tiêu đề và nội dung thông báo là bắt buộc." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const announcement = {
      id: String(body.id || createId("ann")),
      title,
      body: announcementBody,
      priority: normalizePriority(body.priority),
      active: body.active ?? true,
      createdBy: String(body.createdBy || "").trim(),
      createdAt: String(body.createdAt || now),
      updatedAt: now,
    };

    await appendSheetRowWithHeaders("AppAnnouncements", appAnnouncementHeaders, announcement);
    return NextResponse.json(announcement);
  } catch (error) {
    return apiError(error);
  }
}

function normalizePriority(value: unknown): AppAnnouncementPriority {
  return value === "important_not_urgent" ? "important_not_urgent" : "important_urgent";
}
