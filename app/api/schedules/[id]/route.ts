import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { findAuthorizedUserFromSession } from "@/lib/auth-users";
import { sessionCookieName, verifySessionToken } from "@/lib/auth-session";
import { sendScheduleEmail } from "@/lib/email";
import { appendSheetRows, readSheetRowById, readSheetRows, updateSheetRowById } from "@/lib/google-sheets";
import type { Notification, Schedule, ScheduleStatus, User } from "@/lib/types";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const currentUser = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const status = String(body.status || "") as ScheduleStatus;
    const now = new Date().toISOString();
    const schedule = await readSheetRowById("Schedules", id);

    if (!schedule) {
      return NextResponse.json({ error: "Không tìm thấy lịch." }, { status: 404 });
    }

    const authError = getAuthorizationError(currentUser, schedule.teacherId || "", status);
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 403 });
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
        return NextResponse.json({ error: teacherError }, { status: 400 });
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
      return NextResponse.json({ error: "Không hỗ trợ cập nhật trạng thái lịch này." }, { status: 400 });
    }

    await updateSheetRowById("Schedules", id, patch);
    if (scheduleForEmail) {
      emailResult = await sendReassignEmail(scheduleForEmail);
    }
    if (notifications.length > 0) {
      await appendSheetRows("Notifications", notifications.map((notification) => ({ ...notification, updatedAt: now })));
    }
    await appendSheetRows("AuditLogs", [
      {
        id: createId("audit"),
        actorId: currentUser.id,
        actorEmail: currentUser.email,
        action,
        entityType: "Schedule",
        entityId: id,
        metadata: JSON.stringify({ status, teacherId: patch.teacherId || schedule.teacherId }),
        createdAt: now,
      },
    ]);

    return NextResponse.json({ id, ...patch, emailResult, notifications });
  } catch (error) {
    if (error instanceof RouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}

async function requireUser() {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(sessionCookieName)?.value);
  if (!session) {
    throw new RouteError(401, "Unauthorized");
  }

  const user = await findAuthorizedUserFromSession(session.userId, session.email);
  if (!user) {
    throw new RouteError(401, "Unauthorized");
  }

  return user;
}

function getAuthorizationError(user: User, scheduleTeacherId: string, status: ScheduleStatus) {
  if (user.role === "admin") {
    return "";
  }

  if ((status === "confirmed" || status === "attended") && user.teacherId === scheduleTeacherId) {
    return "";
  }

  return "Không có quyền thực hiện thao tác này.";
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

class RouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
