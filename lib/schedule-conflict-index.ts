import { readSheetRowsCached } from "@/lib/google-sheets";

type ScheduleLike = {
  date?: string;
  timeSlotId?: string;
  teacherId?: string;
  classId?: string;
  status?: string;
};

type ScheduleConflictIndex = {
  teacherKeySet: Set<string>;
  classKeySet: Set<string>;
  source: "cache" | "sheet";
};

let scheduleConflictCache:
  | {
      expiresAt: number;
      teacherKeySet: Set<string>;
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
      teacherKeySet: new Set(scheduleConflictCache.teacherKeySet),
      classKeySet: new Set(scheduleConflictCache.classKeySet),
      source: "cache",
    };
  }

  try {
    const rows = await readSheetRowsCached("Schedules", {
      ttlMs: readPositiveIntEnv("SCHEDULE_CONFLICT_INDEX_SOURCE_TTL_MS", 60_000),
    });
    const activeRows = rows.filter((row) => isScheduleActive(row.status));
    const teacherKeySet = new Set(
      activeRows.map((row) => buildTeacherSlotKey(row.date, row.timeSlotId, row.teacherId)),
    );
    const classKeySet = new Set(
      activeRows.map((row) => buildClassSlotKey(row.date, row.timeSlotId, row.classId)),
    );

    scheduleConflictCache = {
      teacherKeySet,
      classKeySet,
      expiresAt: now + readPositiveIntEnv("SCHEDULE_CONFLICT_INDEX_TTL_MS", 60_000),
    };

    return {
      teacherKeySet: new Set(teacherKeySet),
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
    scheduleConflictCache.teacherKeySet.add(
      buildTeacherSlotKey(schedule.date, schedule.timeSlotId, schedule.teacherId),
    );
    scheduleConflictCache.classKeySet.add(buildClassSlotKey(schedule.date, schedule.timeSlotId, schedule.classId));
  }
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
