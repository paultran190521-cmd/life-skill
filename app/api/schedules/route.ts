import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog, appendAuditLogs } from "@/lib/audit";
import { sendScheduleDigestEmail } from "@/lib/email";
import { appendSheetRows, readSheetRows, readSheetRowsBatch, readSheetRowsCached } from "@/lib/google-sheets";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";
import type { LessonPeriod, Notification, Schedule, TeachingEnvironment } from "@/lib/types";

type ScheduleDraftItem = {
  date: string;
  schoolId: string;
  classId: string;
  classIds: string[];
  lessonId: string;
  lessonPeriods: LessonPeriod[];
  timeSlotId: string;
  teachingEnvironment: TeachingEnvironment;
  teacherIds: string[];
  assistantIds?: string;
};

type EmailResult = {
  scheduleId?: string;
  scheduleIds: string[];
  teacherId: string;
  sent: boolean;
  reason?: string;
  id?: string;
};

export async function GET(request: Request) {
  const requestId = createRequestId("schedules-list");
  try {
    const auth = await requireSessionUser(request);
    const rows = await readSheetRows("Schedules");
    if (auth.user.role !== "admin") {
      const teacherId = String(auth.user.teacherId || "").trim();
      return NextResponse.json(rows.filter((row) => String(row.teacherId || "").trim() === teacherId));
    }
    return NextResponse.json(rows);
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
    const items = parseScheduleItems(body, teacherIds);
    const { teachers, schools, classes, lessons, slots } = await loadReferenceData();
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

    const schedules: Schedule[] = normalizedItems.flatMap((item) => {
      const isGroupActivity = item.teachingEnvironment !== "in_class";
      const participantClassIds = item.classIds.join(",");
      const groupId = isGroupActivity ? createId("grp") : undefined;
      const primaryClassId = item.classIds[0];

      // Hoạt động chung chỉ là một buổi dạy cho mỗi giáo viên. Danh sách lớp
      // được giữ ở participantClassIds thay vì nhân bản lịch và email theo lớp.
      return item.teacherIds.map((teacherId) => ({
          id: createId("sch"),
          date: item.date,
          teacherId,
          schoolId: item.schoolId,
          classId: primaryClassId,
          participantClassIds,
          lessonId: item.lessonId,
          lessonPeriods: item.lessonPeriods.join(","),
          timeSlotId: item.timeSlotId,
          teachingEnvironment: item.teachingEnvironment,
          groupId,
          assistantIds: item.assistantIds,
          status: "sent",
          sentAt: now,
        }));
    });

    const conflicts = await detectScheduleConflictsSafe(schedules);
    if (conflicts.length > 0) {
      return apiFailure(409, buildConflictMessage(conflicts), "CONFLICT", requestId);
    }

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

    const auditInputs = schedules.map((schedule) => ({
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
        participantClassIds: schedule.participantClassIds,
        lessonId: schedule.lessonId,
        lessonPeriods: schedule.lessonPeriods,
        schoolId: schedule.schoolId,
        status: schedule.status,
      },
    }));

    if (isFeatureEnabled("SCHEDULE_AUDIT_BATCH_ENABLED", true)) {
      await appendAuditLogs(auditInputs);
    } else {
      await Promise.all(auditInputs.map((input) => appendAuditLog(input)));
    }

    return NextResponse.json({ schedules, notifications, emailResults });
  } catch (error) {
    return apiError(error, requestId);
  }
}

