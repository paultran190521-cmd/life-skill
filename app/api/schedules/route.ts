import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { findAuthorizedUserFromHint, findAuthorizedUserFromSession } from "@/lib/auth-users";
import { sessionCookieName, verifySessionToken } from "@/lib/auth-session";
import { sendScheduleDigestEmail } from "@/lib/email";
import { appendSheetRows, readSheetRows, readSheetRowsBatch } from "@/lib/google-sheets";
import type { Notification, Schedule, TeachingEnvironment } from "@/lib/types";

type ScheduleDraftItem = {
  date: string;
  schoolId: string;
  classId: string;
  lessonId: string;
  timeSlotId: string;
  teachingEnvironment: TeachingEnvironment;
};

type EmailResult = {
  scheduleId?: string;
  scheduleIds: string[];
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
    const body = (await request.json()) as Record<string, unknown>;
    const currentUser = await requireUser(request, String(body.createdBy || "").trim());
    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Chỉ quản trị viên được tạo lịch." }, { status: 403 });
    }

    const now = new Date().toISOString();
    const teacherIds = parseTeacherIds(body);
    const items = parseScheduleItems(body);
    const dataRows = await readSheetRowsBatch(["Teachers", "Schools", "Classes", "Lessons", "TimeSlots"] as const);
    const teachers = dataRows.Teachers;
    const schools = dataRows.Schools;
    const classes = dataRows.Classes;
    const lessons = dataRows.Lessons;
    const slots = dataRows.TimeSlots;

    const validationError = validateScheduleInput(body, teacherIds, items, {
      teachers,
      schools,
      classes,
      lessons,
      slots,
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const schedules: Schedule[] = teacherIds.flatMap((teacherId) =>
      items.map((item) => ({
        id: createId("sch"),
        date: item.date,
        teacherId,
        schoolId: item.schoolId,
        classId: item.classId,
        lessonId: item.lessonId,
        timeSlotId: item.timeSlotId,
        teachingEnvironment: item.teachingEnvironment,
        status: "sent",
        sentAt: now,
      })),
    );

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
      "AuditLogs",
      schedules.map((schedule) => ({
        id: createId("audit"),
        actorId: currentUser.id,
        actorEmail: currentUser.email,
        action: "schedule.create",
        entityType: "Schedule",
        entityId: schedule.id,
        metadata: JSON.stringify({
          teacherId: schedule.teacherId,
          classId: schedule.classId,
          lessonId: schedule.lessonId,
          schoolId: schedule.schoolId,
        }),
        createdAt: now,
      })),
    );

    const emailResults = await sendScheduleEmailsByTeacher(schedules, { teachers, schools, classes, lessons, slots });
    const notifications = createScheduleNotifications(schedules, emailResults, now);
    await appendSheetRows("Notifications", notifications.map((notification) => ({ ...notification, updatedAt: now })));

    return NextResponse.json({ schedules, notifications, emailResults });
  } catch (error) {
    if (error instanceof RouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}

async function requireUser(request: Request, fallbackUserId?: string) {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(sessionCookieName)?.value);
  if (session) {
    const userFromSession = await findAuthorizedUserFromSession(session.userId, session.email);
    if (userFromSession) {
      return userFromSession;
    }
  }

  const userFromHeader = await findAuthorizedUserFromHint(
    request.headers.get("x-app-user-id"),
    request.headers.get("x-app-user-email"),
  );
  if (userFromHeader) {
    return userFromHeader;
  }

  if (fallbackUserId) {
    const userFromPayload = await findAuthorizedUserFromHint(fallbackUserId, "");
    if (userFromPayload) {
      return userFromPayload;
    }
  }

  throw new RouteError(401, "Unauthorized");
}

function parseTeacherIds(body: Record<string, unknown>) {
  const rawIds = Array.isArray(body.teacherIds) ? body.teacherIds : [body.teacherId];
  return Array.from(new Set(rawIds.map((id) => normalizeId(id)).filter(Boolean)));
}

function parseScheduleItems(body: Record<string, unknown>): ScheduleDraftItem[] {
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length > 0) {
    return rawItems
      .map((item) => {
        const entry = item as Record<string, unknown>;
        return {
          date: String(entry.date || entry.day || body.date || "").trim(),
          schoolId: normalizeId(entry.schoolId),
          classId: normalizeId(entry.classId),
          lessonId: normalizeId(entry.lessonId),
          timeSlotId: normalizeId(entry.timeSlotId),
          teachingEnvironment: normalizeTeachingEnvironment(entry.teachingEnvironment),
        };
      })
      .filter((item) => item.date && item.schoolId && item.classId && item.lessonId && item.timeSlotId);
  }

  const fallbackItem: ScheduleDraftItem = {
    date: String(body.date || "").trim(),
    schoolId: normalizeId(body.schoolId),
    classId: normalizeId(body.classId),
    lessonId: normalizeId(body.lessonId),
    timeSlotId: normalizeId(body.timeSlotId),
    teachingEnvironment: normalizeTeachingEnvironment(body.teachingEnvironment),
  };
  return fallbackItem.date && fallbackItem.schoolId && fallbackItem.classId && fallbackItem.lessonId && fallbackItem.timeSlotId
    ? [fallbackItem]
    : [];
}

