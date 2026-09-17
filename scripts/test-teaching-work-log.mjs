import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/teaching-work-log.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const runtimeModule = { exports: {} };
new Function("module", "exports", "require", compiled)(runtimeModule, runtimeModule.exports, (specifier) => {
  if (specifier === "node:crypto") return { createHash };
  throw new Error(`Unexpected test import: ${specifier}`);
});

const {
  deterministicTeachingEventId,
  deterministicTeachingWorkLogId,
  resolveTeachingRole,
  schedulePeriodTimes,
  teachingWorkLogKey,
} = runtimeModule.exports;

const main = {
  id: "schedule-main",
  date: "2026-09-17",
  teacherId: "teacher-a",
  timeSlotId: "slot-1",
  groupId: "group-1",
  assistantIds: "teacher-helper,student-helper",
  teachingRole: "MAIN_TEACHER",
};
const coTeacher = {
  ...main,
  id: "schedule-co",
  teacherId: "teacher-b",
  assistantIds: "",
  teachingRole: "CO_TEACHER",
};
assert.equal(resolveTeachingRole(main, "teacher-a", [main, coTeacher]), "MAIN_TEACHER");
assert.equal(resolveTeachingRole(coTeacher, "teacher-b", [main, coTeacher]), "CO_TEACHER");
assert.equal(resolveTeachingRole(main, "teacher-helper", [main, coTeacher]), "ASSISTANT");
assert.equal(resolveTeachingRole(main, "student-helper", [main, coTeacher]), "ASSISTANT");
assert.equal(resolveTeachingRole(main, "unassigned", [main, coTeacher]), "");

const legacyMain = { ...main, id: "legacy-1", groupId: "legacy", assistantIds: "", teachingRole: undefined };
const legacyCo = { ...coTeacher, id: "legacy-2", groupId: "legacy", assistantIds: "", teachingRole: undefined };
assert.equal(resolveTeachingRole(legacyMain, "teacher-a", [legacyMain, legacyCo]), "MAIN_TEACHER");
assert.equal(resolveTeachingRole(legacyCo, "teacher-b", [legacyMain, legacyCo]), "CO_TEACHER");

const period = schedulePeriodTimes(main, [{ id: "slot-1", label: "Tiết 1", start: "13:30", end: "14:15" }]);
assert.equal(period.startsAt.toISOString(), "2026-09-17T06:30:00.000Z");
assert.equal(period.endsAt.toISOString(), "2026-09-17T07:15:00.000Z");

const key = teachingWorkLogKey("schedule-main", "teacher-helper", "ASSISTANT");
assert.equal(key, "METTASOUL:schedule-main:teacher-helper:ASSISTANT");
assert.equal(deterministicTeachingEventId(key), deterministicTeachingEventId(key));
assert.equal(deterministicTeachingWorkLogId(key), deterministicTeachingWorkLogId(key));
assert.notEqual(deterministicTeachingEventId(key), deterministicTeachingEventId(`${key}:other`));

console.log("Teaching work-log tests passed for per-period roles, time boundaries, and idempotency.");