async function loadReferenceData() {
  if (isFeatureEnabled("SCHEDULE_REFERENCE_CACHE_ENABLED", false)) {
    const ttlMs = readPositiveIntEnv("SCHEDULE_REFERENCE_CACHE_TTL_MS", 60_000);
    const [teachers, schools, classes, lessons, slots] = await Promise.all([
      readSheetRowsCached("Teachers", { ttlMs }),
      readSheetRowsCached("Schools", { ttlMs }),
      readSheetRowsCached("Classes", { ttlMs }),
      readSheetRowsCached("Lessons", { ttlMs }),
      readSheetRowsCached("TimeSlots", { ttlMs }),
    ]);
    return { teachers, schools, classes, lessons, slots };
  }

  const dataRows = await readSheetRowsBatch(["Teachers", "Schools", "Classes", "Lessons", "TimeSlots"] as const);
  return {
    teachers: dataRows.Teachers,
    schools: dataRows.Schools,
    classes: dataRows.Classes,
    lessons: dataRows.Lessons,
    slots: dataRows.TimeSlots,
  };
}

type ScheduleConflict = {
  conflictType: "teacher" | "class";
  source: "existing" | "draft";
  date: string;
  timeSlotId: string;
  teacherId: string;
  classId: string;
};

function detectScheduleConflicts(schedules: Schedule[], existingRows: Array<Record<string, string>>) {
  const conflicts: ScheduleConflict[] = [];
  const dedupe = new Set<string>();
  const activeExistingRows = existingRows.filter(
    (row) => normalizeComparableText(row.status || "") !== "cancelled",
  );
  const seenDrafts: Schedule[] = [];

  for (const schedule of schedules) {
    for (const existing of activeExistingRows) {
      checkConflictPair(conflicts, dedupe, schedule, existing, "existing");
    }
    for (const draft of seenDrafts) {
      checkConflictPair(conflicts, dedupe, schedule, draft, "draft");
    }
    seenDrafts.push(schedule);
  }

  return conflicts;
}

async function detectScheduleConflictsSafe(schedules: Schedule[]) {
  // Môi trường là một phần của luật xung đột. Index cũ chỉ lưu key giáo viên/lớp
  // nên không đủ ngữ cảnh để phân biệt tiết trong lớp và hoạt động chung.
  const existingSchedules = await readSheetRows("Schedules");
  return detectScheduleConflicts(schedules, existingSchedules);
}

function checkConflictPair(
  conflicts: ScheduleConflict[],
  dedupe: Set<string>,
  schedule: Schedule,
  other: Pick<Schedule, "date" | "timeSlotId" | "teacherId" | "classId" | "schoolId" | "teachingEnvironment"> | Record<string, string>,
  source: "existing" | "draft",
) {
  if (normalizeId(schedule.date) !== normalizeId(other.date) || normalizeId(schedule.timeSlotId) !== normalizeId(other.timeSlotId)) {
    return;
  }
  if (canShareGroupActivitySlot(schedule, other)) {
    return;
  }
  if (normalizeId(schedule.teacherId) === normalizeId(other.teacherId)) {
    addConflict(conflicts, dedupe, {
      conflictType: "teacher",
      source,
      date: schedule.date,
      timeSlotId: schedule.timeSlotId,
      teacherId: schedule.teacherId,
      classId: schedule.classId,
    });
  }
  if (scheduleParticipantClassIds(schedule).some((classId) => scheduleParticipantClassIds(other).includes(classId))) {
    addConflict(conflicts, dedupe, {
      conflictType: "class",
      source,
      date: schedule.date,
      timeSlotId: schedule.timeSlotId,
      teacherId: schedule.teacherId,
      classId: schedule.classId,
    });
  }
}

function scheduleParticipantClassIds(schedule: Pick<Schedule, "classId" | "participantClassIds"> | Record<string, string>) {
  return parseIds(schedule.participantClassIds || schedule.classId);
}

function canShareGroupActivitySlot(
  schedule: Pick<Schedule, "schoolId" | "teachingEnvironment">,
  other: Pick<Schedule, "schoolId" | "teachingEnvironment"> | Record<string, string>,
) {
  return (
    normalizeId(schedule.schoolId) === normalizeId(other.schoolId) &&
    normalizeTeachingEnvironment(schedule.teachingEnvironment) !== "in_class" &&
    normalizeTeachingEnvironment(other.teachingEnvironment) !== "in_class"
  );
}

