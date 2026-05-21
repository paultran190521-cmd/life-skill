import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { updateSheetRowById } from "@/lib/google-sheets";
import { verifyScheduleConfirmationToken } from "@/lib/schedule-confirmation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const payload = verifyScheduleConfirmationToken(request.nextUrl.searchParams.get("token"));
    if (!payload || payload.scheduleId !== id) {
      throw new Error("Link xác nhận lịch không hợp lệ hoặc đã hết hạn.");
    }

    const now = new Date().toISOString();
    await updateSheetRowById("Schedules", id, {
      status: "confirmed",
      confirmedAt: now,
      updatedAt: now,
    });

    const redirectUrl = new URL("/", request.nextUrl.origin);
    redirectUrl.searchParams.set("confirmedSchedule", id);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    return apiError(error);
  }
}
