const lessonGrades = new Set(Array.from({ length: 12 }, (_, index) => `Khối ${index + 1}`));
const lessonDurations = new Set([45, 90]);

export const lessonGradeOptions = Array.from(lessonGrades);
export const lessonDurationOptions = Array.from(lessonDurations);

export function normalizeLessonInput(body: Record<string, unknown>, index = 0) {
  const rowLabel = `Dòng ${index + 1}`;
  const grade = String(body.grade || "").trim();
  const title = String(body.title || "").trim();
  const objective = String(body.objective || "").trim();
  const durationMinutes = body.durationMinutes === "" ? Number.NaN : Number(body.durationMinutes || 45);

  if (!lessonGrades.has(grade)) {
    throw new Error(`${rowLabel}: Khối phải nằm trong Khối 1 đến Khối 12.`);
  }

  if (!title) {
    throw new Error(`${rowLabel}: Tên chuyên đề là bắt buộc.`);
  }

  if (!objective) {
    throw new Error(`${rowLabel}: Mục tiêu là bắt buộc.`);
  }

  if (!Number.isFinite(durationMinutes)) {
    throw new Error(`${rowLabel}: Số phút là bắt buộc.`);
  }

  if (!lessonDurations.has(durationMinutes)) {
    throw new Error(`${rowLabel}: Số phút chỉ được là 45 hoặc 90.`);
  }

  return {
    grade,
    title,
    objective,
    durationMinutes,
  };
}
