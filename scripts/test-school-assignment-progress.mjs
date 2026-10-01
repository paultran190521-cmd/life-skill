import assert from "node:assert/strict";
import { getSchoolAssignmentProgress, isSchoolNeedEditHighlighted, schoolNeedEditLabel } from "../lib/school-assignment-progress.ts";

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
assert.equal(missingLesson.coveredNeedCount, 1);
assert.equal(isSchoolNeedEditHighlighted(needs[0], Date.parse("2026-10-05T14:14:00+07:00")), true);
assert.equal(isSchoolNeedEditHighlighted(needs[0], Date.parse("2026-10-05T14:15:00+07:00")), false);
assert.equal(schoolNeedEditLabel(needs[0]), "01/10/26 - 15:00 | Mỹ Nhung");
console.log("School assignment progress and edit highlight passed.");
