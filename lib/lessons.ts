import {
  MIN_TIME_SLOT_MINUTES,
  MAX_TIME_SLOT_MINUTES,
  TIME_SLOT_STEP_MINUTES,
} from "@/lib/time-slots";

const lessonGrades = new Set(Array.from({ length: 12 }, (_, index) => `Khối ${index + 1}`));

export const lessonGradeOptions = Array.from(lessonGrades);

type LessonDuplicateInput = {
  title?: unknown;
  lesson1Title?: unknown;
  lesson1Objective?: unknown;
  lesson2Title?: unknown;
  lesson2Objective?: unknown;
};

/**
 * Chỉ khi toàn bộ tên chuyên đề và nội dung của hai tiết giống nhau mới trùng.
 * Khác mục tiêu (dù cùng tên chuyên đề) luôn được coi là bài mới.
 */
export function lessonDuplicateKey(lesson: LessonDuplicateInput) {
  return [
    lesson.title,
    lesson.lesson1Title,
    lesson.lesson1Objective,
    lesson.lesson2Title,
    lesson.lesson2Objective,
  ].map(normalizeLessonDuplicateValue).join("\u001F");
}

function normalizeLessonDuplicateValue(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeLessonInput(body: Record<string, unknown>, index = 0) {
  const rowLabel = `Dòng ${index + 1}`;
  const grade = String(body.grade || "").trim();
  const title = String(body.title || "").trim();
  const objective = String(body.objective || "").trim();
  const lesson1Title = String(body.lesson1Title || "").trim();
  const lesson1Objective = String(body.lesson1Objective || "").trim();
  const lesson2Title = String(body.lesson2Title || "").trim();
  const lesson2Objective = String(body.lesson2Objective || "").trim();
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

  if (!lesson1Title) {
    throw new Error(`${rowLabel}: Tên tiết 1 là bắt buộc.`);
  }

  if (!lesson1Objective) {
    throw new Error(`${rowLabel}: Mục tiêu tiết 1 là bắt buộc.`);
  }

  if (!lesson2Title) {
    throw new Error(`${rowLabel}: Tên tiết 2 là bắt buộc.`);
  }

  if (!lesson2Objective) {
    throw new Error(`${rowLabel}: Mục tiêu tiết 2 là bắt buộc.`);
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
    objective:
      objective || `Tiết 1 - ${lesson1Title}:\n${lesson1Objective}\n\nTiết 2 - ${lesson2Title}:\n${lesson2Objective}`,
    lesson1Title,
    lesson1Objective,
    lesson2Title,
    lesson2Objective,
    objectives,
    durationMinutes,
    samplePlanUrl,
    topicId,
    sortOrder,
  };
}
