import { after, NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLogs } from "@/lib/audit";
import { ErrorCodes } from "@/lib/error-codes";
import { submitTeachingPeriodToHrm, type TeachingPeriodPayload } from "@/lib/hrm-integration";
import {
  appendSheetRows,
  ensureSheetHeaders,
  readSheetRowsBatch,
  teachingWorkLogHeaders,
  updateSheetRowById,
} from "@/lib/google-sheets";
import { evaluatePermission, requireSessionUser } from "@/lib/route-auth";
import {
  deterministicTeachingEventId,
  deterministicTeachingWorkLogId,
  resolveTeachingRole,
  schedulePeriodTimes,
  teachingWorkLogKey,
} from "@/lib/teaching-work-log";
import type { Schedule, TeachingEnvironment, TimeSlot } from "@/lib/types";
import { canonicalParticipantSchedule, topicReportActivity, validateTopicReport } from "@/lib/topic-report-policy";
import { blocksParticipant, readCancellationReports } from "@/lib/schedule-cancellation-reports";
import { uniqueWorkLogRows } from "@/lib/worklog-rows";

export const runtime = "nodejs";
export const maxDuration = 30;

const environmentNames: Record<TeachingEnvironment, string> = {
  in_class: "Trong lớp",
  outdoor: "Ngoài sân",
  gym: "Nhà thi đấu",
  schoolyard_report: "Báo cáo chuyên đề",
  hall: "Hội trường",
};

