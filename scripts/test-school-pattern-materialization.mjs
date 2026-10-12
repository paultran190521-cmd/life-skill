import assert from "node:assert/strict";
import { materializePatternNeed, planPatternMaterialization } from "../lib/school-schedule-patterns.ts";

const rule = {
  id: "pattern-1", schoolId: "school-1", classId: "class-1", weekday: 1,
  periodLabel: "Tiết 1", start: "07:30", end: "08:05", teachingEnvironment: "in_class",
  effectiveFrom: "2026-10-01", effectiveTo: "2026-12-31", sourceNote: "", status: "ACTIVE", version: 1,
};
const monday = "2026-10-12";
const first = planPatternMaterialization([rule], [], "school-1", monday);
assert.equal(first.candidateCount, 1);
assert.equal(first.creates.length, 1);
assert.equal(first.updates.length, 0);
const base = { ...materializePatternNeed(rule, monday), id: "need-1", status: "OPEN", scheduleId: "" };
const again = planPatternMaterialization([rule], [base], "school-1", monday);
assert.equal(again.creates.length, 0);
assert.equal(again.updates.length, 0);
assert.equal(again.skippedCount, 1);

const changedRule = { ...rule, weekday: 2, start: "08:10", end: "08:45", version: 2 };
const moved = planPatternMaterialization([changedRule], [base], "school-1", monday);
assert.equal(moved.creates.length, 0, "moving a rule within the week must update its original need");
assert.equal(moved.updates.length, 1);
assert.equal(moved.updates[0].target.id, "need-1");
assert.equal(moved.updates[0].row.date, "2026-10-13");
assert.equal(moved.updates[0].status, "OPEN");

const assigned = { ...base, status: "ASSIGNED", scheduleId: "schedule-1" };
const review = planPatternMaterialization([changedRule], [assigned], "school-1", monday);
assert.equal(review.updates[0].status, "REVIEW", "an assigned schedule must be reviewed after a base change");
const weeklyOverride = { ...assigned, sourceKind: "WEEKLY_OVERRIDE" };
const protectedWeek = planPatternMaterialization([changedRule], [weeklyOverride], "school-1", monday);
assert.equal(protectedWeek.creates.length, 0);
assert.equal(protectedWeek.updates.length, 0);
const directEdit = { ...assigned, sourceKind: "DIRECT_EDIT" };
assert.equal(planPatternMaterialization([changedRule], [directEdit], "school-1", monday).updates.length, 0);
const weeklyFirst = { ...base, id: "weekly-1", sourceKind: "WEEKLY_OVERRIDE", patternId: undefined, classId: "class-2", start: "09:00", end: "09:35" };
assert.equal(planPatternMaterialization([changedRule], [weeklyFirst], "school-1", monday).creates.length, 0, "a full weekly snapshot suppresses every later base candidate for that week");
assert.equal(planPatternMaterialization([changedRule], [directEdit], "school-1", monday).creates.length, 0);

const oldRule = { ...rule, status: "SUPERSEDED" };
const replacement = { ...rule, id: "pattern-2", classId: "class-2" };
const replaced = planPatternMaterialization([oldRule, replacement], [base], "school-1", monday);
assert.equal(replaced.retirements.length, 1);
assert.equal(replaced.retirements[0].status, "CANCELLED");
assert.equal(replaced.creates.length, 1);
const replacedAssigned = planPatternMaterialization([oldRule, replacement], [assigned], "school-1", monday);
assert.equal(replacedAssigned.retirements[0].status, "REVIEW");
assert.equal(replacedAssigned.creates.length, 0, "replacement rows must wait until an assigned old rule is reconciled");
assert.equal(replacedAssigned.hasPendingSupersededReview, true);
const reviewPending = { ...assigned, status: "REVIEW", sourceStatus: "Trường hủy tiết" };
assert.equal(planPatternMaterialization([oldRule, replacement], [reviewPending], "school-1", monday).creates.length, 0);
const retiredOnce = { ...base, status: "CANCELLED", sourceStatus: "Trường hủy tiết" };
assert.equal(planPatternMaterialization([oldRule, replacement], [retiredOnce], "school-1", monday).retirements.length, 0);

const occupied = { ...base, id: "need-other", patternId: "pattern-other", date: "2026-10-13", start: "08:10", end: "08:45" };
assert.equal(planPatternMaterialization([changedRule], [base, occupied], "school-1", monday).conflicts.length, 1);
assert.equal(planPatternMaterialization([rule], [], "school-1", "2027-01-04").candidateCount, 0);
console.log("School pattern materialization policy checks passed.");
