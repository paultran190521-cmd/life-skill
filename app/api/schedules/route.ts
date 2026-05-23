import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { findAuthorizedUserFromSession } from "@/lib/auth-users";
import { sessionCookieName, verifySessionToken } from "@/lib/auth-session";
import { sendScheduleEmail } from "@/lib/email";
import { appendSheetRows, readSheetRows } from "@/lib/google-sheets";
import type { ChatThread, Notification, Schedule } from "@/lib/types";

type EmailResult = {
  scheduleId: string;
  teacherId: string;
  sent: boolean;
  reason?: string;
  id?: string;
};

export async function GET() {
  try {
    return NextResponse.json(await readSheetRows("Schedules"));
  } catch (error) {
    if (error instanceof RouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireUser();
    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Chỉ quản trị viên được tạo lịch." }, { status: 403 });
    }

    const body = await request.json();
    const now = new Date().toISOString();
    const teacherIds = parseTeacherIds(body);

    const [teachers, schools, classes, lessons, slots] = await Promise.all([
      readSheetRows("Teachers"),
      readSheetRows("Schools"),
      readSheetRows("Classes"),
      readSheetRows("Lessons"),
      readSheetRows("TimeSlots"),
    ]);

    const validationError = validateScheduleInput(body, teacherIds, {
      teachers,
      schools,
      classes,
      lessons,
      slots,
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const schedules: Schedule[] = teacherIds.map((teacherId) => ({
      id: createId("sch"),
      date: String(body.date).trim(),
      teacherId,
      schoolId: String(body.schoolId).trim(),
      classId: String(body.classId).trim(),
      lessonId: String(body.lessonId).trim(),
      timeSlotId: String(body.timeSlotId).trim(),
      status: "sent",
      sentAt: now,
    }));

    const chatThreads = schedules.map<ChatThread>((schedule) => {
      const classRoom = classes.find((item) => item.id === schedule.classId);
      const slot = slots.find((item) => item.id === schedule.timeSlotId);
      return {
        id: `thread-${schedule.id}`,
        type: "schedule",
        teacherId: schedule.teacherId,
        scheduleId: schedule.id,
        title: `${slot?.label || "Tiết"} - Lớp ${classRoom?.name || ""}`,
      };
    });

    await appendSheetRows(
      "Schedules",
      schedules.map((schedule) => ({
        ...schedule,
        createdBy: currentUser.id,
        createdAt: now,
        updatedAt: now,
      })),
    );
    await appendSheetRows(
      "ChatThreads",
      chatThreads.map((thread) => ({ ...thread, createdAt: now, updatedAt: now })),
    );
    await appendSheetRows(
      "AuditLogs",
      schedules.map((schedule) => ({
        id: createId("audit"),
        actorId: currentUser.id,
        actorEmail: currentUser.email,
        action: "schedule.create",
        entityType: "Schedule",
        entityId: schedule.id,
        metadata: JSON.stringify({ teacherId: schedule.teacherId, classId: schedule.classId }),
        createdAt: now,
      })),
    );

    const emailResults = await sendScheduleEmails(schedules, { teachers, schools, classes, lessons, slots });
    const notifications = createScheduleNotifications(schedules, emailResults, now);
    await appendSheetRows("Notifications", notifications.map((notification) => ({ ...notification, updatedAt: now })));

    return NextResponse.json({ schedules, chatThreads, notifications, emailResults });
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
    return nullUserError();
  }

  const user = await findAuthorizedUserFromSession(session.userId, session.email);
  if (!user) {
    return nullUserError();
  }

  return user;
}

function nullUserError(): never {
  throw new RouteError(401, "Unauthorized");
}

class RouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function parseTeacherIds(body: Record<string, unknown>) {
  const rawIds = Array.isArray(body.teacherIds) ? body.teacherIds : [body.teacherId];
  return Array.from(new Set(rawIds.map((id) => String(id || "").trim()).filter(Boolean)));
}

function validateScheduleInput(
  body: Record<string, unknown>,
  teacherIds: string[],
  data: {
    teachers: Array<Record<string, string>>;
    schools: Array<Record<string, string>>;
    classes: Array<Record<string, string>>;
    lessons: Array<Record<string, string>>;
    slots: Array<Record<string, string>>;
  },
) {
  const date = String(body.date || "").trim();
  const schoolId = String(body.schoolId || "").trim();
  const classId = String(body.classId || "").trim();
  const lessonId = String(body.lessonId || "").trim();
  const timeSlotId = String(body.timeSlotId || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return "Ngày dạy không hợp lệ.";
  }
  if (!schoolId || !classId || !lessonId || !timeSlotId || teacherIds.length === 0) {
    return "Thiếu thông tin bắt buộc khi tạo lịch.";
  }
  if (!data.schools.some((item) => item.id === schoolId)) {
    return "Trường đã chọn không tồn tại.";
  }
  if (!data.classes.some((item) => item.id === classId && item.schoolId === schoolId)) {
    return "Lớp đã chọn không thuộc trường đã chọn.";
  }
  if (!data.lessons.some((item) => item.id === lessonId && item.active !== "false")) {
    return "Bài học đã chọn không tồn tại hoặc đang tắt.";
  }
  if (!data.slots.some((item) => item.id === timeSlotId && item.active !== "false")) {
    return "Khung giờ đã chọn không tồn tại hoặc đang tắt.";
  }
  if (!teacherIds.every((teacherId) => data.teachers.some((item) => item.id === teacherId && item.active !== "false"))) {
    return "Một hoặc nhiều giáo viên đã chọn không tồn tại hoặc đang tắt.";
  }

  return "";
}

function createScheduleNotifications(schedules: Schedule[], emailResults: EmailResult[], now: string): Notification[] {
  const sentEmails = emailResults.filter((item) => item.sent).length;
  const failedEmails = emailResults.length - sentEmails;
  return [
    {
      id: createId("n"),
      title: "Đã gửi lịch dạy",
      body: `${schedules.length} lịch mới đã được tạo. Email CTA: ${sentEmails} thành công${
        failedEmails ? `, ${failedEmails} lỗi gửi` : ""
      }.`,
      role: "admin",
      createdAt: now,
      read: false,
    },
    {
      id: createId("n"),
      title: "Bạn có lịch dạy mới",
      body: "Vui lòng mở lịch cá nhân để xác nhận.",
      role: "teacher",
      createdAt: now,
      read: false,
    },
  ];
}

async function sendScheduleEmails(
  schedules: Schedule[],
  data: {
    teachers: Array<Record<string, string>>;
    schools: Array<Record<string, string>>;
    classes: Array<Record<string, string>>;
    lessons: Array<Record<string, string>>;
    slots: Array<Record<string, string>>;
  },
): Promise<EmailResult[]> {
  return Promise.all(
    schedules.map(async (schedule) => {
      const result = await sendScheduleEmail({
        schedule,
        teacher: data.teachers.find((teacher) => teacher.id === schedule.teacherId) || {},
        school: data.schools.find((school) => school.id === schedule.schoolId),
        classRoom: data.classes.find((classRoom) => classRoom.id === schedule.classId),
        lesson: data.lessons.find((lesson) => lesson.id === schedule.lessonId),
        slot: data.slots.find((slot) => slot.id === schedule.timeSlotId),
      });

      return {
        scheduleId: schedule.id,
        teacherId: schedule.teacherId,
        ...result,
      };
    }),
  );
}
