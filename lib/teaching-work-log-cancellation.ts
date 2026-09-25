import { conflictError, externalServiceError } from "@/lib/app-error";
import { cancelTeachingPeriodInHrm, reportCancelledPeriodToHrm } from "@/lib/hrm-integration";
import { readSheetRows, updateSheetRowById } from "@/lib/google-sheets";
import { deterministicTeachingCancellationEventId } from "@/lib/teaching-work-log";
import type { TeachingWorkLog } from "@/lib/types";

/** Removes payroll impact before a confirmed teaching record is deleted. */
export async function cancelConfirmedTeachingWorkLogs(scheduleIds: string[]) {
  const requestedIds = new Set(scheduleIds.map((id) => String(id || "").trim()).filter(Boolean));
  if (requestedIds.size === 0) return [] as string[];
  const workLogs = await readSheetRows("TeachingWorkLogs") as unknown as TeachingWorkLog[];
  const related = workLogs.filter((workLog) => requestedIds.has(String(workLog.scheduleId || "").trim()));
  if (related.some((workLog) => String(workLog.status).toUpperCase() === "PENDING")) {
    throw conflictError("Lịch đang có chấm công chờ HRM xác nhận. Hãy đồng bộ lại để chốt trạng thái trước khi hủy hoặc xóa lịch.");
  }
  const confirmed = related.filter((workLog) => String(workLog.status).toUpperCase() === "CONFIRMED");
  const cancelledAt = new Date().toISOString();
  // A completed activity may race with admin approval. Persist the HRM block
  // before deleting/reassigning it; if approval already won, stop deletion.
  for (const workLog of related.filter((row) => ["COMPLETED", "FAILED"].includes(row.status))) {
    await reportCancelledPeriodToHrm({ eventId: `REPORT_${deterministicTeachingCancellationEventId(workLog.idempotencyKey)}`, targetIdempotencyKey: workLog.idempotencyKey, idempotencyKey: `REPORT:${workLog.idempotencyKey}`, userEmail: workLog.userEmail, scheduleId: workLog.scheduleId, reason: "Admin hủy, xóa hoặc chuyển lịch trước khi HRM ghi nhận." });
    await updateSheetRowById("TeachingWorkLogs", workLog.id, { status: "CANCELLED", cancelledAt, updatedAt: cancelledAt });
  }
  for (const workLog of confirmed) {
    const eventId = deterministicTeachingCancellationEventId(workLog.idempotencyKey);
    try {
      await cancelTeachingPeriodInHrm({ source: "METTASOUL", action: "CANCEL_TEACHING_PERIOD", eventId, idempotencyKey: `CANCEL:${workLog.idempotencyKey}`, targetIdempotencyKey: workLog.idempotencyKey });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Không nhận được phản hồi từ HRM.";
      throw externalServiceError(`Không thể hủy dòng công HRM của lịch này: ${reason}`);
    }
    await updateSheetRowById("TeachingWorkLogs", workLog.id, { ...workLog, status: "CANCELLED", cancelledAt, errorCode: "", errorMessage: "", updatedAt: cancelledAt });
  }
  return confirmed.map((workLog) => workLog.id);
}
