import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { schoolNeedPeriodTotal } from "../lib/school-need-period-count.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const code = ts.transpileModule(readFileSync(new URL("../lib/school-assignment-progress.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)((name) => {
  if (name === "./school-need-period-count") return { schoolNeedPeriodTotal };
  throw new Error(`Unexpected import: ${name}`);
}, module, module.exports);
const { getSchoolAssignmentProgress, isSchoolNeedEditHighlighted, schoolNeedEditLabel } = module.exports;

const needs = [
  { id: "one", classId: "a", date: "2026-10-05", end: "14:15", status: "OPEN", lastEditedAt: "2026-10-01T08:00:00.000Z", lastEditedBy: "Mỹ Nhung" },
  { id: "two", classId: "a", date: "2026-10-05", end: "15:05", status: "OPEN" },
  { id: "three", classId: "b", date: "2026-10-05", end: "16:00", status: "ASSIGNED", scheduleId: "schedule-three" },
];
const empty = getSchoolAssignmentProgress(needs, []);
assert.deepEqual([empty.coveredNeedCount, empty.remainingNeedCount, empty.completedClassCount], [1, 2, 1]);
const partial = getSchoolAssignmentProgress(needs, [{ schoolNeedIds: ["one"], teacherIds: ["teacher"], lessonId: "lesson", lessonPeriods: ["lesson1"], timeSlotId: "slot" }]);
assert.deepEqual([partial.coveredNeedCount, partial.remainingNeedCount, partial.completedClassCount], [2, 1, 1]);
const merged = getSchoolAssignmentProgress(needs, [{ schoolNeedIds: ["one", "two"], teacherIds: ["teacher"], lessonId: "lesson", lessonPeriods: ["lesson1", "lesson2"], timeSlotId: "double-slot" }]);
assert.deepEqual([merged.coveredNeedCount, merged.remainingNeedCount, merged.completedClassCount, merged.totalClassCount], [3, 0, 2, 2]);
const missingLesson = getSchoolAssignmentProgress(needs, [{ schoolNeedIds: ["one", "two"], teacherIds: ["teacher"], lessonId: "", lessonPeriods: [], timeSlotId: "double-slot" }]);
assert.deepEqual([missingLesson.coveredNeedCount, missingLesson.remainingNeedCount, missingLesson.selectedDraftNeedCount, missingLesson.readyDraftNeedCount], [3, 0, 2, 0]);
const unchecked = getSchoolAssignmentProgress(needs, [{ schoolNeedIds: ["one", "two"], teacherIds: [], lessonId: "lesson", lessonPeriods: ["lesson1", "lesson2"], timeSlotId: "double-slot" }]);
assert.deepEqual([unchecked.coveredNeedCount, unchecked.remainingNeedCount], [1, 2]);
const paired = getSchoolAssignmentProgress([{ id: "pair", classId: "c", start: "13:30", end: "15:00", periodLabel: "Khung 90 phút từ 13:30", status: "OPEN" }], []);
assert.deepEqual([paired.totalNeedCount, paired.remainingNeedCount], [2, 2]);
assert.equal(isSchoolNeedEditHighlighted(needs[0], Date.parse("2026-10-05T14:14:00+07:00")), true);
assert.equal(isSchoolNeedEditHighlighted(needs[0], Date.parse("2026-10-05T14:15:00+07:00")), false);
assert.equal(schoolNeedEditLabel(needs[0]), "01/10/26 - 15:00 | Mỹ Nhung");
console.log("School assignment progress and edit highlight passed.");
