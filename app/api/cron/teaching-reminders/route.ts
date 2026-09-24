import { NextResponse } from "next/server";
import { sendAttendanceReminderEmail, sendScheduleReminderEmail } from "@/lib/email";
import {
  appendSheetRows,
  ensureSheetHeaders,
  readSheetRowsBatch,
  reminderRunHeaders,
} from "@/lib/google-sheets";
import type { Schedule } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const reminderIntervalMs = 5 * 60 * 60 * 1_000;

type SheetRow = Record<string, string>;
type ReminderType = "schedule-confirmation" | "teaching-work-log";
type ReminderCandidate = {
  id: string;
  type: ReminderType;
  schedule: Schedule;
  teacherId: string;
  reminderIndex: number;
};

export async function GET(request: Request) {
  const cronSecret = String(process.env.CRON_SECRET || "").trim();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const completedRunIds = new Set(rows.ReminderRuns.map((row) => String(row.id || "").trim()));
  const activeWorkLogKeys = new Set(
    rows.TeachingWorkLogs
      .filter((row) => ["PENDING", "CONFIRMED"].includes(String(row.status || "").toUpperCase()))
      .map((row) => `${String(row.scheduleId || "").trim()}|${String(row.teacherId || "").trim()}`),
  );

  const confirmationCandidates = (rows.Schedules as Schedule[]).flatMap((schedule) => {
    if (!["sent", "reassigned"].includes(schedule.status)) return [];
    const reminderIndex = reminderIndexFor(parseDateTime(schedule.sentAt), now);
    if (reminderIndex < 1) return [];
    const id = reminderRunId("schedule-confirmation", schedule.id, schedule.teacherId, reminderIndex);
    return completedRunIds.has(id) ? [] : [{ id, type: "schedule-confirmation" as const, schedule, teacherId: schedule.teacherId, reminderIndex }];
  });

  const workLogCandidates = (rows.Schedules as Schedule[]).flatMap((schedule) => {
    if (["cancelled", "draft"].includes(schedule.status)) return [];
    const reminderIndex = reminderIndexFor(scheduleEndMs(schedule, rows.TimeSlots), now);
    if (reminderIndex < 1) return [];
    return scheduleParticipantIds(schedule).flatMap((teacherId) => {
      if (activeWorkLogKeys.has(`${schedule.id}|${teacherId}`)) return [];
      const id = reminderRunId("teaching-work-log", schedule.id, teacherId, reminderIndex);
      return completedRunIds.has(id) ? [] : [{ id, type: "teaching-work-log" as const, schedule, teacherId, reminderIndex }];
    });
  });

  const groups = [
    ...groupCandidates(confirmationCandidates),
    ...groupCandidates(workLogCandidates),
  ];
  const results = await Promise.all(groups.map(async ({ type, teacherId, candidates }) => {
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
  }));

  const successfulResults = results.filter(({ result }) => result.sent);
  const createdAt = new Date(now).toISOString();
  const runRows = successfulResults.flatMap(({ candidates, result }) => candidates.map((candidate) => ({
    id: candidate.id,
    reminderType: candidate.type,
    scheduleId: candidate.schedule.id,
    teacherId: candidate.teacherId,
    reminderIndex: candidate.reminderIndex,
    emailId: "id" in result ? result.id || "" : "",
    createdAt,
  })));
  if (runRows.length > 0) await appendSheetRows("ReminderRuns", runRows);

  return NextResponse.json({
    ok: true,
    scannedAt: createdAt,
    candidateCount: confirmationCandidates.length + workLogCandidates.length,
    sentEmailCount: successfulResults.length,
    recordedReminderCount: runRows.length,
    failedEmailCount: results.length - successfulResults.length,
  });
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
