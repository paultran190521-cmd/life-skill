import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { requireSessionUser } from "@/lib/route-auth";
import { readSheetRowsBatch, appendSheetRows, updateSheetRowById } from "@/lib/google-sheets";
import { readCancellationReports, reconcileCancellationReport } from "@/lib/schedule-cancellation-reports";
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
    if (workLog?.status === "CONFIRMED") return apiFailure(409, "Tiết đã ghi nhận tại HRM. Vui lòng liên hệ admin xử lý hủy.", undefined, requestId);
    const id = `CXL_${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
    const existing = reports.find((row) => row.id === id);
    if (existing && ["CONFIRMED", "REVIEWED"].includes(existing.status)) return NextResponse.json({ report: existing });
    if (schedule.status === "cancelled") return apiFailure(409, "Lịch đã được admin hủy.", undefined, requestId);
    const now = new Date().toISOString();
    if (existing?.status === "REJECTED") return NextResponse.json({ report: existing });
    const report = existing || { id, scheduleId: schedule.id, teacherId, userEmail: user.email, reason, attendanceAt: attendance.checkedInAt, reportedAt: now, status: "PENDING", errorMessage: "", updatedAt: now, targetIdempotencyKey: key };
    if (!existing) await appendSheetRows("ScheduleCancellationReports", [report]);
    const result = await reconcileCancellationReport(report);
    return NextResponse.json({ report: result }, { status: result.status === "PENDING" ? 202 : 200 });
  } catch (error) { return apiError(error, requestId); }
}

export async function PATCH(request: Request) {
  const requestId = createRequestId("cancellation-review");
  try {
    const { user } = await requireSessionUser(request, { allowHeaderFallback: false });
    if (user.role !== "admin") return apiFailure(403, "Chỉ admin được ghi nhận báo cáo.", undefined, requestId);
    const { id } = await request.json();
    const report = (await readCancellationReports()).find((row) => row.id === id);
    if (!report || report.status !== "CONFIRMED") return apiFailure(409, "Báo cáo chưa xác nhận hủy tại HRM.", undefined, requestId);
    const patch = { status: "REVIEWED", reviewedBy: user.email, reviewedAt: new Date().toISOString() };
    await updateSheetRowById("ScheduleCancellationReports", id, patch);
    return NextResponse.json({ report: { ...report, ...patch } });
  } catch (error) { return apiError(error, requestId); }
}
