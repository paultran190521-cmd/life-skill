import { readSheetRowsCached } from "@/lib/google-sheets";

type ScheduleLike = {
  date?: string;
  timeSlotId?: string;
  teacherId?: string;
  classId?: string;
  participantClassIds?: string;
  schoolId?: string;
  teachingEnvironment?: string;
  status?: string;
};

export type TeacherSlotInfo = {
  schoolId: string;
  teachingEnvironment: string;
};

type ScheduleConflictIndex = {
  teacherSlotsByKey: Map<string, TeacherSlotInfo[]>;
  classKeySet: Set<string>;
  source: "cache" | "sheet";
};

let scheduleConflictCache:
  | {
      expiresAt: number;
      teacherSlotsByKey: Map<string, TeacherSlotInfo[]>;
      classKeySet: Set<string>;
    }
  | null = null;

export async function getScheduleConflictIndex(): Promise<ScheduleConflictIndex | null> {
  if (!isFeatureEnabled("SCHEDULE_CONFLICT_INDEX_ENABLED", false)) {
    return null;
  }

  const now = Date.now();
  if (scheduleConflictCache && scheduleConflictCache.expiresAt > now) {
    return {
      teacherSlotsByKey: cloneTeacherSlots(scheduleConflictCache.teacherSlotsByKey),
      classKeySet: new Set(scheduleConflictCache.classKeySet),
      source: "cache",
    };
  }

  try {
    const rows = await readSheetRowsCached("Schedules", {
      ttlMs: readPositiveIntEnv("SCHEDULE_CONFLICT_INDEX_SOURCE_TTL_MS", 60_000),
    });
    const activeRows = rows.filter((row) => isScheduleActive(row.status));
    const teacherSlotsByKey = buildTeacherSlots(activeRows);
    const classKeySet = new Set(activeRows.flatMap((row) => scheduleClassIds(row).map((classId) => buildClassSlotKey(row.date, row.timeSlotId, classId))));

    scheduleConflictCache = {
      teacherSlotsByKey,
      classKeySet,
      expiresAt: now + readPositiveIntEnv("SCHEDULE_CONFLICT_INDEX_TTL_MS", 60_000),
    };

    return {
      teacherSlotsByKey: cloneTeacherSlots(teacherSlotsByKey),
      classKeySet: new Set(classKeySet),
      source: "sheet",
    };
  } catch (error) {
    console.error("[schedule-conflict-index] fallback to full read:", error);
    return null;
  }
}

export function addSchedulesToConflictIndex(schedules: ScheduleLike[]) {
  if (!scheduleConflictCache || !isFeatureEnabled("SCHEDULE_CONFLICT_INDEX_ENABLED", false)) {
    return;
  }

  for (const schedule of schedules) {
    if (!isScheduleActive(schedule.status)) {
      continue;
    }
    const teacherKey = buildTeacherSlotKey(schedule.date, schedule.timeSlotId, schedule.teacherId);
    const slots = scheduleConflictCache.teacherSlotsByKey.get(teacherKey) ?? [];
    slots.push({
      schoolId: normalizeId(schedule.schoolId),
      teachingEnvironment: normalizeId(schedule.teachingEnvironment) || "in_class",
    });
    scheduleConflictCache.teacherSlotsByKey.set(teacherKey, slots);
    for (const classId of scheduleClassIds(schedule)) {
      scheduleConflictCache.classKeySet.add(buildClassSlotKey(schedule.date, schedule.timeSlotId, classId));
    }
  }
}

function buildTeacherSlots(rows: ScheduleLike[]) {
  const slotsByKey = new Map<string, TeacherSlotInfo[]>();
  for (const row of rows) {
    const key = buildTeacherSlotKey(row.date, row.timeSlotId, row.teacherId);
    const slots = slotsByKey.get(key) ?? [];
    slots.push({
      schoolId: normalizeId(row.schoolId),
      teachingEnvironment: normalizeId(row.teachingEnvironment) || "in_class",
    });
    slotsByKey.set(key, slots);
  }
  return slotsByKey;
}

function cloneTeacherSlots(source: Map<string, TeacherSlotInfo[]>) {
  return new Map(Array.from(source, ([key, slots]) => [key, slots.map((slot) => ({ ...slot }))]));
}

export function invalidateScheduleConflictIndex() {
  scheduleConflictCache = null;
}

function isScheduleActive(status: string | undefined) {
  return normalizeComparableText(status || "") !== "cancelled";
}

function buildTeacherSlotKey(date: string | undefined, timeSlotId: string | undefined, teacherId: string | undefined) {
  return `${normalizeId(date)}|${normalizeId(timeSlotId)}|${normalizeId(teacherId)}`;
}

function buildClassSlotKey(date: string | undefined, timeSlotId: string | undefined, classId: string | undefined) {
  return `${normalizeId(date)}|${normalizeId(timeSlotId)}|${normalizeId(classId)}`;
}

function scheduleClassIds(schedule: Pick<ScheduleLike, "classId" | "participantClassIds">) {
  const ids = String(schedule.participantClassIds || schedule.classId || "").split(",").map((id) => normalizeId(id)).filter(Boolean);
  return Array.from(new Set(ids));
}

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

function normalizeComparableText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "d")
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
