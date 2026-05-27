import { NextRequest, NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { appendSheetRows, readSheetRows, updateSheetRowById } from "@/lib/google-sheets";
import { verifyScheduleConfirmationBatchToken } from "@/lib/schedule-confirmation";

export async function GET(request: NextRequest) {
  try {
    const payload = verifyScheduleConfirmationBatchToken(request.nextUrl.searchParams.get("token"));
    if (!payload) {
      throw new Error("Link xác nhận tất cả không hợp lệ hoặc đã hết hạn.");
    }

    const scheduleIdSet = new Set(payload.scheduleIds);
    const rows = await readSheetRows("Schedules");
    const targetRows = rows.filter((row) => scheduleIdSet.has(String(row.id || "").trim()));
    if (targetRows.length === 0) {
      throw new Error("Không tìm thấy lịch cần xác nhận.");
    }

    const teacherRows = targetRows.filter((row) => String(row.teacherId || "").trim() === payload.teacherId);
    if (teacherRows.length === 0) {
      throw new Error("Link xác nhận không còn đúng giáo viên được phân công.");
    }

    const confirmableRows = teacherRows.filter((row) => ["sent", "reassigned"].includes(String(row.status || "").trim()));
    const now = new Date().toISOString();

    if (confirmableRows.length > 0) {
      await Promise.all(
        confirmableRows.map((row) =>
          updateSheetRowById("Schedules", row.id, {
            status: "confirmed",
            confirmedAt: now,
            updatedAt: now,
          }),
        ),
      );

      await appendSheetRows("Notifications", [
        {
          id: createId("n"),
          title: "Giáo viên đã nhận lịch",
          body: `${confirmableRows.length} lịch dạy vừa được xác nhận từ email (xác nhận tất cả).`,
          role: "admin",
          read: false,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      await appendSheetRows(
        "AuditLogs",
        confirmableRows.map((row) => ({
          id: createId("audit"),
          actorId: payload.teacherId,
          actorEmail: "",
          action: "schedule.confirm.all",
          entityType: "Schedule",
          entityId: row.id,
          metadata: JSON.stringify({ source: "email-confirm-all" }),
          createdAt: now,
        })),
      );
    }

    const redirectUrl = new URL("/", request.nextUrl.origin);
    redirectUrl.searchParams.set("confirmedAll", String(confirmableRows.length));
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    return apiError(error);
  }
}
