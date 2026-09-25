import { sendAttendanceReminderEmail, sendScheduleReminderEmail } from "@/lib/email";
import {
  appendSheetRowWithHeaders,
  appendSheetRows,
  ensureSheetHeaders,
  readSheetRows,
  readSheetRowsBatch,
  reminderRunHeaders,
  reminderSettingsHeaders,
  updateSheetRowById,
} from "@/lib/google-sheets";
import type { Schedule } from "@/lib/types";
import { readCancellationReports, blocksParticipant } from "@/lib/schedule-cancellation-reports";
import { canonicalParticipantSchedule } from "@/lib/topic-report-policy";

const settingsId = "teaching-reminders";
const reminderIntervalHours = 5;
const reminderIntervalMs = reminderIntervalHours * 60 * 60 * 1_000;

type SheetRow = Record<string, string>;
type ReminderType = "schedule-confirmation" | "teaching-work-log";
type ReminderCandidate = {
  id: string;
  type: ReminderType;
  schedule: Schedule;
  teacherId: string;
  reminderIndex: number;
};

export type TeachingReminderSettings = {
  id: typeof settingsId;
  scheduleConfirmationEnabled: boolean;
  workLogReminderEnabled: boolean;
  intervalHours: number;
  lastRunAt: string;
  lastRunStatus: "never" | "success" | "partial" | "failed" | "disabled";
  lastCandidateCount: number;
  lastSentEmailCount: number;
  lastFailedEmailCount: number;
  updatedAt: string;
  updatedBy: string;
};

export type TeachingReminderRunResult = {
  ok: boolean;
  scannedAt: string;
  status: TeachingReminderSettings["lastRunStatus"];
  candidateCount: number;
  sentEmailCount: number;
  recordedReminderCount: number;
  failedEmailCount: number;
  settings: TeachingReminderSettings;
};

const defaultSettings: TeachingReminderSettings = {
  id: settingsId,
  scheduleConfirmationEnabled: true,
  workLogReminderEnabled: true,
  intervalHours: reminderIntervalHours,
  lastRunAt: "",
  lastRunStatus: "never",
  lastCandidateCount: 0,
  lastSentEmailCount: 0,
  lastFailedEmailCount: 0,
  updatedAt: "",
  updatedBy: "system",
};

export async function loadTeachingReminderSettings(): Promise<TeachingReminderSettings> {
  await ensureSheetHeaders("ReminderSettings", reminderSettingsHeaders);
  const rows = await readSheetRows("ReminderSettings");
  const row = rows.find((item) => String(item.id || "").trim() === settingsId);
  return row ? parseSettings(row) : { ...defaultSettings };
}

export async function saveTeachingReminderSettings(
  patch: Partial<Pick<TeachingReminderSettings, "scheduleConfirmationEnabled" | "workLogReminderEnabled">> &
    Partial<Pick<TeachingReminderSettings, "lastRunAt" | "lastRunStatus" | "lastCandidateCount" | "lastSentEmailCount" | "lastFailedEmailCount">>,
  updatedBy: string,
): Promise<TeachingReminderSettings> {
  await ensureSheetHeaders("ReminderSettings", reminderSettingsHeaders);
  const rows = await readSheetRows("ReminderSettings");
  const currentRow = rows.find((item) => String(item.id || "").trim() === settingsId);
  const current = currentRow ? parseSettings(currentRow) : { ...defaultSettings };
  const next: TeachingReminderSettings = {
    ...current,
    ...patch,
    id: settingsId,
    intervalHours: reminderIntervalHours,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || "system",
  };

  if (currentRow) {
    await updateSheetRowById("ReminderSettings", settingsId, next);
  } else {
    await appendSheetRowWithHeaders("ReminderSettings", reminderSettingsHeaders, next);
  }
  return next;
}

