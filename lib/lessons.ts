import {
  MIN_TIME_SLOT_MINUTES,
  MAX_TIME_SLOT_MINUTES,
  TIME_SLOT_STEP_MINUTES,
} from "@/lib/time-slots";

const lessonGrades = new Set(Array.from({ length: 12 }, (_, index) => `Khối ${index + 1}`));

export const lessonGradeOptions = Array.from(lessonGrades);

export function normalizeLessonInput(body: Record<string, unknown>, index = 0) {
  const rowLabel = `Dòng ${index + 1}`;
  const grade = String(body.grade || "").trim();
  const title = String(body.title || "").trim();
  const objective = String(body.objective || "").trim();
  const objectives = String(body.objectives || "").trim();
  const samplePlanUrl = String(body.samplePlanUrl || "").trim();
  const topicId = String(body.topicId || "").trim();
  const sortOrder = body.sortOrder !== undefined && body.sortOrder !== "" ? Number(body.sortOrder) : undefined;
  const durationMinutes = body.durationMinutes === "" ? Number.NaN : Number(body.durationMinutes || 45);

  if (!lessonGrades.has(grade)) {
    throw new Error(`${rowLabel}: Khối phải nằm trong Khối 1 đến Khối 12.`);
  }

  if (!title) {
    throw new Error(`${rowLabel}: Tên bài học là bắt buộc.`);
  }

  if (!objective) {
    throw new Error(`${rowLabel}: Mục tiêu là bắt buộc.`);
  }

  if (!Number.isFinite(durationMinutes)) {
    throw new Error(`${rowLabel}: Số phút là bắt buộc.`);
  }

  if (samplePlanUrl && !/^https?:\/\//i.test(samplePlanUrl)) {
    throw new Error(`${rowLabel}: Giáo án mẫu phải là link http hoặc https.`);
  }

  if (
    durationMinutes < MIN_TIME_SLOT_MINUTES ||
    durationMinutes > MAX_TIME_SLOT_MINUTES ||
    durationMinutes % TIME_SLOT_STEP_MINUTES !== 0
  ) {
    throw new Error(
      `${rowLabel}: Số phút phải từ ${MIN_TIME_SLOT_MINUTES} đến ${MAX_TIME_SLOT_MINUTES}, bội số của ${TIME_SLOT_STEP_MINUTES}.`,
    );
  }

  return {
    grade,
    title,
    objective,
    objectives,
    durationMinutes,
    samplePlanUrl,
    topicId,
    sortOrder,
  };
}