function addConflict(
  conflicts: ScheduleConflict[],
  dedupe: Set<string>,
  conflict: ScheduleConflict,
) {
  const key = `${conflict.source}|${conflict.conflictType}|${conflict.date}|${conflict.timeSlotId}|${conflict.teacherId}|${conflict.classId}`;
  if (dedupe.has(key)) {
    return;
  }
  dedupe.add(key);
  conflicts.push(conflict);
}

function buildConflictMessage(conflicts: ScheduleConflict[]) {
  const sample = conflicts.slice(0, 5).map((item) => {
    const target = item.conflictType === "teacher" ? `giáo viên ${item.teacherId}` : `lớp ${item.classId}`;
    const source = item.source === "existing" ? "đã có lịch" : "bị trùng trong danh sách sắp gửi";
    return `${item.date} - ${item.timeSlotId}: ${target} ${source}`;
  });

  return `Phát hiện ${conflicts.length} xung đột lịch. Vui lòng kiểm tra lại trước khi gửi. ${sample.join(" | ")}`;
}

function parseTeacherIds(body: Record<string, unknown>) {
  const rawIds = Array.isArray(body.teacherIds) ? body.teacherIds : [body.teacherId];
  return Array.from(new Set(rawIds.map((id) => normalizeId(id)).filter(Boolean)));
}

function parseScheduleItems(body: Record<string, unknown>, fallbackTeacherIds: string[]): ScheduleDraftItem[] {
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length > 0) {
    return rawItems
      .map((item) => {
        const entry = item as Record<string, unknown>;
        const classIds = parseIds(entry.classIds ?? entry.classId);
        return {
          date: String(entry.date || entry.day || body.date || "").trim(),
          schoolId: normalizeId(entry.schoolId),
          classId: classIds[0] || "",
          classIds,
          lessonId: normalizeId(entry.lessonId),
          lessonPeriods: parseLessonPeriods(entry.lessonPeriods),
          timeSlotId: normalizeId(entry.timeSlotId),
          teachingEnvironment: normalizeTeachingEnvironment(entry.teachingEnvironment),
          teacherIds: parseIds(entry.teacherIds).length > 0 ? parseIds(entry.teacherIds) : fallbackTeacherIds,
          assistantIds: parseIds(entry.assistantIds).join(",") || undefined,
        };
      })
      .filter((item) => item.date && item.schoolId && item.classId && item.lessonId && item.timeSlotId);
  }

  const fallbackItem: ScheduleDraftItem = {
    date: String(body.date || "").trim(),
    schoolId: normalizeId(body.schoolId),
    classId: normalizeId(body.classId),
    classIds: parseIds(body.classIds ?? body.classId),
    lessonId: normalizeId(body.lessonId),
    lessonPeriods: parseLessonPeriods(body.lessonPeriods),
    timeSlotId: normalizeId(body.timeSlotId),
    teachingEnvironment: normalizeTeachingEnvironment(body.teachingEnvironment),
    teacherIds: fallbackTeacherIds,
    assistantIds: parseIds(body.assistantIds).join(",") || undefined,
  };
  return fallbackItem.date && fallbackItem.schoolId && fallbackItem.classIds.length > 0 && fallbackItem.lessonId && fallbackItem.timeSlotId
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

    const classIds = item.classIds
      .map((classId) => findClassRoom(data.classes, classId, school))
      .filter((classRoom): classRoom is Record<string, string> => Boolean(classRoom))
      .map((classRoom) => normalizeId(classRoom.id));

    const lesson = findLesson(data.lessons, item.lessonId);
    const lessonId = normalizeId(lesson?.id) || item.lessonId;

    const slot = findTimeSlot(data.slots, item.timeSlotId);
    const timeSlotId = normalizeId(slot?.id) || item.timeSlotId;

    return {
      ...item,
      schoolId,
      classId: classIds[0] || item.classId,
      classIds,
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
  if (items.length === 0) {
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
    const lesson = findLesson(data.lessons, item.lessonId);
    if (!lesson) {
      return "Bài học đã chọn không tồn tại hoặc đang tắt.";
    }
    if (item.classIds.length === 0) {
      return "Chưa chọn lớp cần giao lịch.";
    }
    for (const classId of item.classIds) {
      const classRoom = findClassRoom(data.classes, classId, school);
      if (!classRoom) {
        return "Lớp đã chọn không thuộc trường đã chọn.";
      }
      if (
        item.teachingEnvironment === "in_class" &&
        normalizeComparableText(classRoom.grade) !== normalizeComparableText(lesson.grade)
      ) {
        return "Bài học đã chọn không đúng khối của lớp.";
      }
    }
    if (!findTimeSlot(data.slots, item.timeSlotId)) {
      return "Khung giờ đã chọn không tồn tại hoặc đang tắt.";
    }
  }

  const activeTeacherIds = new Set(
    data.teachers.filter((item) => isRowActive(item)).map((item) => normalizeId(item.id)),
  );
  const itemTeacherIds = items.flatMap((item) => item.teacherIds);
  if (itemTeacherIds.length === 0 || !Array.from(new Set(itemTeacherIds)).every((teacherId) => activeTeacherIds.has(teacherId))) {
    return "Một hoặc nhiều giáo viên đã chọn không tồn tại hoặc đang tắt.";
  }

  return "";
}

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

