import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function loadModule(path, requireModule = () => { throw new Error("Unexpected import"); }) {
  const source = fs.readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(requireModule, module, module.exports);
  return module.exports;
}

const availabilityPolicy = loadModule("../lib/teacher-availability.ts");
const { teacherWorkloadRows, unassignedAvailabilityWarnings } = loadModule(
  "../lib/teacher-workload.ts",
  (name) => {
    if (name === "@/lib/teacher-availability") return availabilityPolicy;
    throw new Error(`Unexpected import: ${name}`);
  },
);
const teachers = [
  { id: "a", name: "An" },
  { id: "b", name: "Bình" },
];
const slots = [
  { id: "morning", start: "08:00", end: "08:45" },
  { id: "afternoon", start: "13:00", end: "13:45" },
];
const schedule = (id, teacherId, date, timeSlotId, extras = {}) => ({
  id, teacherId, date, timeSlotId, status: "sent", ...extras,
});
const availability = (id, teacherId, date, scope, extras = {}) => ({
  id, registrationId: id, teacherId, date, scope, status: "available", ...extras,
});

const rows = teacherWorkloadRows(
  teachers,
  [
    schedule("single", "a", "2026-10-05", "morning"),
    schedule("double", "a", "2026-10-06", "morning", { lessonPeriods: "lesson1,lesson2" }),
    schedule("cancelled", "b", "2026-10-06", "morning", { status: "cancelled" }),
    schedule("draft", "b", "2026-10-06", "morning", { status: "draft" }),
  ],
  [{ scheduleId: "single", teacherId: "a" }, { scheduleId: "single", teacherId: "a" }],
  [availability("one", "b", "2026-10-05", "all_day"), availability("two", "b", "2026-10-06", "morning")],
);
assert.deepEqual(rows.map(({ teacherId, assigned, taught, registeredDays }) => ({ teacherId, assigned, taught, registeredDays })), [
  { teacherId: "a", assigned: 3, taught: 1, registeredDays: 0 },
  { teacherId: "b", assigned: 0, taught: 0, registeredDays: 2 },
]);

const pending = [
  availability("one", "a", "2026-10-09", "morning"),
  availability("two", "a", "2026-10-09", "time_slots", { timeSlotId: "time:13:00-13:45" }),
  availability("three", "b", "2026-10-10", "all_day"),
  availability("withdrawn", "b", "2026-10-07", "all_day", { status: "withdrawn" }),
];
const warnings = unassignedAvailabilityWarnings(
  pending,
  [schedule("morning-assigned", "a", "2026-10-09", "morning")],
  slots,
  "2026-10-05",
);
assert.equal(warnings.length, 1, "Only the unassigned afternoon slot inside the four-day window warns");
assert.equal(warnings[0].entries[0].id, "two");
assert.equal(unassignedAvailabilityWarnings(
  [availability("assistant", "b", "2026-10-08", "all_day")],
  [schedule("assistant-assigned", "a", "2026-10-08", "morning", { assistantIds: "b" })],
  slots,
  "2026-10-05",
).length, 0, "Assistant assignment satisfies a registered day");
assert.equal(unassignedAvailabilityWarnings(
  [availability("past", "a", "2026-10-04", "all_day")], [], slots, "2026-10-05",
).length, 0, "Past registrations leave the active warning list");
assert.equal(unassignedAvailabilityWarnings(
  [availability("cancelled-day", "a", "2026-10-07", "all_day")],
  [schedule("cancelled-assignment", "a", "2026-10-07", "morning", { status: "cancelled" })],
  slots,
  "2026-10-05",
).length, 1, "A cancelled schedule does not hide an unassigned warning");
assert.equal(unassignedAvailabilityWarnings(
  [availability("reassigned-day", "b", "2026-10-07", "all_day")],
  [schedule("reassigned-current", "b", "2026-10-07", "morning", { status: "reassigned", reassignedFrom: "a" })],
  slots,
  "2026-10-05",
).length, 0, "A reassigned schedule counts for its current teacher");

console.log("Teacher workload and availability warnings passed");
