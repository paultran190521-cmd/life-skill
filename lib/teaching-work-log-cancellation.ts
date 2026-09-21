import { conflictError } from "@/lib/app-error";
import { cancelTeachingPeriodInHrm } from "@/lib/hrm-integration";
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
  for (const workLog of confirmed) {
    const eventId = deterministicTeachingCancellationEventId(workLog.idempotencyKey);
    await cancelTeachingPeriodInHrm({ source: "METTASOUL", action: "CANCEL_TEACHING_PERIOD", eventId, idempotencyKey: `CANCEL:${workLog.idempotencyKey}`, targetIdempotencyKey: workLog.idempotencyKey });
    await updateSheetRowById("TeachingWorkLogs", workLog.id, { ...workLog, status: "CANCELLED", cancelledAt, errorCode: "", errorMessage: "", updatedAt: cancelledAt });
  }
  return confirmed.map((workLog) => workLog.id);
}