function parseIds(value: unknown) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return Array.from(new Set(values.map((item) => normalizeId(item)).filter(Boolean)));
}

function parseLessonPeriods(value: unknown): LessonPeriod[] {
  const raw = Array.isArray(value) ? value : String(value || "lesson1").split(",");
  const periods = raw
    .map((item) => normalizeId(item))
    .filter((item): item is LessonPeriod => item === "lesson1" || item === "lesson2");
  return periods.length > 0 ? Array.from(new Set(periods)) : ["lesson1"];
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

function isFeatureEnabled(key: string, fallback: boolean) {
  const raw = String(process.env[key] ?? "").trim().toLowerCase();
  if (!raw) {
    return fallback;
  }
  return ["1", "true", "yes", "on", "enabled"].includes(raw);
}

function readPositiveIntEnv(key: string, fallback: number) {
  const value = Number(process.env[key] || fallback);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function normalizeTeachingEnvironment(value: unknown): TeachingEnvironment {
  const normalized = normalizeId(value) as TeachingEnvironment;
  const allowed: TeachingEnvironment[] = ["in_class", "outdoor", "gym", "schoolyard_report", "hall"];
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
          participantClassNames: scheduleParticipantClassIds(schedule)
            .map((classId) => data.classes.find((item) => normalizeId(item.id) === classId)?.name)
            .filter((name): name is string => Boolean(name)),
          lesson: data.lessons.find((item) => normalizeId(item.id) === normalizeId(schedule.lessonId)),
          slot: data.slots.find((item) => normalizeId(item.id) === normalizeId(schedule.timeSlotId)),
          assistantNames: parseIds(schedule.assistantIds)
            .map((assistantId) => data.teachers.find((item) => normalizeId(item.id) === assistantId)?.name)
            .filter((name): name is string => Boolean(name)),
          coTeacherNames:
            schedule.teachingEnvironment !== "in_class" && schedule.groupId
              ? Array.from(
                  new Set(
                    schedules
                      .filter((item) => item.groupId === schedule.groupId && normalizeId(item.teacherId) !== normalizeId(schedule.teacherId))
                      .map((item) => data.teachers.find((teacher) => normalizeId(teacher.id) === normalizeId(item.teacherId))?.name)
                      .filter((name): name is string => Boolean(name)),
                  ),
                )
              : [],
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