export async function GET(request: Request) {
  try {
    const { user } = await requireSessionUser(request, { allowHeaderFallback: false });
    await ensureSheetHeaders("TeachingWorkLogs", teachingWorkLogHeaders);
    const rows = await readSheetRowsBatch(["TeachingWorkLogs"] as const);
    const unique = uniqueWorkLogRows(rows.TeachingWorkLogs);
    const visible = user.role === "admin" ? unique : unique.filter((row) => row.teacherId === user.teacherId);
    return NextResponse.json({ workLogs: visible.map(normalizeStoredWorkLog) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error, createRequestId("worklog-list")); }
}

export async function POST(request: Request) {
  const requestId = createRequestId("teaching-work-log");
  const startedAt = performance.now();
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    const body = await request.json();
    const scheduleId = String(body.scheduleId || "").trim();
    const isApproval = auth.user.role === "admin" && body.intent === "approve";
    const participantId = String(isApproval ? body.teacherId : auth.user.teacherId || "").trim();
    if (!scheduleId || !participantId) {
      return apiFailure(400, "Thiếu lịch dạy hoặc tài khoản giáo viên.", ErrorCodes.validation, requestId);
    }

    await ensureSheetHeaders("TeachingWorkLogs", teachingWorkLogHeaders);
    const rows = await readSheetRowsBatch([
      "Schedules",
      "TimeSlots",
      "Schools",
      "Classes",
      "Attendance",
      "TeachingWorkLogs",
      "Users",
    ] as const);
    const requestedSchedule = rows.Schedules.find((item) => item.id === scheduleId) as Schedule | undefined;
    if (!requestedSchedule) return apiFailure(404, "Không tìm thấy tiết dạy.", ErrorCodes.notFound, requestId);
    if (!resolveTeachingRole(requestedSchedule, participantId, rows.Schedules as Schedule[])) return apiFailure(403, "Không được phân công lịch này.", ErrorCodes.forbidden, requestId);
    const schedule = canonicalParticipantSchedule(requestedSchedule, participantId, rows.Schedules as Schedule[]);
    if (schedule.status === "cancelled") {
      return apiFailure(409, "Không thể chấm công lịch đã hủy.", ErrorCodes.conflict, requestId);
    }

    const roleCode = resolveTeachingRole(schedule, participantId, rows.Schedules as Schedule[]);
    if (!roleCode) {
      return apiFailure(403, "Bạn không được phân công trong tiết dạy này.", ErrorCodes.forbidden, requestId);
    }
    const permission = evaluatePermission({
      allowed: true,
      reason: "participant_must_be_assigned_to_teaching_period",
    });

    const period = schedulePeriodTimes(schedule, rows.TimeSlots as unknown as TimeSlot[]);
    if (!period) return apiFailure(400, "Tiết dạy thiếu ngày hoặc khung giờ hợp lệ.", ErrorCodes.validation, requestId);
    if (Date.now() < period.endsAt.getTime()) {
      return apiFailure(409, `Chỉ được chấm công sau ${period.slot.end}.`, ErrorCodes.conflict, requestId);
    }

    const idempotencyKey = teachingWorkLogKey(schedule.id, participantId, roleCode);
    const existing = uniqueWorkLogRows(rows.TeachingWorkLogs).find((item) => item.idempotencyKey === idempotencyKey);
    if (existing && String(existing.status || "").toUpperCase() === "CONFIRMED") {
      return NextResponse.json({ workLog: normalizeStoredWorkLog(existing), idempotent: true });
    }
    if (existing?.status === "CANCELLED" || blocksParticipant(await readCancellationReports(), schedule.id, participantId)) {
      return apiFailure(409, "Tiết này đã báo hủy.", ErrorCodes.conflict, requestId);
    }
    const hasAttendance = rows.Attendance.some(
      (item) => String(item.scheduleId || "").trim() === schedule.id && String(item.teacherId || "").trim() === participantId,
    );
    if (!hasAttendance) {
      return apiFailure(409, "Bạn cần điểm danh tiết này trước khi chấm công.", ErrorCodes.conflict, requestId);
    }

    const school = rows.Schools.find((item) => item.id === schedule.schoolId);
    const classRoom = rows.Classes.find((item) => item.id === schedule.classId);
    const environmentCode = (schedule.teachingEnvironment || "in_class") as TeachingEnvironment;
    const isTopic = environmentCode === "schoolyard_report";
    const principals = rows.Schedules.filter((row) => row.status !== "cancelled" && (schedule.groupId ? row.groupId === schedule.groupId : row.id === schedule.id));
    if (isTopic) {
      const policyError = validateTopicReport(environmentCode, schedule.activityTypeCode, principals.map((row) => row.teacherId));
      if (policyError) return apiFailure(409, policyError, ErrorCodes.validation, requestId);
      if (existing?.activityTypeCode && existing.activityTypeCode !== schedule.activityTypeCode) return apiFailure(409, "Loại hoạt động đã thay đổi sau khi hoàn thành. Cần admin kiểm tra.", undefined, requestId);
    }
    if (isApproval && !isTopic) return apiFailure(400, "Lịch này không thuộc Báo cáo chuyên đề.", undefined, requestId);
    const participantEmail = isApproval ? rows.Users.find((row) => row.teacherId === participantId)?.email : auth.user.email;
    if (!participantEmail) return apiFailure(409, "Thiếu email người tham gia.", undefined, requestId);
    const evidenceUrl = String(existing?.evidenceUrl || body.evidenceUrl || "").trim();
    if (evidenceUrl && !/^https:\/\//i.test(evidenceUrl)) return apiFailure(400, "Liên kết minh chứng cần bắt đầu bằng https://.", undefined, requestId);
    if (isApproval && !existing?.approvedBy && existing?.status !== "COMPLETED") return apiFailure(409, "Giáo viên chưa xác nhận hoàn thành.", undefined, requestId);
    if (isTopic && !isApproval && !existing?.approvedBy) {
      if (existing?.status === "COMPLETED") return NextResponse.json({ workLog: normalizeStoredWorkLog(existing), awaitingApproval: true });
      const completed = { id: deterministicTeachingWorkLogId(teachingWorkLogKey(schedule.id, participantId, roleCode)), scheduleId: schedule.id, periodId: schedule.id, teacherId: participantId, userEmail: participantEmail, roleCode, idempotencyKey, eventId: deterministicTeachingEventId(idempotencyKey), status: "COMPLETED", activityTypeCode: schedule.activityTypeCode || "", evidenceUrl, submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      if (existing) await updateSheetRowById("TeachingWorkLogs", existing.id, completed);
      else await appendSheetRows("TeachingWorkLogs", [completed]);
      return NextResponse.json({ workLog: completed, awaitingApproval: true });
    }
    const eventId = deterministicTeachingEventId(idempotencyKey);
    const workLogId = String(existing?.id || deterministicTeachingWorkLogId(idempotencyKey));
    const pendingAt = new Date().toISOString();
    const submission: TeachingPeriodPayload = {
      source: "METTASOUL", action: "SUBMIT_TEACHING_PERIOD", eventId, idempotencyKey,
      scheduleId: schedule.id, periodId: schedule.id, userEmail: participantEmail.trim().toLowerCase(),
      activityTypeCode: schedule.activityTypeCode, evidenceUrl,
      approvedBy: existing?.approvedBy || (isApproval ? auth.user.email : ""),
      principalCount: new Set(principals.map((row) => row.teacherId)).size,
      policyContract: "TOPIC_REPORT_V1", roleCode,
      schoolId: schedule.schoolId, schoolName: String(school?.name || ""),
      environmentCode, environmentName: environmentNames[environmentCode],
      classId: schedule.classId, className: String(classRoom?.name || ""), workDate: schedule.date,
      periodStartAt: period.startsAt.toISOString(), periodEndAt: period.endsAt.toISOString(),
    };
    const pendingWorkLog = {
      id: workLogId,
      scheduleId: schedule.id,
      periodId: schedule.id,
      teacherId: participantId,
      userEmail: participantEmail.trim().toLowerCase(),
      activityTypeCode: schedule.activityTypeCode || "",
      evidenceUrl,
      approvedBy: existing?.approvedBy || (isApproval ? auth.user.email : ""),
      approvedAt: existing?.approvedAt || (isApproval ? pendingAt : ""),
      roleCode,
      idempotencyKey,
      eventId,
      status: "PENDING",
      hrmWorkLogId: "",
      money: "",
      mcpPoints: "",
      mcpLedgerId: "",
      policyVersion: "",
      submittedAt: "",
      cancelledAt: "",
      errorCode: "",
      errorMessage: "",
      updatedAt: pendingAt,
      submissionPayload: existing?.submissionPayload || JSON.stringify(submission),
    };
    if (existing && String(existing.status || "").toUpperCase() !== "PENDING") {
      await updateSheetRowById("TeachingWorkLogs", workLogId, pendingWorkLog);
    } else {
      if (!existing) {
        await appendSheetRows("TeachingWorkLogs", [pendingWorkLog]);
      }
    }
    let hrmResult;
    const hrmStartedAt = performance.now();
    try {
      hrmResult = await submitTeachingPeriodToHrm(JSON.parse(pendingWorkLog.submissionPayload));
    } catch (error) {
      const code = String((error as { code?: string })?.code || "HRM_REJECTED");
      const message = error instanceof Error ? error.message : "HRM từ chối chấm công.";
      const outcomeUncertain = ["HRM_UNREACHABLE", "HRM_INVALID_RESPONSE", "SYSTEM_BUSY"].includes(code);
      const pendingWithDiagnostic = {
        ...pendingWorkLog,
        errorCode: code,
        errorMessage: message,
        updatedAt: new Date().toISOString(),
      };
      if (outcomeUncertain) {
        // The initial PENDING row is already durable. Do not delay a teacher's
        // response with another full-Sheet lookup when the HRM outcome may have
        // completed after our HTTP deadline; the next idempotent retry repairs it.
        after(async () => {
          try {
            await updateSheetRowById("TeachingWorkLogs", workLogId, pendingWithDiagnostic);
          } catch (updateError) {
            console.error(`[teaching-work-log-pending-update-failed][${requestId}]`, updateError);
          }
        });
        const totalMs = Math.round(performance.now() - startedAt);
        const hrmMs = Math.round(performance.now() - hrmStartedAt);
        console.info("[teaching-work-log-pending]", { requestId, scheduleId, participantId, roleCode, hrmMs, totalMs, code });
        return NextResponse.json(
          { workLog: pendingWithDiagnostic, idempotent: false, syncPending: true, retryAfterMs: 1_500 },
          { status: 202, headers: { "Server-Timing": `hrm;dur=${hrmMs}, total;dur=${totalMs}` } },
        );
      }
      await updateSheetRowById("TeachingWorkLogs", workLogId, {
        status: "FAILED",
        errorCode: code,
        errorMessage: message,
        updatedAt: new Date().toISOString(),
      });
      const status = ["HRM_NOT_CONFIGURED", "HRM_INTEGRATION_DISABLED", "HRM_UNREACHABLE"].includes(code) ? 503 : 409;
      return apiFailure(status, message, ErrorCodes.externalService, requestId);
    }

    const now = new Date().toISOString();
    const workLog = {
      id: workLogId,
      scheduleId: schedule.id,
      periodId: schedule.id,
      teacherId: participantId,
      userEmail: participantEmail.trim().toLowerCase(),
      activityTypeCode: schedule.activityTypeCode || "",
      evidenceUrl,
      approvedBy: pendingWorkLog.approvedBy,
      approvedAt: pendingWorkLog.approvedAt,
      roleCode,
      idempotencyKey,
      eventId,
      status: "CONFIRMED",
      hrmWorkLogId: hrmResult.workLogId || "",
      money: hrmResult.money ?? "",
      mcpPoints: hrmResult.mcpPoints ?? "",
      mcpLedgerId: hrmResult.mcpLedgerId || "",
      policyVersion: hrmResult.policyVersion || "",
      submittedAt: now,
      cancelledAt: "",
      errorCode: "",
      errorMessage: "",
      updatedAt: now,
    };
    await updateSheetRowById("TeachingWorkLogs", workLogId, workLog);
    // HRM and the local confirmation above are the durable business result.
    // Keep the non-critical audit write off the response path: teachers get
    // their confirmed result as soon as the two authoritative writes finish,
    // while Next.js completes the audit work after sending that response.
    after(async () => {
      try {
        await appendAuditLogs([{
        requestId,
        actor: auth.user,
        action: "teaching_work_log.create",
        entityType: "TeachingWorkLog",
        entityId: workLog.id,
        route: "/api/teaching-work-logs",
        method: "POST",
        authMode: permission.authMode,
        decision: permission.decision,
        reason: permission.reason,
        source: auth.source,
        after: {
          scheduleId: schedule.id,
          periodId: schedule.id,
          participantId,
          roleCode,
          hrmWorkLogId: workLog.hrmWorkLogId,
        },
        }]);
      } catch (auditError) {
        console.error(`[teaching-work-log-audit-failed][${requestId}]`, auditError);
      }
    });
    const totalMs = Math.round(performance.now() - startedAt);
    const hrmMs = Math.round(performance.now() - hrmStartedAt);
    console.info("[teaching-work-log-confirmed]", { requestId, scheduleId, participantId, roleCode, hrmMs, totalMs, idempotent: Boolean(hrmResult.idempotent) });
    return NextResponse.json(
      { workLog, idempotent: Boolean(hrmResult.idempotent) },
      { headers: { "Server-Timing": `hrm;dur=${hrmMs}, total;dur=${totalMs}` } },
    );
  } catch (error) {
    return apiError(error, requestId, { route: "/api/teaching-work-logs", method: "POST" });
  }
}

function normalizeStoredWorkLog(row: Record<string, string>) {
  const { submissionPayload: _serverOnly, ...publicRow } = row;
  return {
    ...publicRow,
    money: row.money === "" || row.money === undefined ? undefined : Number(row.money),
    mcpPoints: row.mcpPoints === "" || row.mcpPoints === undefined ? undefined : Number(row.mcpPoints),
  };
}
