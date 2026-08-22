import { NextRequest, NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { readSheetRows, updateSheetRowById } from "@/lib/google-sheets";
import { verifyScheduleConfirmationBatchToken } from "@/lib/schedule-confirmation";

export async function GET(request: NextRequest) {
  const requestId = createRequestId("schedule-confirm-all");
  try {
    const payload = verifyScheduleConfirmationBatchToken(request.nextUrl.searchParams.get("token"));
    if (!payload) {
      return apiFailure(401, "Link xác nhận tất cả không hợp lệ hoặc đã hết hạn.", "UNAUTHORIZED", requestId);
    }

    const rows = await readSheetRows("Schedules");
    const confirmableRows = rows.filter(
      (row) =>
        String(row.teacherId || "").trim() === payload.teacherId &&
        ["sent", "reassigned"].includes(String(row.status || "").trim()),
    );
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

      await Promise.all(
        confirmableRows.map((row) =>
          appendAuditLog({
            requestId,
            actor: { id: payload.teacherId, email: "" },
            action: "schedule.confirm.all",
            entityType: "Schedule",
            entityId: row.id,
            route: "/api/schedules/confirm-all",
            method: "GET",
            authMode: "enforce",
            decision: "allow",
            reason: "",
            source: "email-token",
            before: { status: row.status, teacherId: row.teacherId },
            after: { status: "confirmed", teacherId: row.teacherId, confirmedAt: now },
          }),
        ),
      );
    }

    const redirectUrl = new URL("/", request.nextUrl.origin);
    redirectUrl.searchParams.set("confirmedAll", String(confirmableRows.length));
    redirectUrl.searchParams.set("confirmedAt", String(Date.now()));
    return NextResponse.redirect(redirectUrl, {
      headers: { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate" },
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}