export async function runTeachingReminders(updatedBy = "system:cron"): Promise<TeachingReminderRunResult> {
  const settings = await loadTeachingReminderSettings();
  const scannedAt = new Date().toISOString();

  if (!settings.scheduleConfirmationEnabled && !settings.workLogReminderEnabled) {
    const savedSettings = await saveTeachingReminderSettings({
      lastRunAt: scannedAt,
      lastRunStatus: "disabled",
      lastCandidateCount: 0,
      lastSentEmailCount: 0,
      lastFailedEmailCount: 0,
    }, updatedBy);
    return {
      ok: true,
      scannedAt,
      status: "disabled",
      candidateCount: 0,
      sentEmailCount: 0,
      recordedReminderCount: 0,
      failedEmailCount: 0,
      settings: savedSettings,
    };
  }

  await ensureSheetHeaders("ReminderRuns", reminderRunHeaders);
  const rows = await readSheetRowsBatch([
    "Schedules",
    "TeachingWorkLogs",
    "Teachers",
    "Schools",
    "Classes",
    "Lessons",
    "TimeSlots",
    "ReminderRuns",
  ] as const);
  const now = Date.now();
  const cancellations = await readCancellationReports();
  const completedRunIds = new Set(rows.ReminderRuns.map((row) => String(row.id || "").trim()));
  const activeWorkLogKeys = new Set(
    rows.TeachingWorkLogs
      .filter((row) => ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"].includes(String(row.status || "").toUpperCase()))
      .map((row) => `${String(row.scheduleId || "").trim()}|${String(row.teacherId || "").trim()}`),
  );

  const confirmationCandidates = settings.scheduleConfirmationEnabled
    ? (rows.Schedules as Schedule[]).flatMap((schedule) => {
      if (!["sent", "reassigned"].includes(schedule.status)) return [];
      const reminderIndex = reminderIndexFor(parseDateTime(schedule.sentAt), now);
      if (reminderIndex < 1) return [];
      const id = reminderRunId("schedule-confirmation", schedule.id, schedule.teacherId, reminderIndex);
      return completedRunIds.has(id) ? [] : [{ id, type: "schedule-confirmation" as const, schedule, teacherId: schedule.teacherId, reminderIndex }];
    })
    : [];

  const workLogCandidates = settings.workLogReminderEnabled
    ? (rows.Schedules as Schedule[]).flatMap((schedule) => {
      if (["cancelled", "draft"].includes(schedule.status)) return [];
      const reminderIndex = reminderIndexFor(scheduleEndMs(schedule, rows.TimeSlots), now);
      if (reminderIndex < 1) return [];
      return scheduleParticipantIds(schedule).flatMap((teacherId) => {
        const canonical = canonicalParticipantSchedule(schedule, teacherId, rows.Schedules as Schedule[]);
        if (canonical.id !== schedule.id || blocksParticipant(cancellations, schedule.id, teacherId)) return [];
        if (activeWorkLogKeys.has(`${schedule.id}|${teacherId}`)) return [];
        const id = reminderRunId("teaching-work-log", schedule.id, teacherId, reminderIndex);
        return completedRunIds.has(id) ? [] : [{ id, type: "teaching-work-log" as const, schedule, teacherId, reminderIndex }];
      });
    })
    : [];

  const groups = [
    ...groupCandidates(confirmationCandidates),
    ...groupCandidates(workLogCandidates),
  ];
  const results = await Promise.all(groups.map(async ({ type, teacherId, candidates }) => {
    try {
      const teacher = rows.Teachers.find((row) => String(row.id || "").trim() === teacherId) || {};
      const schedules = candidates.map((candidate) => candidate.schedule);
      const input = {
        teacher,
        schedules,
        participantId: teacherId,
        rows: buildDigestRows(schedules, rows),
      };
      const result = type === "schedule-confirmation"
        ? await sendScheduleReminderEmail(input)
        : await sendAttendanceReminderEmail(input);
      return { type, teacherId, candidates, result };
    } catch (error) {
      console.error(`[teaching-reminders] ${type} ${teacherId}`, error);
      return { type, teacherId, candidates, result: { sent: false } };
    }
  }));

  const successfulResults = results.filter(({ result }) => result.sent);
  const runRows = successfulResults.flatMap(({ candidates, result }) => candidates.map((candidate) => ({
    id: candidate.id,
    reminderType: candidate.type,
    scheduleId: candidate.schedule.id,
    teacherId: candidate.teacherId,
    reminderIndex: candidate.reminderIndex,
    emailId: "id" in result ? result.id || "" : "",
    createdAt: scannedAt,
  })));
  if (runRows.length > 0) await appendSheetRows("ReminderRuns", runRows);

  const failedEmailCount = results.length - successfulResults.length;
  const status: TeachingReminderSettings["lastRunStatus"] = failedEmailCount === 0
    ? "success"
    : successfulResults.length > 0
      ? "partial"
      : "failed";
  const savedSettings = await saveTeachingReminderSettings({
    lastRunAt: scannedAt,
    lastRunStatus: status,
    lastCandidateCount: confirmationCandidates.length + workLogCandidates.length,
    lastSentEmailCount: successfulResults.length,
    lastFailedEmailCount: failedEmailCount,
  }, updatedBy);

  return {
    ok: failedEmailCount === 0,
    scannedAt,
    status,
    candidateCount: confirmationCandidates.length + workLogCandidates.length,
    sentEmailCount: successfulResults.length,
    recordedReminderCount: runRows.length,
    failedEmailCount,
    settings: savedSettings,
  };
}

function parseSettings(row: SheetRow): TeachingReminderSettings {
  const statuses: TeachingReminderSettings["lastRunStatus"][] = ["never", "success", "partial", "failed", "disabled"];
  const status = String(row.lastRunStatus || "never") as TeachingReminderSettings["lastRunStatus"];
  return {
    id: settingsId,
    scheduleConfirmationEnabled: parseBoolean(row.scheduleConfirmationEnabled, true),
    workLogReminderEnabled: parseBoolean(row.workLogReminderEnabled, true),
    intervalHours: reminderIntervalHours,
    lastRunAt: String(row.lastRunAt || ""),
    lastRunStatus: statuses.includes(status) ? status : "never",
    lastCandidateCount: parseCount(row.lastCandidateCount),
    lastSentEmailCount: parseCount(row.lastSentEmailCount),
    lastFailedEmailCount: parseCount(row.lastFailedEmailCount),
    updatedAt: String(row.updatedAt || ""),
    updatedBy: String(row.updatedBy || "system"),
  };
}

function parseBoolean(value: unknown, fallback: boolean) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return fallback;
}

