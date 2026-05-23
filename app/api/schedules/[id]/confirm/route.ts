import { NextRequest, NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { appendSheetRows, readSheetRowById, updateSheetRowById } from "@/lib/google-sheets";
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

    const schedule = await readSheetRowById("Schedules", id);
    if (!schedule) {
      throw new Error("Không tìm thấy lịch cần xác nhận.");
    }
    if (schedule.teacherId !== payload.teacherId) {
      throw new Error("Link xác nhận không còn đúng giáo viên được phân công.");
    }

    const now = new Date().toISOString();
    await updateSheetRowById("Schedules", id, {
      status: "confirmed",
      confirmedAt: now,
      updatedAt: now,
    });
    await appendSheetRows("Notifications", [
      {
        id: createId("n"),
        title: "Giáo viên đã nhận lịch",
        body: "Một lịch dạy vừa được xác nhận từ email.",
        role: "admin",
        read: false,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await appendSheetRows("AuditLogs", [
      {
        id: createId("audit"),
        actorId: payload.teacherId,
        actorEmail: "",
        action: "schedule.confirm",
        entityType: "Schedule",
        entityId: id,
        metadata: JSON.stringify({ source: "email" }),
        createdAt: now,
      },
    ]);

    const redirectUrl = new URL("/", request.nextUrl.origin);
    redirectUrl.searchParams.set("confirmedSchedule", id);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    return apiError(error);
  }
}
