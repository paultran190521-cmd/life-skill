import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { appAnnouncementHeaders, deleteSheetRowById, ensureSheetHeaders, updateSheetRowById } from "@/lib/google-sheets";
import type { AppAnnouncementPriority } from "@/lib/types";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    await ensureSheetHeaders("AppAnnouncements", appAnnouncementHeaders);
    const { id } = await params;
    const body = await request.json();
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (Object.prototype.hasOwnProperty.call(body, "title")) {
      const title = String(body.title || "").trim();
      if (!title) {
        return NextResponse.json({ error: "Tiêu đề thông báo là bắt buộc." }, { status: 400 });
      }
      patch.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(body, "body")) {
      const announcementBody = String(body.body || "").trim();
      if (!announcementBody) {
        return NextResponse.json({ error: "Nội dung thông báo là bắt buộc." }, { status: 400 });
      }
      patch.body = announcementBody;
    }

    if (Object.prototype.hasOwnProperty.call(body, "priority")) {
      patch.priority = normalizePriority(body.priority);
    }

    if (Object.prototype.hasOwnProperty.call(body, "active")) {
      patch.active = Boolean(body.active);
    }

    await updateSheetRowById("AppAnnouncements", id, patch);
    return NextResponse.json({ id, ...patch });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    await ensureSheetHeaders("AppAnnouncements", appAnnouncementHeaders);
    const { id } = await params;
    await deleteSheetRowById("AppAnnouncements", id);
    return NextResponse.json({ id, deleted: true });
  } catch (error) {
    return apiError(error);
  }
}

function normalizePriority(value: unknown): AppAnnouncementPriority {
  return value === "important_not_urgent" ? "important_not_urgent" : "important_urgent";
}
