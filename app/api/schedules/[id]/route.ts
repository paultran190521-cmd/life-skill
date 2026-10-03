import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { sendScheduleEmail } from "@/lib/email";
import {
  appendSheetRows,
  ensureSheetHeaders,
  readSheetRowById,
  readSheetRows,
  readSheetRowsBatch,
  updateSheetRowById,
  schoolTeachingNeedHeaders,
  scheduleHeaders,
  teachingWorkLogHeaders,
} from "@/lib/google-sheets";
import {
  deleteSchedulesCascade,
  resetScheduleAssignmentData,
  type ScheduleCascadeDeleteResult,
} from "@/lib/schedule-cascade-delete";
import { evaluatePermission, requireSessionUser } from "@/lib/route-auth";
import { invalidateScheduleConflictIndex } from "@/lib/schedule-conflict-index";
import { hasTeacherTimeConflict } from "@/lib/schedule-conflict-policy";
import { cancelConfirmedTeachingWorkLogs } from "@/lib/teaching-work-log-cancellation";
import { adjustCancelledPeriodInHrm, submitCancelledSupportToHrm, type TeachingPeriodPayload } from "@/lib/hrm-integration";
import { createHash } from "node:crypto";
import { deterministicTeachingEventId, deterministicTeachingWorkLogId, resolveTeachingRole, schedulePeriodTimes, teachingWorkLogKey } from "@/lib/teaching-work-log";
import { isTimeSlotAllowedForSchool } from "@/lib/time-slots";
import type { Notification, Schedule, ScheduleStatus, TimeSlot, User } from "@/lib/types";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId("schedule-patch");
  try {
    const auth = await requireSessionUser(request);
    const { id } = await params;
    const body = await request.json();
    const status = String(body.status || "") as ScheduleStatus;
    const now = new Date().toISOString();
    const schedule = await readSheetRowById("Schedules", id);

    if (!schedule) {
      return apiFailure(404, "Không tìm thấy lịch.", undefined, requestId);
    }

    const permission = evaluatePermission({
      allowed: isAuthorized(auth.user, schedule.teacherId || "", status),
      reason: "forbidden_schedule_operation",
    });
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] schedules.patch ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const patch: Record<string, unknown> = { status, updatedAt: now };
    let action = `schedule.${status}`;
    let emailResult: Record<string, unknown> | null = null;
    let scheduleForEmail: Schedule | null = null;
    let notifications: Notification[] = [];
    let resetResult: ScheduleCascadeDeleteResult | null = null;
    let cancelledWorkLogIds: string[] = [];

    if (status === "confirmed") {
      patch.confirmedAt = now;
      notifications = [
        createNotification("Giáo viên đã nhận lịch", "Một lịch dạy vừa được xác nhận.", "admin", now),
      ];
      action = "schedule.confirm";
    } else if (status === "cancelled") {
      await ensureSheetHeaders("Schedules", scheduleHeaders);
      await ensureSheetHeaders("TeachingWorkLogs", teachingWorkLogHeaders);
      const supportPercent = Number(body.supportPercent);
      const adminReason = String(body.adminReason || "").trim();
      if (![0, 50, 100].includes(supportPercent) || !adminReason || adminReason.length > 2000) {
        return apiFailure(400, "Chọn mức hỗ trợ 0%, 50% hoặc 100% và ghi lý do hủy.", undefined, requestId);
      }
      const rows = await readSheetRowsBatch(["Schedules", "TeachingWorkLogs", "TimeSlots", "Schools", "Classes", "Users"] as const);
      const allSchedules = rows.Schedules as Schedule[];
      const assignedIds = [schedule.teacherId, ...String(schedule.assistantIds || "").split(",")].map((value) => value.trim()).filter(Boolean);
      const period = schedulePeriodTimes(schedule as Schedule, rows.TimeSlots as unknown as TimeSlot[]);
      if (!period || !assignedIds.length) return apiFailure(409, "Lịch thiếu giờ hoặc người được phân công để tính hỗ trợ.", undefined, requestId);
      const school = rows.Schools.find((item) => item.id === schedule.schoolId);
      const classRoom = rows.Classes.find((item) => item.id === schedule.classId);
      for (const participantId of assignedIds) {
        const roleCode = resolveTeachingRole(schedule as Schedule, participantId, allSchedules);
        if (!roleCode) continue;
        const key = teachingWorkLogKey(id, participantId, roleCode);
        const log = rows.TeachingWorkLogs.find((item) => item.idempotencyKey === key);
        if (log && log.status !== "CONFIRMED") return apiFailure(409, "Có dòng công HRM đang đối chiếu. Hãy thử lại sau khi đồng bộ xong.", undefined, requestId);
        if (log?.status === "CONFIRMED") {
          const result = await adjustCancelledPeriodInHrm({
            eventId: `ADJUST_${createHash("sha256").update(`${id}|${key}|${supportPercent}|${adminReason}`).digest("hex").slice(0, 24)}`,
            idempotencyKey: `ADJUST:${key}`,
            targetIdempotencyKey: key,
            supportPercent,
            adminReason,
            adminEmail: auth.user.email,
          });
          const money = Number(result.money);
          if (!Number.isFinite(money)) return apiFailure(502, "HRM chưa trả tiền hỗ trợ hợp lệ.", undefined, requestId);
          await updateSheetRowById("TeachingWorkLogs", log.id, { money, policyVersion: result.policyVersion || log.policyVersion || "", updatedAt: now });
        } else {
          const userEmail = String(rows.Users.find((item) => item.teacherId === participantId)?.email || "").trim().toLowerCase();
          if (!userEmail) return apiFailure(409, "Người được phân công chưa có email HRM.", undefined, requestId);
          const eventId = deterministicTeachingEventId(key);
          const groupPeers = allSchedules.filter((item) => item.groupId && item.groupId === schedule.groupId && item.status !== "cancelled");
          const payload: TeachingPeriodPayload = {
            source: "METTASOUL", action: "SUBMIT_TEACHING_PERIOD", eventId, idempotencyKey: key,
            scheduleId: id, periodId: id, userEmail, roleCode,
            schoolId: schedule.schoolId, schoolName: String(school?.name || ""),
            classId: schedule.classId, className: String(classRoom?.name || ""),
            environmentCode: String(schedule.teachingEnvironment || "in_class"), environmentName: String(schedule.teachingEnvironment || "in_class"),
            workDate: schedule.date, periodStartAt: period.startsAt.toISOString(), periodEndAt: period.endsAt.toISOString(),
            entryMode: "CANCEL_SUPPORT", supportPercent, adminReason, approvedBy: auth.user.email,
            activityTypeCode: schedule.activityTypeCode,
            principalCount: new Set((groupPeers.length ? groupPeers : [schedule]).map((item) => item.teacherId)).size,
            policyContract: "TOPIC_REPORT_V1",
          };
          const result = await submitCancelledSupportToHrm(payload);
          const money = Number(result.money);
          if (!Number.isFinite(money)) return apiFailure(502, "HRM chưa trả tiền hỗ trợ hợp lệ.", undefined, requestId);
          await appendSheetRows("TeachingWorkLogs", [{
            id: deterministicTeachingWorkLogId(key), scheduleId: id, periodId: id, teacherId: participantId, userEmail, roleCode,
            idempotencyKey: key, eventId, status: "CONFIRMED", hrmWorkLogId: result.workLogId || "", money,
            mcpPoints: result.mcpPoints ?? "", mcpLedgerId: result.mcpLedgerId || "", policyVersion: result.policyVersion || "",
            submittedAt: now, updatedAt: now, approvedBy: auth.user.email, approvedAt: now, submissionPayload: JSON.stringify(payload),
          }]);
        }
      }
      patch.cancellationReason = String(body.adminReason || "").trim();
      patch.cancellationSupportPercent = String(body.supportPercent);
      patch.cancelledAt = now;
      notifications = [
        createNotification("Lịch đã hủy", "Một lịch dạy vừa được hủy.", "all", now),
      ];
      action = "schedule.cancel";
    } else if (status === "reassigned") {
      const nextTeacherId = String(body.teacherId || "").trim();
      const nextTimeSlotId = String(body.timeSlotId || schedule.timeSlotId || "").trim();
      const scheduleWithRestoredSlot = { ...schedule, timeSlotId: nextTimeSlotId };
      const teacherError = await validateReplacementTeacher(nextTeacherId, scheduleWithRestoredSlot, schedule.timeSlotId);
      if (teacherError) {
        return apiFailure(400, teacherError, undefined, requestId);
      }

      cancelledWorkLogIds = await cancelConfirmedTeachingWorkLogs([id]);
      patch.teacherId = nextTeacherId;
      patch.timeSlotId = nextTimeSlotId;
      patch.reassignedFrom = schedule.teacherId;
      patch.sentAt = now;
      patch.confirmedAt = "";
      patch.assistantConfirmedIds = "";
      patch.reusedLessonPlanId = "";
      resetResult = await resetScheduleAssignmentData([id]);
      notifications = [
        createNotification("Đã chuyển lịch", "Một lịch dạy vừa được chuyển sang giáo viên mới.", "admin", now),
        createNotification("Bạn có lịch dạy mới", "Vui lòng mở lịch cá nhân để xác nhận.", "teacher", now),
      ];
      action = "schedule.reassign";
      scheduleForEmail = { ...schedule, ...patch, id } as Schedule;
    } else if (status === "attended") {
      action = "schedule.attend";
    } else {
      return apiFailure(400, "Không hỗ trợ cập nhật trạng thái lịch này.", undefined, requestId);
    }

    await updateSheetRowById("Schedules", id, patch);
    invalidateScheduleConflictIndex();
    if (scheduleForEmail) {
      emailResult = await sendReassignEmail(scheduleForEmail);
    }
    if (notifications.length > 0) {
      await appendSheetRows("Notifications", notifications.map((notification) => ({ ...notification, updatedAt: now })));
    }
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action,
      entityType: "Schedule",
      entityId: id,
      route: `/api/schedules/${id}`,
      method: "PATCH",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      before: {
        status: schedule.status,
        teacherId: schedule.teacherId,
        confirmedAt: schedule.confirmedAt,
        sentAt: schedule.sentAt,
      },
      after: {
        ...patch,
        teacherId: patch.teacherId || schedule.teacherId,
        resetAttendanceCount: resetResult?.deletedAttendanceIds.length || 0,
        resetLessonPlanCount: resetResult?.deletedLessonPlanIds.length || 0,
        resetLessonPlanMessageCount: resetResult?.deletedLessonPlanMessageIds.length || 0,
        resetLessonPlanAttachmentCount: resetResult?.deletedLessonPlanAttachmentIds.length || 0,
        cancelledWorkLogIds,
      },
    });

    return NextResponse.json({ id, ...patch, emailResult, notifications, resetResult });
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const requestId = createRequestId("schedule-delete");
  try {
    const auth = await requireSessionUser(request);
    const { id } = await params;
    const schedule = await readSheetRowById("Schedules", id);
    if (!schedule) {
      return apiFailure(404, "Không tìm thấy lịch.", undefined, requestId);
    }

    const permission = evaluatePermission({
      allowed: auth.user.role === "admin",
      reason: "admin_only_schedule_delete",
    });
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] schedules.delete ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền xóa lịch.", undefined, requestId);
    }

    const cancelledWorkLogIds = await cancelConfirmedTeachingWorkLogs([id]);
    const result = await deleteSchedulesCascade([id]);
    if (schedule.schoolNeedId) {
      await ensureSheetHeaders("SchoolTeachingNeeds", schoolTeachingNeedHeaders);
      const need = await readSheetRowById("SchoolTeachingNeeds", schedule.schoolNeedId);
      if (need?.scheduleId === id) await updateSheetRowById("SchoolTeachingNeeds", need.id, { scheduleId: "", assignedDate: "", assignedStart: "", assignedEnd: "", status: "OPEN", updatedAt: new Date().toISOString() });
    }
    invalidateScheduleConflictIndex();
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "schedule.delete",
      entityType: "Schedule",
      entityId: id,
      route: `/api/schedules/${id}`,
      method: "DELETE",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      before: schedule,
      after: {
        deletedAttendanceCount: result.deletedAttendanceIds.length,
        deletedLessonPlanCount: result.deletedLessonPlanIds.length,
        deletedLessonPlanMessageCount: result.deletedLessonPlanMessageIds.length,
        deletedLessonPlanAttachmentCount: result.deletedLessonPlanAttachmentIds.length,
        trashedDriveFileCount: result.trashedDriveFileIds.length,
        deletedTeachingWorkLogCount: result.deletedTeachingWorkLogIds.length,
        cancelledWorkLogIds,
      },
    });
    return NextResponse.json({ id, deleted: true, ...result });
  } catch (error) {
    return apiError(error, requestId);
  }
}

