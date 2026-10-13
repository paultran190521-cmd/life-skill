import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("components/mettasoul-app.tsx", "utf8");
const add = source.slice(source.indexOf("function addSelectedDraftItemsToDispatchBatch()"), source.indexOf("function removeDispatchBatchItem("));
const send = source.slice(source.indexOf("async function createSchedules()"), source.indexOf("async function confirmSchedule("));

assert.match(add, /setAssignmentBatchItems\(\(current\) => \[\.\.\.current, \.\.\.selectedItems\]\)/);
assert.match(add, /setAssignmentBatchDeferredIds/);
assert.doesNotMatch(add, /if \(draftScheduleConflicts\.length > 0\)/);
assert.doesNotMatch(add, /if \(draftLessonProgressionConflicts\.length > 0\)/);
assert.match(send, /const dispatchItems = activeAssignmentBatchItems/);
assert.match(send, /setAssignmentBatchItems\(\(items\) => items\.filter\(\(item\) => !sentItemIds\.has\(item\.id\)\)\)/);
assert.match(source, /const assignmentDraftItems = activeAssignmentBatchItems/);
assert.match(source, /const currentFormPreview = useMemo\(\s*\(\) => previewSchedulesForDraftItems\(draftSchedule\.items\)/);
assert.match(source, /const draftSchedulePreview = useMemo\(\s*\(\) => previewSchedulesForDraftItems\(assignmentDraftItems\)/);
assert.match(source, /Đang chọn bên trái · chưa thêm vào đợt, chưa gửi/);
assert.match(source, /renderScheduleList\(\{ items: filteredCurrentFormPreview, compact: true \}\)/);
assert.match(source, /Đã thêm vào đợt · dự kiến gửi email/);
assert.match(source, /selectionScheduleConflicts: findDraftTimeConflicts\(\[/);
assert.match(source, /\.\.\.draftSchedulePreview,\s*\.\.\.currentFormPreview\.filter/);
assert.match(source, /draftScheduleConflicts: findDraftTimeConflicts\(draftSchedulePreview\)/);
assert.match(source, /selectionLessonProgressionConflicts = useMemo/);
assert.match(source, /rowConflictMessages\.length > 0/);
assert.match(source, /role="alert" className="mt-3 rounded-xl border border-rose-300 bg-rose-50/);
assert.match(source, /selectionConflictMessages\.length > 0/);
assert.match(source, /disabled=\{isBusy \|\| activeAssignmentBatchItems\.length === 0 \|\| draftScheduleConflicts\.length > 0 \|\| draftLessonProgressionConflicts\.length > 0\}/);
assert.match(source, /assignmentBatchMissingNeeds\.filter\(\(need\) => need\.schoolId === schoolId\)\.length/);
assert.match(source, /Đưa về sửa/);
assert.match(source, /Để sau/);

console.log("Partial school dispatch batch contract checks passed.");
