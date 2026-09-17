import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function compileCommonJs(path, requireFn) {
  const source = fs.readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const runtimeModule = { exports: {} };
  new Function("module", "exports", "require", compiled)(runtimeModule, runtimeModule.exports, requireFn);
  return runtimeModule.exports;
}

const lessons = compileCommonJs("../lib/lessons.ts", (specifier) => {
  if (specifier === "@/lib/time-slots") return { MIN_TIME_SLOT_MINUTES: 15, MAX_TIME_SLOT_MINUTES: 180, TIME_SLOT_STEP_MINUTES: 5 };
  throw new Error(`Unexpected lesson import: ${specifier}`);
});
const policy = compileCommonJs("../lib/lesson-progression-policy.ts", (specifier) => {
  if (specifier === "@/lib/lessons") return lessons;
  throw new Error(`Unexpected policy import: ${specifier}`);
});
const { academicYearKey, findLessonProgressionConflicts } = policy;

assert.equal(academicYearKey("2026-07-31", { startMonth: 8, startDay: 1 }), "2025");
assert.equal(academicYearKey("2026-08-01", { startMonth: 8, startDay: 1 }), "2026");

const previousLessonOne = {
  id: "old", date: "2026-09-01", schoolId: "school-a", classId: "6A", participantClassIds: "6A,6B",
  teacherId: "teacher-a", lessonId: "lesson-emotion", lessonPeriods: "lesson1", status: "attended",
};
const baseCandidate = {
  id: "new", date: "2026-11-01", schoolId: "school-a", classId: "6B", participantClassIds: "6B",
  teacherId: "teacher-a", lessonId: "lesson-emotion", lessonPeriods: "lesson1", status: "sent",
};
assert.equal(findLessonProgressionConflicts([baseCandidate], [previousLessonOne]).length, 1);
assert.equal(findLessonProgressionConflicts([{ ...baseCandidate, classId: "7A", participantClassIds: "7A" }], [previousLessonOne]).length, 0);
assert.equal(findLessonProgressionConflicts([{ ...baseCandidate, teacherId: "teacher-b" }], [previousLessonOne]).length, 0);
assert.equal(findLessonProgressionConflicts([{ ...baseCandidate, lessonPeriods: "lesson2" }], [previousLessonOne]).length, 0);
assert.equal(findLessonProgressionConflicts([{ ...baseCandidate, date: "2027-02-01" }], [previousLessonOne]).length, 1);
assert.equal(findLessonProgressionConflicts([{ ...baseCandidate, date: "2027-02-01" }], [previousLessonOne], { lookbackMonths: 2 }).length, 0);
assert.equal(findLessonProgressionConflicts([{ ...baseCandidate, schoolId: "school-b" }], [previousLessonOne]).length, 0);
assert.equal(findLessonProgressionConflicts([
  { ...baseCandidate, id: "co-1", groupId: "group-1" },
  { ...baseCandidate, id: "co-2", groupId: "group-1" },
], []).length, 0);

console.log("Lesson progression tests passed for same-teacher, same-school, same-class Tiết 1 rolling five-month policy.");
