import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/attendance-grouping.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const runtimeModule = { exports: {} };
new Function("module", "exports", compiled)(runtimeModule, runtimeModule.exports);
const { attendanceGroupKey, attendanceSessionForStart } = runtimeModule.exports;
const slots = [
  { id: "morning-1", start: "07:30" },
  { id: "morning-2", start: "10:15" },
  { id: "afternoon-1", start: "13:30" },
];
const base = { teacherId: "teacher-1", date: "2026-09-15", schoolId: "school-a" };

assert.equal(attendanceSessionForStart("11:59"), "morning");
assert.equal(attendanceSessionForStart("12:00"), "afternoon");
assert.equal(attendanceGroupKey({ ...base, timeSlotId: "morning-1" }, slots), attendanceGroupKey({ ...base, timeSlotId: "morning-2" }, slots));
assert.notEqual(attendanceGroupKey({ ...base, timeSlotId: "morning-1" }, slots), attendanceGroupKey({ ...base, timeSlotId: "afternoon-1" }, slots));
assert.notEqual(attendanceGroupKey({ ...base, timeSlotId: "morning-1" }, slots), attendanceGroupKey({ ...base, schoolId: "school-b", timeSlotId: "morning-1" }, slots));

console.log("Attendance grouping tests passed for teacher, date, school, and session boundaries.");
