import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { sendScheduleEmail } from "@/lib/email";
import { appendSheetRows, readSheetRowById, readSheetRows, updateSheetRowById } from "@/lib/google-sheets";
import { evaluatePermission, requireSessionUser } from "@/lib/route-auth";
import type { Notification, Schedule, ScheduleStatus, User } from "@/lib/types";

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

    if (status === "confirmed") {
      patch.confirmedAt = now;
      notifications = [
        createNotification("Giáo viên đã nhận lịch", "Một lịch dạy vừa được xác nhận.", "admin", now),
      ];
      action = "schedule.confirm";
    } else if (status === "cancelled") {
      patch.cancelledAt = now;
      notifications = [
        createNotification("Lịch đã hủy", "Một lịch dạy vừa được hủy.", "all", now),
      ];
      action = "schedule.cancel";
    } else if (status === "reassigned") {
      const nextTeacherId = String(body.teacherId || "").trim();
      const teacherError = await validateReplacementTeacher(nextTeacherId, schedule.teacherId || "");
      if (teacherError) {
        return apiFailure(400, teacherError, undefined, requestId);
      }

      patch.teacherId = nextTeacherId;
      patch.reassignedFrom = schedule.teacherId;
      patch.sentAt = now;
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
      },
    });

    return NextResponse.json({ id, ...patch, emailResult, notifications });
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

async function validateReplacementTeacher(nextTeacherId: string, currentTeacherId: string) {
  if (!nextTeacherId) {
    return "Thiếu giáo viên thay thế.";
  }
  if (nextTeacherId === currentTeacherId) {
    return "Giáo viên thay thế phải khác giáo viên hiện tại.";
  }

  const teachers = await readSheetRows("Teachers");
  const teacher = teachers.find((item) => item.id === nextTeacherId);
  if (!teacher || teacher.active === "false") {
    return "Giáo viên thay thế không tồn tại hoặc đang tắt.";
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
