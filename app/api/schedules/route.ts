import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog, appendAuditLogs } from "@/lib/audit";
import { sendScheduleDigestEmail } from "@/lib/email";
import { appendSheetRows, clearSheetData, readSheetRows, readSheetRowsBatch, readSheetRowsCached } from "@/lib/google-sheets";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";
import { canShareClassTimeSlot, hasTeacherTimeConflict, type GroupClassTimeSlot } from "@/lib/schedule-conflict-policy";
import {
  addSchedulesToConflictIndex,
  getScheduleConflictIndex,
  invalidateScheduleConflictIndex,
  type TeacherSlotInfo,
} from "@/lib/schedule-conflict-index";
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
  assistantIds: string[];
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
    const fallbackTeacherIds = parseTeacherIds(body);
    const items = parseScheduleItems(body, fallbackTeacherIds);
    const { teachers, users, schools, classes, lessons, slots } = await loadReferenceData();
    const normalizedItems = normalizeScheduleItems(items, { schools, classes, lessons, slots });
    const teacherIds = Array.from(new Set(normalizedItems.flatMap((item) => item.teacherIds)));
    const assistantIds = Array.from(new Set(normalizedItems.flatMap((item) => item.assistantIds)));

    const validationMessage = validateScheduleInput(teacherIds, normalizedItems, {
      teachers,
      users,
      schools,
      classes,
      lessons,
      slots,
    }, assistantIds);
    if (validationMessage) {
      return apiFailure(400, validationMessage, undefined, requestId);
    }

    const schedules: Schedule[] = normalizedItems.flatMap((item) => {
      // Những giáo viên cùng được chọn trên một dòng là một nhóm cùng giảng.
      // Lưu groupId để các luồng hiển thị/email nhận diện đúng, không suy đoán
      // từ các lịch trùng giờ độc lập.
      const groupId = item.teacherIds.length > 1 || item.classIds.length > 1 ? createId("grp") : undefined;
      return item.teacherIds.map((teacherId) => ({
        id: createId("sch"),
        date: item.date,
        teacherId,
        schoolId: item.schoolId,
        classId: item.classId,
        participantClassIds: item.classIds.join(","),
        lessonId: item.lessonId,
        lessonPeriods: item.lessonPeriods.join(","),
        timeSlotId: item.timeSlotId,
        teachingEnvironment: item.teachingEnvironment,
        groupId,
        assistantIds: item.assistantIds.join(",") || undefined,
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
    addSchedulesToConflictIndex(schedules);

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
        lessonId: schedule.lessonId,
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

export async function DELETE(request: Request) {
  const requestId = createRequestId("schedules-clear");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_schedules_create");
    if (!permission.allowed) {
      return apiFailure(403, "Chỉ quản trị viên được xóa lịch.", undefined, requestId);
    }

    const deletedCount = await clearSheetData("Schedules");
    invalidateScheduleConflictIndex();
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "schedule.clear_all",
      entityType: "Schedule",
      entityId: "*",
      route: "/api/schedules",
      method: "DELETE",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      after: { deletedCount },
    });
    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    return apiError(error, requestId);
  }
}

async function loadReferenceData() {
  if (isFeatureEnabled("SCHEDULE_REFERENCE_CACHE_ENABLED", false)) {
    const ttlMs = readPositiveIntEnv("SCHEDULE_REFERENCE_CACHE_TTL_MS", 60_000);
    const [teachers, users, schools, classes, lessons, slots] = await Promise.all([
      readSheetRowsCached("Teachers", { ttlMs }),
      readSheetRowsCached("Users", { ttlMs }),
      readSheetRowsCached("Schools", { ttlMs }),
      readSheetRowsCached("Classes", { ttlMs }),
      readSheetRowsCached("Lessons", { ttlMs }),
      readSheetRowsCached("TimeSlots", { ttlMs }),
    ]);
    return { teachers, users, schools, classes, lessons, slots };
  }

  const dataRows = await readSheetRowsBatch(["Teachers", "Users", "Schools", "Classes", "Lessons", "TimeSlots"] as const);
  return {
    teachers: dataRows.Teachers,
    users: dataRows.Users,
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
  const existingTeacherSlots = buildTeacherSlots(activeExistingRows);
  const existingClassKeySet = new Set(activeExistingRows.flatMap((row) => scheduleClassIds(row).map((classId) => buildClassSlotKey(row.date, row.timeSlotId, classId))));

  const draftTeacherSlots = new Map<string, TeacherSlotInfo[]>();
  const draftClassSlots = new Map<string, GroupClassTimeSlot[]>();

  for (const schedule of schedules) {
    const teacherKey = buildTeacherSlotKey(schedule.date, schedule.timeSlotId, schedule.teacherId);
    const classIds = scheduleClassIds(schedule);

    if (hasTeacherConflict(existingTeacherSlots.get(teacherKey) ?? [], schedule)) {
      addConflict(
        conflicts,
        dedupe,
        {
          conflictType: "teacher",
          source: "existing",
          date: schedule.date,
          timeSlotId: schedule.timeSlotId,
          teacherId: schedule.teacherId,
          classId: schedule.classId,
        },
      );
    }
    if (classIds.some((classId) => existingClassKeySet.has(buildClassSlotKey(schedule.date, schedule.timeSlotId, classId)))) {
      addConflict(
        conflicts,
        dedupe,
        {
          conflictType: "class",
          source: "existing",
          date: schedule.date,
          timeSlotId: schedule.timeSlotId,
          teacherId: schedule.teacherId,
          classId: schedule.classId,
        },
      );
    }

    if (hasTeacherConflict(draftTeacherSlots.get(teacherKey) ?? [], schedule)) {
      addConflict(
        conflicts,
        dedupe,
        {
          conflictType: "teacher",
          source: "draft",
          date: schedule.date,
          timeSlotId: schedule.timeSlotId,
          teacherId: schedule.teacherId,
          classId: schedule.classId,
        },
      );
    }
    addTeacherSlot(draftTeacherSlots, teacherKey, schedule);

    if (hasDraftClassConflict(draftClassSlots, schedule, classIds)) {
      addConflict(
        conflicts,
        dedupe,
        {
          conflictType: "class",
          source: "draft",
          date: schedule.date,
          timeSlotId: schedule.timeSlotId,
          teacherId: schedule.teacherId,
          classId: schedule.classId,
        },
      );
    }
    addDraftClassSlots(draftClassSlots, schedule, classIds);
  }

  return conflicts;
}

async function detectScheduleConflictsSafe(schedules: Schedule[]) {
  const conflictIndex = await getScheduleConflictIndex();
  if (conflictIndex) {
    return detectScheduleConflictsWithSets(schedules, conflictIndex.teacherSlotsByKey, conflictIndex.classKeySet);
  }

  const existingSchedules = await readSheetRows("Schedules");
  return detectScheduleConflicts(schedules, existingSchedules);
}

function detectScheduleConflictsWithSets(
  schedules: Schedule[],
  existingTeacherSlots: Map<string, TeacherSlotInfo[]>,
  existingClassKeySet: Set<string>,
) {
  const conflicts: ScheduleConflict[] = [];
  const dedupe = new Set<string>();
  const draftTeacherSlots = new Map<string, TeacherSlotInfo[]>();
  const draftClassSlots = new Map<string, GroupClassTimeSlot[]>();

  for (const schedule of schedules) {
    const teacherKey = buildTeacherSlotKey(schedule.date, schedule.timeSlotId, schedule.teacherId);
    const classIds = scheduleClassIds(schedule);

    if (hasTeacherConflict(existingTeacherSlots.get(teacherKey) ?? [], schedule)) {
      addConflict(conflicts, dedupe, {
        conflictType: "teacher",
        source: "existing",
        date: schedule.date,
        timeSlotId: schedule.timeSlotId,
        teacherId: schedule.teacherId,
        classId: schedule.classId,
      });
    }
    if (classIds.some((classId) => existingClassKeySet.has(buildClassSlotKey(schedule.date, schedule.timeSlotId, classId)))) {
      addConflict(conflicts, dedupe, {
        conflictType: "class",
        source: "existing",
        date: schedule.date,
        timeSlotId: schedule.timeSlotId,
        teacherId: schedule.teacherId,
        classId: schedule.classId,
      });
    }

    if (hasTeacherConflict(draftTeacherSlots.get(teacherKey) ?? [], schedule)) {
      addConflict(conflicts, dedupe, {
        conflictType: "teacher",
        source: "draft",
        date: schedule.date,
        timeSlotId: schedule.timeSlotId,
        teacherId: schedule.teacherId,
        classId: schedule.classId,
      });
    }
    addTeacherSlot(draftTeacherSlots, teacherKey, schedule);

    if (hasDraftClassConflict(draftClassSlots, schedule, classIds)) {
      addConflict(conflicts, dedupe, {
        conflictType: "class",
        source: "draft",
        date: schedule.date,
        timeSlotId: schedule.timeSlotId,
        teacherId: schedule.teacherId,
        classId: schedule.classId,
      });
    }
    addDraftClassSlots(draftClassSlots, schedule, classIds);
  }

  return conflicts;
}

function buildTeacherSlots(rows: Array<Record<string, string>>) {
  const slotsByKey = new Map<string, TeacherSlotInfo[]>();
  for (const row of rows) {
    const key = buildTeacherSlotKey(row.date, row.timeSlotId, row.teacherId);
    const slots = slotsByKey.get(key) ?? [];
    slots.push({
      schoolId: normalizeId(row.schoolId),
      teachingEnvironment: normalizeTeachingEnvironment(row.teachingEnvironment),
    });
    slotsByKey.set(key, slots);
  }
  return slotsByKey;
}

function hasTeacherConflict(existingSlots: TeacherSlotInfo[], schedule: Schedule) {
  return hasTeacherTimeConflict(existingSlots, schedule);
}

function addTeacherSlot(slotsByKey: Map<string, TeacherSlotInfo[]>, key: string, schedule: Schedule) {
  const slots = slotsByKey.get(key) ?? [];
  slots.push({
    schoolId: schedule.schoolId,
    teachingEnvironment: schedule.teachingEnvironment ?? "in_class",
  });
  slotsByKey.set(key, slots);
}

function hasDraftClassConflict(
  slotsByKey: Map<string, GroupClassTimeSlot[]>,
  schedule: Schedule,
  classIds: string[],
) {
  const candidate = toGroupClassTimeSlot(schedule);
  return classIds.some((classId) => {
    const key = buildClassSlotKey(schedule.date, schedule.timeSlotId, classId);
    return (slotsByKey.get(key) ?? []).some((existing) => !canShareClassTimeSlot(existing, candidate));
  });
}

function addDraftClassSlots(
  slotsByKey: Map<string, GroupClassTimeSlot[]>,
  schedule: Schedule,
  classIds: string[],
) {
  const candidate = toGroupClassTimeSlot(schedule);
  for (const classId of classIds) {
    const key = buildClassSlotKey(schedule.date, schedule.timeSlotId, classId);
    const slots = slotsByKey.get(key) ?? [];
    slots.push(candidate);
    slotsByKey.set(key, slots);
  }
}

function toGroupClassTimeSlot(schedule: Schedule): GroupClassTimeSlot {
  return {
    groupId: schedule.groupId,
    teachingEnvironment: schedule.teachingEnvironment,
  };
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

function buildTeacherSlotKey(date: string | undefined, timeSlotId: string | undefined, teacherId: string | undefined) {
  return `${normalizeId(date)}|${normalizeId(timeSlotId)}|${normalizeId(teacherId)}`;
}

function buildClassSlotKey(date: string | undefined, timeSlotId: string | undefined, classId: string | undefined) {
  return `${normalizeId(date)}|${normalizeId(timeSlotId)}|${normalizeId(classId)}`;
}

function scheduleClassIds(schedule: Pick<Schedule, "classId" | "participantClassIds"> | Record<string, string>) {
  return Array.from(new Set(String(schedule.participantClassIds || schedule.classId || "").split(",").map((id) => normalizeId(id)).filter(Boolean)));
}

function parseTeacherIds(body: Record<string, unknown>) {
  const rawIds = Array.isArray(body.teacherIds) ? body.teacherIds : [body.teacherId];
  return Array.from(new Set(rawIds.map((id) => normalizeId(id)).filter(Boolean)));
}

function parseIdList(value: unknown) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return Array.from(new Set(values.map((id) => normalizeId(id)).filter(Boolean)));
}

function parseLessonPeriods(value: unknown): LessonPeriod[] {
  if (value === undefined || value === null) {
    return ["lesson1"];
  }
  const values = Array.isArray(value) ? value : String(value).split(",");
  const periods = values
    .map((item) => normalizeId(item))
    .filter((item): item is LessonPeriod => item === "lesson1" || item === "lesson2");
  return Array.from(new Set(periods));
}

function parseScheduleItems(body: Record<string, unknown>, fallbackTeacherIds: string[]): ScheduleDraftItem[] {
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length > 0) {
    return rawItems
      .map((item) => {
        const entry = item as Record<string, unknown>;
        const classIds = parseIdList(entry.classIds ?? entry.classId);
        return {
          date: String(entry.date || entry.day || body.date || "").trim(),
          schoolId: normalizeId(entry.schoolId),
          classId: classIds[0] || "",
          classIds,
          lessonId: normalizeId(entry.lessonId),
          lessonPeriods: parseLessonPeriods(entry.lessonPeriods),
          timeSlotId: normalizeId(entry.timeSlotId),
          teachingEnvironment: normalizeTeachingEnvironment(entry.teachingEnvironment),
          teacherIds: Object.hasOwn(entry, "teacherIds") ? parseIdList(entry.teacherIds) : fallbackTeacherIds,
          assistantIds: parseIdList(entry.assistantIds),
        };
      })
      .filter((item) => item.date && item.schoolId && item.classId && item.lessonId && item.timeSlotId);
  }

  const fallbackItem: ScheduleDraftItem = {
    date: String(body.date || "").trim(),
    schoolId: normalizeId(body.schoolId),
    classId: parseIdList(body.classIds ?? body.classId)[0] || "",
    classIds: parseIdList(body.classIds ?? body.classId),
    lessonId: normalizeId(body.lessonId),
    lessonPeriods: parseLessonPeriods(body.lessonPeriods),
    timeSlotId: normalizeId(body.timeSlotId),
    teachingEnvironment: normalizeTeachingEnvironment(body.teachingEnvironment),
    teacherIds: fallbackTeacherIds,
    assistantIds: parseIdList(body.assistantIds),
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

    const classIds = item.classIds.map((id) => findClassRoom(data.classes, id, school)).filter((row): row is Record<string, string> => Boolean(row)).map((row) => normalizeId(row.id));
    const classId = classIds[0] || item.classId;

    const lesson = findLesson(data.lessons, item.lessonId);
    const lessonId = normalizeId(lesson?.id) || item.lessonId;

    const slot = findTimeSlot(data.slots, item.timeSlotId);
    const timeSlotId = normalizeId(slot?.id) || item.timeSlotId;

    return {
      ...item,
      schoolId,
      classId,
      classIds,
      lessonId,
      timeSlotId,
    };
  });
}

function validateScheduleInput(
  teacherIds: string[],
  items: ScheduleDraftItem[],
  data: {
    teachers: Array<Record<string, string>>;
    users: Array<Record<string, string>>;
    schools: Array<Record<string, string>>;
    classes: Array<Record<string, string>>;
    lessons: Array<Record<string, string>>;
    slots: Array<Record<string, string>>;
  },
  assistantIds: string[],
) {
  const teacherIdSet = new Set(teacherIds.map((teacherId) => normalizeId(teacherId)));

  if (teacherIds.length === 0 || items.length === 0) {
    return "Thiếu thông tin bắt buộc khi tạo lịch.";
  }

  for (const item of items) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
      return "Ngày dạy không hợp lệ.";
    }
    if (item.teacherIds.length === 0) {
      return "Mỗi dòng lịch phải chọn ít nhất một giáo viên.";
    }
    const school = findSchool(data.schools, item.schoolId);
    if (!school) {
      return "Trường đã chọn không tồn tại.";
    }
    const classRooms = item.classIds.map((id) => findClassRoom(data.classes, id, school));
    if (classRooms.length === 0 || classRooms.some((classRoom) => !classRoom)) {
      return "Lớp đã chọn không thuộc trường đã chọn.";
    }
    const lesson = findLesson(data.lessons, item.lessonId);
    if (!lesson) {
      return "Bài học đã chọn không tồn tại hoặc đang tắt.";
    }
    if (item.lessonPeriods.length === 0) {
      return "Mỗi dòng lịch phải chọn ít nhất một tiết học.";
    }
    if (item.lessonPeriods.includes("lesson2") && !normalizeId(lesson.lesson2Title)) {
      return "Bài học đã chọn không có Tiết 2 để giao.";
    }
    if (item.teachingEnvironment === "in_class" && classRooms.some((classRoom) => normalizeComparableText(classRoom?.grade) !== normalizeComparableText(lesson.grade))) {
      return "Bài học đã chọn không đúng khối của lớp.";
    }
    if (!findTimeSlot(data.slots, item.timeSlotId)) {
      return "Khung giờ đã chọn không tồn tại hoặc đang tắt.";
    }
  }

  const activeAssistantIds = new Set(
    data.users
      .filter((item) => isRowActive(item) && normalizeId(item.role) === "assistant")
      .map((item) => normalizeId(item.teacherId))
      .filter(Boolean),
  );
  const activeTeacherIds = new Set(
    data.teachers.filter((item) => isRowActive(item)).map((item) => normalizeId(item.id)),
  );
  if (!Array.from(teacherIdSet).every((teacherId) => activeTeacherIds.has(teacherId) && !activeAssistantIds.has(teacherId))) {
    return "Một hoặc nhiều giáo viên đã chọn không tồn tại hoặc đang tắt.";
  }
  if (!assistantIds.every((assistantId) => activeAssistantIds.has(normalizeId(assistantId)))) {
    return "Một hoặc nhiều trợ giảng đã chọn không tồn tại, đang tắt hoặc chưa được phân quyền trợ giảng.";
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
  const teacherNames = new Map(
    data.teachers.map((teacher) => [normalizeId(teacher.id), String(teacher.name || "").trim()]),
  );
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
          assistantNames: parseIdList(schedule.assistantIds)
            .map((assistantId) => teacherNames.get(assistantId))
            .filter((name): name is string => Boolean(name)),
          coTeacherNames: schedule.groupId
            ? Array.from(
                new Set(
                  schedules
                    .filter((item) => item.groupId === schedule.groupId && normalizeId(item.teacherId) !== normalizeId(schedule.teacherId))
                    .map((item) => teacherNames.get(normalizeId(item.teacherId)))
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
