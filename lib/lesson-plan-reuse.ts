import type { LessonPlan, Schedule } from "@/lib/types";

function periodKey(value: string | undefined) {
  return Array.from(new Set(String(value || "lesson1").split(",").map((part) => part.trim()).filter(Boolean))).sort().join(",");
}

export function canReuseLessonPlan(target: Schedule, sourceSchedule: Schedule, plan: LessonPlan) {
  const sentAt = Date.parse(target.sentAt || "");
  const uploadedAt = Date.parse(plan.uploadedAt || "");
  return target.id !== sourceSchedule.id
    && target.status !== "draft" && target.status !== "cancelled"
    && sourceSchedule.status !== "cancelled"
    && target.teacherId === sourceSchedule.teacherId
    && plan.teacherId === target.teacherId
    && plan.scheduleId === sourceSchedule.id
    && target.lessonId === sourceSchedule.lessonId
    && periodKey(target.lessonPeriods) === periodKey(sourceSchedule.lessonPeriods)
    && sourceSchedule.date <= target.date
    && Number.isFinite(sentAt) && Number.isFinite(uploadedAt) && uploadedAt < sentAt
    && Boolean(plan.driveUrl);
}

export function findReusableLessonPlan(target: Schedule, schedules: Schedule[], plans: LessonPlan[]) {
  const scheduleById = new Map(schedules.map((schedule) => [schedule.id, schedule]));
  return plans
    .filter((plan) => {
      const source = scheduleById.get(plan.scheduleId);
      return source && canReuseLessonPlan(target, source, plan);
    })
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))[0];
}

export function confirmedReusedLessonPlan(target: Schedule, schedules: Schedule[], plans: LessonPlan[]) {
  const plan = plans.find((item) => item.id === target.reusedLessonPlanId);
  const source = plan && schedules.find((item) => item.id === plan.scheduleId);
  return plan && source && canReuseLessonPlan(target, source, plan) ? plan : undefined;
}