function isAuthorized(user: User, scheduleTeacherId: string, status: ScheduleStatus) {
  if (user.role === "admin") {
    return true;
  }

  return (status === "confirmed" || status === "attended") && user.teacherId === scheduleTeacherId;
}

async function validateReplacementTeacher(
  nextTeacherId: string,
  schedule: Record<string, string>,
  originalTimeSlotId: string,
) {
  if (!nextTeacherId) {
    return "Thiếu giáo viên thay thế.";
  }
  if (nextTeacherId === schedule.teacherId) {
    return "Giáo viên thay thế phải khác giáo viên hiện tại.";
  }

  const [teachers, schedules, slots, schools] = await Promise.all([
    readSheetRows("Teachers"),
    readSheetRows("Schedules"),
    readSheetRows("TimeSlots"),
    readSheetRows("Schools"),
  ]);
  const teacher = teachers.find((item) => item.id === nextTeacherId);
  if (!teacher || teacher.active === "false") {
    return "Giáo viên thay thế không tồn tại hoặc đang tắt.";
  }

  const slot = slots.find((item) => item.id === schedule.timeSlotId);
  if (!slot) {
    return "Khung giờ của lịch không còn tồn tại. Hãy chọn khung giờ cần khôi phục trước khi chuyển lịch.";
  }
  if (schedule.timeSlotId !== originalTimeSlotId) {
    const school = schools.find((item) => item.id === schedule.schoolId);
    if (!school || !isTimeSlotAllowedForSchool({
      label: String(slot.label || ""),
      start: String(slot.start || ""),
      end: String(slot.end || ""),
    }, school.name)) {
      return "Khung giờ thay thế không thuộc trường của lịch hoặc không được phép dùng cho trường này.";
    }
  }

  const conflictingSchedule = schedules.find((item) =>
    item.id !== schedule.id &&
    item.status !== "cancelled" &&
    item.teacherId === nextTeacherId &&
    item.date === schedule.date &&
    item.timeSlotId === schedule.timeSlotId &&
    hasTeacherTimeConflict(
      [{ schoolId: item.schoolId || "", teachingEnvironment: item.teachingEnvironment }],
      { schoolId: schedule.schoolId || "", teachingEnvironment: schedule.teachingEnvironment },
    ),
  );
  if (conflictingSchedule) {
    return "Giáo viên thay thế đã có lịch trùng trong khung giờ này.";
  }

  return "";
}