function parseCount(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function groupCandidates(candidates: ReminderCandidate[]) {
  const groups = new Map<string, ReminderCandidate[]>();
  for (const candidate of candidates) {
    const key = `${candidate.type}|${candidate.teacherId}`;
    groups.set(key, [...(groups.get(key) || []), candidate]);
  }
  return Array.from(groups.values()).map((items) => ({
    type: items[0].type,
    teacherId: items[0].teacherId,
    candidates: items,
  }));
}

function buildDigestRows(schedules: Schedule[], rows: Record<string, SheetRow[]>) {
  return schedules.map((schedule) => ({
    schedule,
    school: rows.Schools.find((row) => String(row.id || "").trim() === schedule.schoolId),
    classRoom: rows.Classes.find((row) => String(row.id || "").trim() === schedule.classId),
    participantClassNames: String(schedule.participantClassIds || schedule.classId || "")
      .split(",")
      .map((classId) => rows.Classes.find((row) => String(row.id || "").trim() === classId.trim())?.name)
      .filter((name): name is string => Boolean(name)),
    lesson: rows.Lessons.find((row) => String(row.id || "").trim() === schedule.lessonId),
    slot: rows.TimeSlots.find((row) => String(row.id || "").trim() === schedule.timeSlotId),
  }));
}

function scheduleParticipantIds(schedule: Schedule) {
  return Array.from(new Set([
    schedule.teacherId,
    ...String(schedule.assistantIds || "").split(",").map((id) => id.trim()).filter(Boolean),
  ].filter(Boolean)));
}

function scheduleEndMs(schedule: Schedule, slots: SheetRow[]) {
  const slot = slots.find((row) => String(row.id || "").trim() === schedule.timeSlotId);
  const end = String(slot?.end || "").trim();
  return end ? new Date(`${schedule.date}T${end}:00+07:00`).getTime() : Number.NaN;
}

function parseDateTime(value: unknown) {
  const timestamp = new Date(String(value || "")).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

function reminderIndexFor(anchorMs: number, nowMs: number) {
  if (!Number.isFinite(anchorMs) || nowMs - anchorMs < reminderIntervalMs) return 0;
  return Math.floor((nowMs - anchorMs) / reminderIntervalMs);
}

function reminderRunId(type: ReminderType, scheduleId: string, teacherId: string, reminderIndex: number) {
  return `reminder-${type}-${scheduleId}-${teacherId}-${reminderIndex}`;
}
