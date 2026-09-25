import { ensureSheetHeaders, readSheetRows, updateSheetRowById } from "@/lib/google-sheets";
import { reportCancelledPeriodToHrm } from "@/lib/hrm-integration";

export const cancellationReportHeaders = ["id", "scheduleId", "teacherId", "userEmail", "reason", "attendanceAt", "reportedAt", "status", "errorMessage", "reviewedBy", "reviewedAt", "updatedAt", "targetIdempotencyKey"];
export type CancellationReport = Record<string, string>;

export async function readCancellationReports() {
  await ensureSheetHeaders("ScheduleCancellationReports", cancellationReportHeaders);
  const rows = await readSheetRows("ScheduleCancellationReports");
  const rank: Record<string, number> = { REVIEWED: 4, CONFIRMED: 3, REJECTED: 2, PENDING: 1 };
  const unique = new Map<string, CancellationReport>();
  for (const row of rows) {
    const prior = unique.get(row.id);
    if (!prior || (rank[row.status] || 0) > (rank[prior.status] || 0)) unique.set(row.id, row);
  }
  return [...unique.values()];
}

export function blocksParticipant(reports: CancellationReport[], scheduleId: string, teacherId: string) {
  return reports.some((row) => row.scheduleId === scheduleId && row.teacherId === teacherId && row.status !== "REJECTED");
}

export async function reconcileCancellationReport(report: CancellationReport) {
  let status = "CONFIRMED";
  let errorMessage = "";
  try {
    await reportCancelledPeriodToHrm({ eventId: report.id, idempotencyKey: `REPORT:${report.targetIdempotencyKey}`, targetIdempotencyKey: report.targetIdempotencyKey, userEmail: report.userEmail, scheduleId: report.scheduleId, reason: report.reason });
  } catch (error) {
    status = (error as { code?: string }).code === "WORKLOG_ALREADY_CONFIRMED" ? "REJECTED" : "PENDING";
    errorMessage = error instanceof Error ? error.message : "Đang đối chiếu HRM";
  }
  const next = { ...report, status, errorMessage, updatedAt: new Date().toISOString() };
  await updateSheetRowById("ScheduleCancellationReports", report.id, next);
  if (status === "CONFIRMED") {
    for (const log of (await readSheetRows("TeachingWorkLogs")).filter((row) => row.idempotencyKey === report.targetIdempotencyKey)) {
      await updateSheetRowById("TeachingWorkLogs", log.id, { status: "CANCELLED", cancelledAt: next.updatedAt, updatedAt: next.updatedAt });
    }
  }
  return next;
}
