import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { requireSessionUser } from "@/lib/route-auth";
import { readSheetRowsBatch, appendSheetRows, updateSheetRowById } from "@/lib/google-sheets";
import { readCancellationReports, reconcileCancellationReport } from "@/lib/schedule-cancellation-reports";
import { adjustCancelledPeriodInHrm } from "@/lib/hrm-integration";
import { appendAuditLogs } from "@/lib/audit";
import { canonicalParticipantSchedule } from "@/lib/topic-report-policy";
import { resolveTeachingRole, teachingWorkLogKey } from "@/lib/teaching-work-log";
import type { Schedule } from "@/lib/types";

export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const { user } = await requireSessionUser(request, { allowHeaderFallback: false });
    const reports = await readCancellationReports();
    return NextResponse.json({ reports: user.role === "admin" ? reports : reports.filter((row) => row.teacherId === user.teacherId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error, createRequestId("cancellation-list")); }
}

export async function POST(request: Request) {
  const requestId = createRequestId("cancellation-report");
  try {
    const { user } = await requireSessionUser(request, { allowHeaderFallback: false });
    const body = await request.json();
    const teacherId = String(user.teacherId || "");
    const reason = String(body.reason || "").trim();
    if (!teacherId || !reason || reason.length > 2000) return apiFailure(400, "Nhập lý do hủy từ 1 đến 2.000 ký tự.", undefined, requestId);
    const [reports, rows] = await Promise.all([readCancellationReports(), readSheetRowsBatch(["Schedules", "Attendance", "TeachingWorkLogs"] as const)]);
    const schedules = rows.Schedules as Schedule[];
    const requested = schedules.find((row) => row.id === body.scheduleId);
    if (!requested || !resolveTeachingRole(requested, teacherId, schedules)) return apiFailure(403, "Bạn không được phân công lịch này.", undefined, requestId);
    const schedule = canonicalParticipantSchedule(requested, teacherId, schedules);
    const attendance = rows.Attendance.find((row) => row.scheduleId === schedule.id && row.teacherId === teacherId);
    if (!attendance) return apiFailure(409, "Cần điểm danh trước khi báo hủy.", undefined, requestId);
    const roleCode = resolveTeachingRole(schedule, teacherId, schedules);
    if (!roleCode) return apiFailure(403, "Không được phân công lịch này.", undefined, requestId);
    const key = teachingWorkLogKey(schedule.id, teacherId, roleCode);
    const workLog = rows.TeachingWorkLogs.find((row) => row.idempotencyKey === key);
    if (workLog?.status === "PENDING") return apiFailure(409, "HRM đang đối chiếu công của tiết này. Vui lòng thử báo hủy sau khi đồng bộ xong.", undefined, requestId);
    const id = `CXL_${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
    const existing = reports.find((row) => row.id === id);
    if (existing && ["CONFIRMED", "REVIEWED"].includes(existing.status)) return NextResponse.json({ report: existing });
    if (schedule.status === "cancelled") return apiFailure(409, "Lịch đã được admin hủy.", undefined, requestId);
    const now = new Date().toISOString();
    if (existing?.status === "REJECTED") return NextResponse.json({ report: existing });
    const report = existing || { id, scheduleId: schedule.id, teacherId, userEmail: user.email, reason, attendanceAt: attendance.checkedInAt, reportedAt: now, status: "PENDING", errorMessage: "", updatedAt: now, targetIdempotencyKey: key };
    if (!existing) await appendSheetRows("ScheduleCancellationReports", [report]);
    const result = workLog?.status === "CONFIRMED" ? report : await reconcileCancellationReport(report);
    return NextResponse.json({ report: result }, { status: result.status === "PENDING" ? 202 : 200 });
  } catch (error) { return apiError(error, requestId); }
}

export async function PATCH(request: Request) {
  const requestId = createRequestId("cancellation-review");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    const { user } = auth;
    if (user.role !== "admin") return apiFailure(403, "Chỉ admin được ghi nhận báo cáo.", undefined, requestId);
    const { id, supportPercent, adminReason } = await request.json();
    const report = (await readCancellationReports()).find((row) => row.id === id);
    if (!report || !["CONFIRMED", "PENDING"].includes(report.status)) return apiFailure(409, "Báo cáo không ở trạng thái chờ admin.", undefined, requestId);
    const percentage = Number(supportPercent);
    const reason = String(adminReason || "").trim();
    if (![0, 50, 100].includes(percentage) || !reason || reason.length > 2000) return apiFailure(400, "Chọn mức hỗ trợ và nhập lý do xử lý.", undefined, requestId);
    const rows = await readSheetRowsBatch(["TeachingWorkLogs"] as const);
    const confirmed = rows.TeachingWorkLogs.find((row) => row.idempotencyKey === report.targetIdempotencyKey && row.status === "CONFIRMED");
    if (!confirmed) return apiFailure(409, "Chưa có dòng công HRM được xác nhận để điều chỉnh; cần đối chiếu trước.", undefined, requestId);
    let amount: number | undefined;
    let policyVersion = "";
    if (confirmed) {
      const result = await adjustCancelledPeriodInHrm({
        eventId: `ADJUST_${createHash("sha256").update(`${report.id}|${percentage}|${reason}`).digest("hex").slice(0, 24)}`,
        idempotencyKey: `ADJUST:${report.targetIdempotencyKey}`,
        targetIdempotencyKey: report.targetIdempotencyKey,
        supportPercent: percentage,
        adminReason: reason,
        adminEmail: user.email,
      });
      amount = Number(result.money);
      if (!Number.isFinite(amount)) return apiFailure(502, "HRM chưa trả số tiền hỗ trợ hợp lệ.", undefined, requestId);
      policyVersion = String(result.policyVersion || "");
      await updateSheetRowById("TeachingWorkLogs", confirmed.id, { money: amount, policyVersion, updatedAt: new Date().toISOString() });
    }
    const patch = { status: "REVIEWED", supportPercent: String(percentage), adminReason: reason, reviewedBy: user.email, reviewedAt: new Date().toISOString() };
    await updateSheetRowById("ScheduleCancellationReports", id, patch);
    try {
      await appendAuditLogs([{
        requestId, actor: user, action: "teaching_period.cancel_support_review", entityType: "ScheduleCancellationReport", entityId: id,
        route: "/api/schedule-cancellations", method: "PATCH", authMode: "enforce", decision: "allow", reason: "admin_support_review", source: auth.source,
        before: { status: report.status, reason: report.reason },
        after: { supportPercent: percentage, adminReason: reason, money: amount, hrmWorkLogId: confirmed.hrmWorkLogId },
      }]);
    } catch (error) {
      console.error(`[cancellation-review-audit-failed][${requestId}]`, error);
    }
    return NextResponse.json({ report: { ...report, ...patch }, money: amount, policyVersion });
  } catch (error) { return apiError(error, requestId); }
}
