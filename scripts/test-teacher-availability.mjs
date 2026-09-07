import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/teacher-availability.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const policyModule = { exports: {} };
new Function("module", "exports", compiled)(policyModule, policyModule.exports);
const {
  availabilityMatchesTimeSlot,
  availabilityTimeRangeKey,
  buildTeacherAvailabilityEntries,
  canRegisterTeacherAvailability,
  isTeacherAvailableOnDate,
  isTeacherAvailableForSlot,
  uniqueAvailabilityTimeRanges,
} = policyModule.exports;

const morningSlot = { id: "slot-morning", start: "07:30", end: "08:15" };
const afternoonSlot = { id: "slot-afternoon", start: "13:30", end: "14:15" };
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
assert.equal(availabilityTimeRangeKey(morningSlot), "time:07:30-08:15");
assert.equal(
  availabilityMatchesTimeSlot({ ...base, scope: "time_slots", timeSlotId: "time:07:30-08:15" }, morningSlot),
  true,
);
const ranges = uniqueAvailabilityTimeRanges([
  { id: "school-a-slot", label: "Trường A - Tiết 1", start: "07:30", end: "08:15" },
  { id: "school-b-slot", label: "Trường B - Tiết 1", start: "07:30", end: "08:15" },
  { id: "school-a-afternoon", label: "Trường A - Tiết 1C", start: "13:30", end: "14:15" },
]);
assert.equal(ranges.length, 2);
assert.deepEqual(ranges.map((range) => range.id), ["time:07:30-08:15", "time:13:30-14:15"]);
assert.deepEqual(ranges.map((range) => range.label), ["07:30-08:15", "13:30-14:15"]);
assert.deepEqual(
  buildTeacherAvailabilityEntries({
    "2026-09-10": { scope: "all_day", timeSlotIds: ["ignored"] },
    "2026-09-08": { scope: "morning", timeSlotIds: [] },
    "2026-09-11": { scope: "time_slots", timeSlotIds: ["time:07:30-08:15"] },
    "2026-09-09": { scope: "afternoon", timeSlotIds: [] },
  }),
  [
    { date: "2026-09-08", scope: "morning", timeSlotIds: [] },
    { date: "2026-09-09", scope: "afternoon", timeSlotIds: [] },
    { date: "2026-09-10", scope: "all_day", timeSlotIds: [] },
    { date: "2026-09-11", scope: "time_slots", timeSlotIds: ["time:07:30-08:15"] },
  ],
);
assert.equal(
  isTeacherAvailableOnDate(
    [{ teacherId: "assistant-1", date: "2026-09-09", status: "available" }],
    "assistant-1",
    "2026-09-09",
  ),
  true,
);
assert.equal(
  isTeacherAvailableOnDate(
    [{ teacherId: "assistant-1", date: "2026-09-09", status: "withdrawn" }],
    "assistant-1",
    "2026-09-09",
  ),
  false,
);
const filteringScenario = [
  { teacherId: "teacher-all-day", date: "2027-09-09", scope: "all_day", status: "available" },
  { teacherId: "teacher-exact", date: "2027-09-09", scope: "time_slots", timeSlotId: "time:08:00-08:45", status: "available" },
  { teacherId: "teacher-afternoon", date: "2027-09-09", scope: "afternoon", status: "available" },
  { teacherId: "assistant-other-time", date: "2027-09-09", scope: "time_slots", timeSlotId: "time:09:00-09:45", status: "available" },
];
const eightOClockSlot = { id: "school-slot-08", start: "08:00", end: "08:45" };
assert.deepEqual(
  filteringScenario
    .filter((entry) => isTeacherAvailableForSlot(filteringScenario, entry.teacherId, "2027-09-09", eightOClockSlot))
    .map((entry) => entry.teacherId),
  ["teacher-all-day", "teacher-exact"],
);
assert.equal(
  filteringScenario.filter((entry) => isTeacherAvailableOnDate(filteringScenario, entry.teacherId, "2027-09-09")).length,
  4,
);

console.log("Teacher availability policy tests passed (25 cases).");
