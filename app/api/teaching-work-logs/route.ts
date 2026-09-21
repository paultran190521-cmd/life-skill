import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLogs } from "@/lib/audit";
import { ErrorCodes } from "@/lib/error-codes";
import { submitTeachingPeriodToHrm } from "@/lib/hrm-integration";
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

const environmentNames: Record<TeachingEnvironment, string> = {
  in_class: "Trong lớp",
  outdoor: "Ngoài sân",
  gym: "Nhà thi đấu",
  schoolyard_report: "Báo cáo sân trường",
  hall: "Hội trường",
};

export async function POST(request: Request) {
  const requestId = createRequestId("teaching-work-log");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    const body = await request.json();
    const scheduleId = String(body.scheduleId || "").trim();
    const participantId = String(auth.user.teacherId || "").trim();
    if (!scheduleId || !participantId) {
      return apiFailure(400, "Thiếu lịch dạy hoặc tài khoản giáo viên.", ErrorCodes.validation, requestId);
    }

    await ensureSheetHeaders("TeachingWorkLogs", teachingWorkLogHeaders);
    const rows = await readSheetRowsBatch([
      "Schedules",
      "TimeSlots",
      "Schools",
      "Classes",
      "TeachingWorkLogs",
    ] as const);
    const schedule = rows.Schedules.find((item) => item.id === scheduleId) as Schedule | undefined;
    if (!schedule) return apiFailure(404, "Không tìm thấy tiết dạy.", ErrorCodes.notFound, requestId);
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
    const existing = rows.TeachingWorkLogs.find((item) => item.idempotencyKey === idempotencyKey);
    if (existing && String(existing.status || "").toUpperCase() === "CONFIRMED") {
      return NextResponse.json({ workLog: normalizeStoredWorkLog(existing), idempotent: true });
    }

    const school = rows.Schools.find((item) => item.id === schedule.schoolId);
    const classRoom = rows.Classes.find((item) => item.id === schedule.classId);
    const environmentCode = (schedule.teachingEnvironment || "in_class") as TeachingEnvironment;
    const eventId = deterministicTeachingEventId(idempotencyKey);
    const workLogId = String(existing?.id || deterministicTeachingWorkLogId(idempotencyKey));
    const pendingAt = new Date().toISOString();
    const pendingWorkLog = {
      id: workLogId,
      scheduleId: schedule.id,
      periodId: schedule.id,
      teacherId: participantId,
      userEmail: auth.user.email.trim().toLowerCase(),
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
    };
    if (existing) {
      await updateSheetRowById("TeachingWorkLogs", workLogId, pendingWorkLog);
    } else {
      await appendSheetRows("TeachingWorkLogs", [pendingWorkLog]);
    }
    let hrmResult;
    try {
      hrmResult = await submitTeachingPeriodToHrm({
        source: "METTASOUL",
        action: "SUBMIT_TEACHING_PERIOD",
        eventId,
        idempotencyKey,
        scheduleId: schedule.id,
        periodId: schedule.id,
        userEmail: auth.user.email.trim().toLowerCase(),
        roleCode,
        schoolId: schedule.schoolId,
        schoolName: String(school?.name || ""),
        environmentCode,
        environmentName: environmentNames[environmentCode],
        classId: schedule.classId,
        className: String(classRoom?.name || ""),
        workDate: schedule.date,
        periodStartAt: period.startsAt.toISOString(),
        periodEndAt: period.endsAt.toISOString(),
      });
    } catch (error) {
      const code = String((error as { code?: string })?.code || "HRM_REJECTED");
      const message = error instanceof Error ? error.message : "HRM từ chối chấm công.";
      const outcomeUncertain = code === "HRM_UNREACHABLE" || code === "HRM_INVALID_RESPONSE";
      await updateSheetRowById("TeachingWorkLogs", workLogId, {
        status: outcomeUncertain ? "PENDING" : "FAILED",
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
      userEmail: auth.user.email.trim().toLowerCase(),
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
    return NextResponse.json({ workLog, idempotent: Boolean(hrmResult.idempotent) });
  } catch (error) {
    return apiError(error, requestId, { route: "/api/teaching-work-logs", method: "POST" });
  }
}

function normalizeStoredWorkLog(row: Record<string, string>) {
  return {
    ...row,
    money: row.money === "" || row.money === undefined ? undefined : Number(row.money),
    mcpPoints: row.mcpPoints === "" || row.mcpPoints === undefined ? undefined : Number(row.mcpPoints),
  };
}
