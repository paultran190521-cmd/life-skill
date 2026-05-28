import { NextRequest, NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { readSheetRowById, updateSheetRowById } from "@/lib/google-sheets";
import { verifyScheduleConfirmationToken } from "@/lib/schedule-confirmation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = createRequestId("schedule-confirm");
  try {
    const { id } = await params;
    const payload = verifyScheduleConfirmationToken(request.nextUrl.searchParams.get("token"));
    if (!payload || payload.scheduleId !== id) {
      return apiFailure(401, "Link xác nhận lịch không hợp lệ hoặc đã hết hạn.", "UNAUTHORIZED", requestId);
    }

    const schedule = await readSheetRowById("Schedules", id);
    if (!schedule) {
      return apiFailure(404, "Không tìm thấy lịch cần xác nhận.", "NOT_FOUND", requestId);
    }
    if (schedule.teacherId !== payload.teacherId) {
      return apiFailure(403, "Link xác nhận không còn đúng giáo viên được phân công.", "FORBIDDEN", requestId);
    }

    const now = new Date().toISOString();
    await updateSheetRowById("Schedules", id, {
      status: "confirmed",
      confirmedAt: now,
      updatedAt: now,
    });
    await appendAuditLog({
      requestId,
      actor: { id: payload.teacherId, email: "" },
      action: "schedule.confirm",
      entityType: "Schedule",
      entityId: id,
      route: `/api/schedules/${id}/confirm`,
      method: "GET",
      authMode: "enforce",
      decision: "allow",
      reason: "",
      source: "email-token",
      before: { status: schedule.status, teacherId: schedule.teacherId },
      after: { status: "confirmed", teacherId: schedule.teacherId, confirmedAt: now },
    });

    const redirectUrl = new URL("/", request.nextUrl.origin);
    redirectUrl.searchParams.set("confirmedSchedule", id);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    return apiError(error, requestId);
  }
}
