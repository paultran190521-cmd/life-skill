import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/teacher-availability.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const policyModule = { exports: {} };
new Function("module", "exports", compiled)(policyModule, policyModule.exports);
const { availabilityMatchesTimeSlot, canRegisterTeacherAvailability, isTeacherAvailableForSlot } = policyModule.exports;

const morningSlot = { id: "slot-morning", start: "07:30" };
const afternoonSlot = { id: "slot-afternoon", start: "13:30" };
const base = { status: "available" };

assert.equal(availabilityMatchesTimeSlot({ ...base, scope: "all_day" }, morningSlot), true);
assert.equal(availabilityMatchesTimeSlot({ ...base, scope: "all_day" }, afternoonSlot), true);
assert.equal(availabilityMatchesTimeSlot({ ...base, scope: "morning" }, morningSlot), true);
assert.equal(availabilityMatchesTimeSlot({ ...base, scope: "morning" }, afternoonSlot), false);
assert.equal(availabilityMatchesTimeSlot({ ...base, scope: "afternoon" }, morningSlot), false);
assert.equal(availabilityMatchesTimeSlot({ ...base, scope: "afternoon" }, afternoonSlot), true);
assert.equal(availabilityMatchesTimeSlot({ ...base, scope: "time_slots", timeSlotId: "slot-morning" }, morningSlot), true);
assert.equal(availabilityMatchesTimeSlot({ ...base, scope: "time_slots", timeSlotId: "slot-morning" }, afternoonSlot), false);
assert.equal(availabilityMatchesTimeSlot({ scope: "all_day", status: "withdrawn" }, morningSlot), false);
assert.equal(
  isTeacherAvailableForSlot(
    [{ teacherId: "teacher-1", date: "2026-09-08", scope: "morning", status: "available" }],
    "teacher-1",
    "2026-09-08",
    morningSlot,
  ),
  true,
);
assert.equal(
  isTeacherAvailableForSlot(
    [{ teacherId: "teacher-1", date: "2026-09-08", scope: "morning", status: "available" }],
    "teacher-2",
    "2026-09-08",
    morningSlot,
  ),
  false,
);
assert.equal(canRegisterTeacherAvailability("teacher", "teacher-1"), true);
assert.equal(canRegisterTeacherAvailability("assistant", "teacher-1"), true);
assert.equal(canRegisterTeacherAvailability("admin", "teacher-1"), false);
assert.equal(canRegisterTeacherAvailability("assistant", ""), false);

console.log("Teacher availability policy tests passed (15 cases).");
