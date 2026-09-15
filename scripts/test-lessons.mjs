import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/lessons.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const lessonModule = { exports: {} };
new Function("module", "exports", "require", compiled)(lessonModule, lessonModule.exports, (specifier) => {
  if (specifier === "@/lib/time-slots") {
    return { MIN_TIME_SLOT_MINUTES: 15, MAX_TIME_SLOT_MINUTES: 180, TIME_SLOT_STEP_MINUTES: 5 };
  }
  throw new Error(`Unexpected test import: ${specifier}`);
});

const { normalizeLessonInput, normalizeScheduledLessonPeriods, scheduledLessonSections } = lessonModule.exports;
const lesson = {
  title: "Chuyên đề cảm xúc",
  objective: "Mục tiêu tổng hợp cũ",
  lesson1Title: "Nhận diện cảm xúc",
  lesson1Objective: "Gọi tên được cảm xúc.",
  lesson2Title: "Điều hòa cảm xúc",
  lesson2Objective: "Thực hành một kỹ thuật bình tâm.",
};

assert.deepEqual(normalizeScheduledLessonPeriods("lesson2,lesson2,invalid"), ["lesson2"]);
assert.deepEqual(normalizeScheduledLessonPeriods(""), ["lesson1"]);
assert.deepEqual(scheduledLessonSections("lesson1", lesson), [{
  period: "lesson1",
  label: "Tiết 1",
  title: "Nhận diện cảm xúc",
  objective: "Gọi tên được cảm xúc.",
}]);
assert.deepEqual(scheduledLessonSections("lesson2", lesson), [{
  period: "lesson2",
  label: "Tiết 2",
  title: "Điều hòa cảm xúc",
  objective: "Thực hành một kỹ thuật bình tâm.",
}]);

const normalized = normalizeLessonInput({
  grade: "Khối 6",
  title: lesson.title,
  lesson1Title: lesson.lesson1Title,
  lesson1Objective: lesson.lesson1Objective,
  lesson2Title: lesson.lesson2Title,
  lesson2Objective: lesson.lesson2Objective,
  durationMinutes: 45,
});
assert.match(normalized.objective, /Tiết 1 - Nhận diện cảm xúc/);
assert.match(normalized.objective, /Tiết 2 - Điều hòa cảm xúc/);

console.log("Lesson policy tests passed, including exact scheduled-period projection.");
