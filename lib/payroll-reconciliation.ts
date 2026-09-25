import { readSheetRowsBatch, updateSheetRowById } from "@/lib/google-sheets";
import { submitTeachingPeriodToHrm, type TeachingPeriodPayload } from "@/lib/hrm-integration";
import { blocksParticipant, readCancellationReports, reconcileCancellationReport } from "@/lib/schedule-cancellation-reports";
import { resolveTeachingRole, teachingWorkLogKey } from "@/lib/teaching-work-log";
import type { Schedule } from "@/lib/types";
import { uniqueWorkLogRows } from "@/lib/worklog-rows";

/** Durable outbox: only server-saved, already authorized requests may be replayed. */
export async function reconcilePayrollOutbox() {
  const started = Date.now();
  const reports = await readCancellationReports();
  let cancellations = 0;
  let confirmed = 0;
  for (const report of reports.filter((row) => row.status === "PENDING" && row.targetIdempotencyKey).slice(0, 2)) {
    if (Date.now() - started > 20000) break;
    Object.assign(report, await reconcileCancellationReport(report));
    cancellations++;
  }
  const rows = await readSheetRowsBatch(["TeachingWorkLogs", "Schedules", "Attendance"] as const);
  const pending = uniqueWorkLogRows(rows.TeachingWorkLogs).filter((row) => row.status === "PENDING" && row.submissionPayload)
    .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));
  for (const log of pending.slice(0, 2)) {
    if (Date.now() - started > 25000) break;
    if (blocksParticipant(reports, log.scheduleId, log.teacherId)) continue;
    const schedule = rows.Schedules.find((row) => row.id === log.scheduleId) as Schedule | undefined;
    if (!schedule || schedule.status === "cancelled") continue;
    const role = resolveTeachingRole(schedule, log.teacherId, rows.Schedules as Schedule[]);
    if (!role || teachingWorkLogKey(schedule.id, log.teacherId, role) !== log.idempotencyKey) continue;
    if (!rows.Attendance.some((row) => row.scheduleId === schedule.id && row.teacherId === log.teacherId)) continue;
    try {
      const payload = JSON.parse(log.submissionPayload) as TeachingPeriodPayload;
      if (payload.idempotencyKey !== log.idempotencyKey || payload.userEmail !== log.userEmail || payload.eventId !== log.eventId || payload.scheduleId !== log.scheduleId) throw new Error("Sai bản ghi đối chiếu; cần admin kiểm tra.");
      if (payload.activityTypeCode && (!log.approvedBy || payload.approvedBy !== log.approvedBy)) continue;
      const result = await submitTeachingPeriodToHrm(payload);
      await updateSheetRowById("TeachingWorkLogs", log.id, { status: "CONFIRMED", hrmWorkLogId: result.workLogId || "", money: result.money ?? "", mcpPoints: result.mcpPoints ?? "", mcpLedgerId: result.mcpLedgerId || "", policyVersion: result.policyVersion || "", errorCode: "", errorMessage: "", submittedAt: log.submittedAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
      confirmed++;
    } catch (error) {
      const code = String((error as { code?: string }).code || "RECONCILIATION_FAILED");
      const uncertain = ["SYSTEM_BUSY", "HRM_UNREACHABLE", "HRM_INVALID_RESPONSE"].includes(code);
      await updateSheetRowById("TeachingWorkLogs", log.id, { status: code === "PERIOD_CANCELLED" ? "CANCELLED" : uncertain ? "PENDING" : "FAILED", errorCode: code, errorMessage: error instanceof Error ? error.message : "Đối chiếu thất bại", updatedAt: new Date().toISOString() });
    }
  }
  return { ok: true, cancellations, confirmed, durationMs: Date.now() - started };
}
