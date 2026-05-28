import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { sendScheduleDigestEmail } from "@/lib/email";
import { appendSheetRows, readSheetRows, readSheetRowsBatch } from "@/lib/google-sheets";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";
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
  const requestId = createRequestId("schedules-list");
  try {
    return NextResponse.json(await readSheetRows("Schedules"));
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId("schedule");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_schedules_create");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] schedules.create ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Chỉ quản trị viên được tạo lịch.", undefined, requestId);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const now = new Date().toISOString();
    const teacherIds = parseTeacherIds(body);
    const items = parseScheduleItems(body);
    const dataRows = await readSheetRowsBatch(["Teachers", "Schools", "Classes", "Lessons", "TimeSlots"] as const);
    const teachers = dataRows.Teachers;
    const schools = dataRows.Schools;
    const classes = dataRows.Classes;
    const lessons = dataRows.Lessons;
    const slots = dataRows.TimeSlots;
    const normalizedItems = normalizeScheduleItems(items, { schools, classes, lessons, slots });

    const validationMessage = validateScheduleInput(body, teacherIds, normalizedItems, {
      teachers,
      schools,
      classes,
      lessons,
      slots,
    });
    if (validationMessage) {
      return apiFailure(400, validationMessage, undefined, requestId);
    }

    const schedules: Schedule[] = teacherIds.flatMap((teacherId) =>
      normalizedItems.map((item) => ({
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
        createdBy: auth.user.id,
        createdAt: now,
        updatedAt: now,
      })),
    );

    const emailResults = await sendScheduleEmailsByTeacher(schedules, { teachers, schools, classes, lessons, slots });
    const notifications = createScheduleNotifications(schedules, emailResults, now);
    await appendSheetRows("Notifications", notifications.map((notification) => ({ ...notification, updatedAt: now })));

    await Promise.all(
      schedules.map((schedule) =>
        appendAuditLog({
          requestId,
          actor: auth.user,
          action: "schedule.create",
          entityType: "Schedule",
          entityId: schedule.id,
          route: "/api/schedules",
          method: "POST",
          authMode: permission.authMode,
          decision: permission.decision,
          reason: permission.reason,
          source: auth.source,
          after: {
            teacherId: schedule.teacherId,
            classId: schedule.classId,
            lessonId: schedule.lessonId,
            schoolId: schedule.schoolId,
            status: schedule.status,
          },
        }),
      ),
    );

    return NextResponse.json({ schedules, notifications, emailResults });
  } catch (error) {
    return apiError(error, requestId);
  }
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

function normalizeScheduleItems(
  items: ScheduleDraftItem[],
  data: {
    schools: Array<Record<string, string>>;
    classes: Array<Record<string, string>>;
    lessons: Array<Record<string, string>>;
    slots: Array<Record<string, string>>;
  },
) {
  return items.map((item) => {
    const school = findSchool(data.schools, item.schoolId);
    const schoolId = normalizeId(school?.id) || item.schoolId;

    const classRoom = findClassRoom(data.classes, item.classId, school);
    const classId = normalizeId(classRoom?.id) || item.classId;

    const lesson = findLesson(data.lessons, item.lessonId);
    const lessonId = normalizeId(lesson?.id) || item.lessonId;

    const slot = findTimeSlot(data.slots, item.timeSlotId);
    const timeSlotId = normalizeId(slot?.id) || item.timeSlotId;

    return {
      ...item,
      schoolId,
      classId,
      lessonId,
      timeSlotId,
    };
  });
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
    const school = findSchool(data.schools, item.schoolId);
    if (!school) {
      return "Trường đã chọn không tồn tại.";
    }
    const classRoom = findClassRoom(data.classes, item.classId, school);
    if (!classRoom) {
      return "Lớp đã chọn không thuộc trường đã chọn.";
    }
    const lesson = findLesson(data.lessons, item.lessonId);
    if (!lesson) {
      return "Bài học đã chọn không tồn tại hoặc đang tắt.";
    }
    if (normalizeComparableText(classRoom.grade) !== normalizeComparableText(lesson.grade)) {
      return "Bài học đã chọn không đúng khối của lớp.";
    }
    if (!findTimeSlot(data.slots, item.timeSlotId)) {
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

function findSchool(rows: Array<Record<string, string>>, schoolIdOrName: string) {
  const targetId = normalizeId(schoolIdOrName);
  const targetName = normalizeComparableText(schoolIdOrName);
  return rows.find((row) => {
    const rowId = normalizeId(row.id);
    const rowName = normalizeComparableText(row.name);
    return (rowId && rowId === targetId) || (rowName && rowName === targetName);
  });
}

function findClassRoom(
  rows: Array<Record<string, string>>,
  classIdOrName: string,
  school: Record<string, string> | undefined,
) {
  const targetClassId = normalizeId(classIdOrName);
  const targetClassName = normalizeComparableText(classIdOrName);
  const schoolId = normalizeId(school?.id);
  const schoolName = normalizeComparableText(school?.name);

  return rows.find((row) => {
    const rowClassId = normalizeId(row.id);
    const rowClassName = normalizeComparableText(row.name);
    const rowSchoolId = normalizeId(row.schoolId);
    const rowSchoolName = normalizeComparableText(row.schoolId);
    const classMatched = (rowClassId && rowClassId === targetClassId) || (rowClassName && rowClassName === targetClassName);
    const schoolMatched =
      !school || !schoolId
        ? true
        : rowSchoolId === schoolId || (schoolName && rowSchoolName === schoolName);
    return classMatched && schoolMatched;
  });
}

function findLesson(rows: Array<Record<string, string>>, lessonIdOrTitle: string) {
  const targetId = normalizeId(lessonIdOrTitle);
  const targetTitle = normalizeComparableText(lessonIdOrTitle);
  return rows.find((row) => {
    if (!isRowActive(row)) {
      return false;
    }
    const rowId = normalizeId(row.id);
    const rowTitle = normalizeComparableText(row.title);
    return (rowId && rowId === targetId) || (rowTitle && rowTitle === targetTitle);
  });
}

function findTimeSlot(rows: Array<Record<string, string>>, slotIdOrLabel: string) {
  const targetId = normalizeId(slotIdOrLabel);
  const targetLabel = normalizeComparableText(slotIdOrLabel);
  return rows.find((row) => {
    if (!isRowActive(row)) {
      return false;
    }
    const rowId = normalizeId(row.id);
    const rowLabel = normalizeComparableText(row.label);
    return (rowId && rowId === targetId) || (rowLabel && rowLabel === targetLabel);
  });
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
  const failureSummary = summarizeEmailFailures(emailResults);
  if (failureSummary) {
    console.error("[schedule-email-failures]", failureSummary);
  }

  const adminBody =
    `${schedules.length} lịch mới đã được tạo. Email tổng hợp: ${sentEmails} thành công${
      failedEmails ? `, ${failedEmails} lỗi gửi` : ""
    }.` + (failureSummary ? ` Lý do: ${failureSummary}` : "");

  return [
    {
      id: createId("n"),
      title: "Đã gửi lịch dạy",
      body: adminBody,
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

function summarizeEmailFailures(emailResults: EmailResult[]) {
  const failures = emailResults.filter((item) => !item.sent);
  if (failures.length === 0) {
    return "";
  }

  return failures
    .slice(0, 2)
    .map((item) => {
      const reason = String(item.reason || "Unknown error").replace(/\s+/g, " ").trim();
      const teacher = item.teacherId || "unknown-teacher";
      return `${teacher}: ${reason}`;
    })
    .join(" | ")
    .slice(0, 500);
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