async function sendReassignEmail(schedule: Schedule) {
  const [teachers, schools, classes, lessons, slots] = await Promise.all([
    readSheetRows("Teachers"),
    readSheetRows("Schools"),
    readSheetRows("Classes"),
    readSheetRows("Lessons"),
    readSheetRows("TimeSlots"),
  ]);

  const result = await sendScheduleEmail({
    schedule,
    teacher: teachers.find((teacher) => teacher.id === schedule.teacherId) || {},
    school: schools.find((school) => school.id === schedule.schoolId),
    classRoom: classes.find((classRoom) => classRoom.id === schedule.classId),
    participantClassNames: schedule.participantScope === "whole_school"
      ? ["Toàn trường"]
      : schedule.participantScope === "whole_grade"
        ? [`Toàn ${schedule.participantGrade || "khối"}`]
        : String(schedule.participantClassIds || schedule.classId || "")
            .split(",")
            .map((id) => classes.find((classRoom) => classRoom.id === id.trim())?.name)
            .filter((name): name is string => Boolean(name)),
    lesson: lessons.find((lesson) => lesson.id === schedule.lessonId),
    slot: slots.find((slot) => slot.id === schedule.timeSlotId),
  });

  return {
    scheduleId: schedule.id,
    teacherId: schedule.teacherId,
    ...result,
  };
}

function createNotification(title: string, body: string, role: Notification["role"], createdAt: string): Notification {
  return {
    id: createId("n"),
    title,
    body,
    role,
    createdAt,
    read: false,
  };
}
