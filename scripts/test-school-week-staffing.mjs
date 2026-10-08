import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
function loadTs(path, imports = {}) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)((name) => {
    if (name in imports) return imports[name];
    throw new Error("Unexpected import: " + name);
  }, module, module.exports);
  return module.exports;
}
const availabilityPolicy = loadTs("../lib/teacher-availability.ts");
const { assessSchoolWeekStaffing } = loadTs("../lib/school-week-staffing.ts", { "./teacher-availability": availabilityPolicy });
const date = "2026-10-08";
const slots = [
  { id: "a", label: "Tiết 1", start: "07:00", end: "07:45" },
  { id: "b", label: "Tiết 2", start: "07:45", end: "08:30" },
  { id: "double", label: "Khung 90", start: "07:00", end: "08:30" },
  { id: "parallel", label: "Tiết song song", start: "07:00", end: "07:45" },
];
const need = (id, classId, start = "07:00", end = "07:45") => ({
  id, classId, schoolId: "school", date, start, end, periodLabel: "Tiết",
  teachingEnvironment: "in_class", status: "OPEN",
});
const teacher = (id) => ({ id });
const available = (id) => ({ teacherId: id, date, status: "available", scope: "all_day" });
const base = { drafts: [], schedules: [], slots, canMerge: () => null };
const check = (overrides) => assessSchoolWeekStaffing({ ...base, ...overrides });
const parallel = check({
  needs: [need("one", "A"), need("two", "B")],
  teachers: [teacher("T1")], availability: [available("T1")],
});
assert.deepEqual([parallel.requiredAssignments, parallel.coverableAssignments, parallel.missingAssignments], [2, 1, 1]);
const separate = check({
  needs: [need("one", "A"), need("two", "A", "07:45", "08:30")],
  teachers: [teacher("T1")], availability: [available("T1")],
});
assert.deepEqual([separate.requiredAssignments, separate.missingAssignments], [2, 0]);
const merged = check({
  needs: [need("one", "A"), need("two", "A", "07:45", "08:30")],
  teachers: [teacher("T1")], availability: [available("T1")],
  canMerge: (first, second) => first.classId === second.classId && first.end === second.start ? slots[2] : null,
});
assert.deepEqual([merged.requiredAssignments, merged.mergeablePairs, merged.missingAssignments], [1, 1, 0]);
const booked = check({
  needs: [need("one", "A")], teachers: [teacher("T1")], availability: [available("T1")],
  schedules: [{ id: "s", teacherId: "T1", schoolId: "other", date, timeSlotId: "a", status: "sent" }],
});
assert.equal(booked.missingAssignments, 1);
const chosen = check({
  needs: [need("one", "A"), need("two", "B")],
  drafts: [{ schoolNeedIds: ["one"], teacherIds: ["T1"], timeSlotId: "a" }],
  teachers: [teacher("T1")], availability: [available("T1")],
});
assert.deepEqual([chosen.coveredPeriods, chosen.pendingPeriods, chosen.missingAssignments], [1, 1, 1]);
const twoTeachers = check({
  needs: [need("one", "A"), need("two", "B")],
  teachers: [teacher("T1"), teacher("T2")], availability: [available("T1"), available("T2")],
});
assert.equal(twoTeachers.missingAssignments, 0);
const noRegistration = check({ needs: [need("one", "A")], teachers: [teacher("T1")], availability: [] });
assert.deepEqual([noRegistration.registeredTeachers, noRegistration.missingAssignments], [0, 1]);
const splitWhenNoDoubleAvailability = check({
  needs: [need("one", "A"), need("two", "A", "07:45", "08:30")],
  teachers: [teacher("T1")],
  availability: [
    { teacherId: "T1", date, status: "available", scope: "time_slots", timeSlotId: "a" },
    { teacherId: "T1", date, status: "available", scope: "time_slots", timeSlotId: "b" },
  ],
  canMerge: (first, second) => first.classId === second.classId && first.end === second.start ? slots[2] : null,
});
assert.deepEqual([splitWhenNoDoubleAvailability.requiredAssignments, splitWhenNoDoubleAvailability.missingAssignments], [2, 0]);
console.log("School-week staffing scenarios passed.");
