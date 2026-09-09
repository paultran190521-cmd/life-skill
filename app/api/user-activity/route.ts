import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { ensureSheetHeaders, readSheetRowById, readSheetRows, updateSheetRowById, userHeaders } from "@/lib/google-sheets";
import { requireSessionUser } from "@/lib/route-auth";

export async function PATCH(request: Request) {
  const requestId = createRequestId("user-activity");
  try {
    const auth = await requireSessionUser(request);
    const body = await request.json() as Record<string, unknown>;
    await ensureSheetHeaders("Users", userHeaders);
    const user = await readSheetRowById("Users", auth.user.id) ?? (await readSheetRows("Users")).find(
      (item) => String(item.email || "").trim().toLowerCase() === auth.user.email.trim().toLowerCase(),
    );
    if (!user) return apiFailure(404, "Không tìm thấy tài khoản người dùng.", undefined, requestId);
    const userId = String(user.id || "").trim();

    const existingReadIds = String(user.readNotificationIds || "").split(",").map((id) => id.trim()).filter(Boolean);
    const newReadIds = Array.isArray(body.notificationIds)
      ? body.notificationIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
    const readNotificationIds = Array.from(new Set([...existingReadIds, ...newReadIds])).slice(-1000).join(",");
    const scheduleViewedAt = body.markSchedulesViewed === true ? new Date().toISOString() : String(user.scheduleViewedAt || "");
    const updatedAt = new Date().toISOString();
    await updateSheetRowById("Users", userId, { readNotificationIds, scheduleViewedAt, updatedAt });
    return NextResponse.json({ id: userId, readNotificationIds, scheduleViewedAt, updatedAt });
  } catch (error) {
    return apiError(error, requestId);
  }
}
