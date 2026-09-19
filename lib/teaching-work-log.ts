import { createHash } from "node:crypto";
import type { Schedule, TeachingRoleCode, TimeSlot } from "@/lib/types";

type ScheduleRow = Pick<Schedule, "id" | "date" | "teacherId" | "timeSlotId" | "groupId" | "assistantIds" | "teachingRole">;

export function parseParticipantIds(value: unknown) {
  return Array.from(new Set(String(value || "").split(",").map((id) => id.trim()).filter(Boolean)));
}

export function resolveTeachingRole(
  schedule: ScheduleRow,
  participantId: string,
  schedules: ScheduleRow[],
): TeachingRoleCode | "" {
  const normalizedParticipantId = participantId.trim();
  if (!normalizedParticipantId) return "";
  if (parseParticipantIds(schedule.assistantIds).includes(normalizedParticipantId)) return "ASSISTANT";
  if (schedule.teacherId !== normalizedParticipantId) return "";
  if (schedule.teachingRole === "MAIN_TEACHER" || schedule.teachingRole === "CO_TEACHER") {
    return schedule.teachingRole;
  }
  if (!schedule.groupId) return "MAIN_TEACHER";
  const peers = schedules.filter((item) => item.groupId === schedule.groupId);
  return peers.find((item) => item.teacherId)?.teacherId === normalizedParticipantId ? "MAIN_TEACHER" : "CO_TEACHER";
}

export function schedulePeriodTimes(schedule: Pick<Schedule, "date" | "timeSlotId">, slots: TimeSlot[]) {
  const slot = slots.find((item) => item.id === schedule.timeSlotId);
  if (!slot?.start || !slot?.end || !schedule.date) return null;
  const startsAt = new Date(`${schedule.date}T${slot.start}:00+07:00`);
  const endsAt = new Date(`${schedule.date}T${slot.end}:00+07:00`);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return null;
  return { slot, startsAt, endsAt };
}

export function teachingWorkLogKey(scheduleId: string, participantId: string, roleCode: TeachingRoleCode) {
  return `METTASOUL:${scheduleId}:${participantId}:${roleCode}`;
}

export function deterministicTeachingEventId(idempotencyKey: string) {
  return `MTS_EVT_${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 24)}`;
}

export function deterministicTeachingWorkLogId(idempotencyKey: string) {
  return `twl_${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 24)}`;
}

export function deterministicTeachingCancellationEventId(idempotencyKey: string) {
  return `MTS_CANCEL_${createHash("sha256").update(`CANCEL:${idempotencyKey}`).digest("hex").slice(0, 24)}`;
}