function validateScheduleInput(
  body: Record<string, unknown>,
  teacherIds: string[],
  items: ScheduleDraftItem[],
  data: {
    teachers: Array<Record<string, string>>;
    schools: Array<Record<string, string>>;
    classes: Array<Record<string, string>>;
    lessons: Array<Record<string, string>>;
    slots: Array<Record<string, string>>;
  },
) {
  const teacherIdSet = new Set(teacherIds.map((teacherId) => normalizeId(teacherId)));

  if (teacherIds.length === 0 || items.length === 0) {
    return "Thiếu thông tin bắt buộc khi tạo lịch.";
  }

  for (const item of items) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
      return "Ngày dạy không hợp lệ.";
    }
    if (!data.schools.some((row) => normalizeId(row.id) === item.schoolId)) {
      return "Trường đã chọn không tồn tại.";
    }
    const classRoom = data.classes.find(
      (row) => normalizeId(row.id) === item.classId && normalizeId(row.schoolId) === item.schoolId,
    );
    if (!classRoom) {
      return "Lớp đã chọn không thuộc trường đã chọn.";
    }
    const lesson = data.lessons.find((row) => normalizeId(row.id) === item.lessonId && isRowActive(row));
    if (!lesson) {
      return "Bài học đã chọn không tồn tại hoặc đang tắt.";
    }
    if (normalizeComparableText(classRoom.grade) !== normalizeComparableText(lesson.grade)) {
      return "Bài học đã chọn không đúng khối của lớp.";
    }
    if (!data.slots.some((row) => normalizeId(row.id) === item.timeSlotId && isRowActive(row))) {
      return "Khung giờ đã chọn không tồn tại hoặc đang tắt.";
    }
  }

  const activeTeacherIds = new Set(
    data.teachers.filter((item) => isRowActive(item)).map((item) => normalizeId(item.id)),
  );
  if (!Array.from(teacherIdSet).every((teacherId) => activeTeacherIds.has(teacherId))) {
    return "Một hoặc nhiều giáo viên đã chọn không tồn tại hoặc đang tắt.";
  }

  return "";
}

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

function isRowActive(row: Record<string, string>) {
  const raw = String(row.active ?? row.isActive ?? "").trim().toLowerCase();
  if (!raw) {
    return true;
  }
  return !["false", "0", "no", "inactive", "disabled", "off"].includes(raw);
}

function normalizeComparableText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeTeachingEnvironment(value: unknown): TeachingEnvironment {
  const normalized = normalizeId(value) as TeachingEnvironment;
  const allowed: TeachingEnvironment[] = ["in_class", "outdoor", "gym", "schoolyard_report"];
  return allowed.includes(normalized) ? normalized : "in_class";
}

function createScheduleNotifications(schedules: Schedule[], emailResults: EmailResult[], now: string): Notification[] {
  const sentEmails = emailResults.filter((item) => item.sent).length;
  const failedEmails = emailResults.length - sentEmails;
  return [
    {
      id: createId("n"),
      title: "Đã gửi lịch dạy",
      body: `${schedules.length} lịch mới đã được tạo. Email tổng hợp: ${sentEmails} thành công${
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

async function sendScheduleEmailsByTeacher(
  schedules: Schedule[],
  data: {
    teachers: Array<Record<string, string>>;
    schools: Array<Record<string, string>>;
    classes: Array<Record<string, string>>;
    lessons: Array<Record<string, string>>;
    slots: Array<Record<string, string>>;
  },
): Promise<EmailResult[]> {
  const grouped = new Map<string, Schedule[]>();
  for (const schedule of schedules) {
    const list = grouped.get(schedule.teacherId) || [];
    list.push(schedule);
    grouped.set(schedule.teacherId, list);
  }

  return Promise.all(
    Array.from(grouped.entries()).map(async ([teacherId, teacherSchedules]) => {
      const teacher = data.teachers.find((item) => normalizeId(item.id) === normalizeId(teacherId)) || {};
      const result = await sendScheduleDigestEmail({
        teacher,
        schedules: teacherSchedules,
        rows: teacherSchedules.map((schedule) => ({
          schedule,
          school: data.schools.find((item) => normalizeId(item.id) === normalizeId(schedule.schoolId)),
          classRoom: data.classes.find((item) => normalizeId(item.id) === normalizeId(schedule.classId)),
          lesson: data.lessons.find((item) => normalizeId(item.id) === normalizeId(schedule.lessonId)),
          slot: data.slots.find((item) => normalizeId(item.id) === normalizeId(schedule.timeSlotId)),
        })),
      });

      return {
        scheduleId: teacherSchedules[0]?.id,
        scheduleIds: teacherSchedules.map((schedule) => schedule.id),
        teacherId,
        ...result,
      };
    }),
  );
}

class RouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
