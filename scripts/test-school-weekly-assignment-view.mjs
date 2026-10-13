import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../components/mettasoul-app.tsx", import.meta.url), "utf8");

assert.match(source, /const \[isSchoolNeedListExpanded, setIsSchoolNeedListExpanded\] = useState\(false\)/);
assert.match(source, /const \[isWeeklyAssignmentListExpanded, setIsWeeklyAssignmentListExpanded\] = useState\(false\)/);
assert.match(source, /schoolNeeds\.filter\(\(need\) => need\.schoolId === assignmentSchoolId && need\.date >= assignmentWeekStart && need\.date <= weekEnd\)/);
assert.match(source, /activeAssignmentBatchItems\.filter\(\(item\) => item\.schoolId === assignmentSchoolId && item\.date >= assignmentWeekStart && item\.date <= weekEnd\)/);
assert.match(source, /assignmentBatchMissingNeeds\.filter\(\(need\) => need\.date >= assignmentWeekStart && need\.date <= weekEnd\)/);
assert.match(source, /setAssignmentWeekStart\(mondayDateKey\(event\.target\.value\)\); setSchoolNeeds\(\[\]\); setDraftSchedule/);
assert.match(source, /setIsSchoolNeedListExpanded\(false\); setIsWeeklyAssignmentListExpanded\(false\)/);
assert.match(source, /setEditingSchoolNeedId\(""\); setEditingSchoolNeedDraft\(null\); setAssignmentPreviewTeacherId\("all"\)/);

const panelStart = source.indexOf('<Panel title="Tạo lịch dạy mới"');
const panelEnd = source.indexOf("</Panel>", panelStart);
assert.ok(panelStart >= 0 && panelEnd > panelStart, "weekly assignment panel exists");
const panel = source.slice(panelStart, panelEnd);
assert.match(panel, /aria-expanded=\{isWeeklyAssignmentListExpanded\}/);
assert.match(panel, /aria-controls="assignment-weekly-draft-list"/);
assert.match(panel, /id="assignment-weekly-draft-list" hidden=\{Boolean\(assignmentSchoolId\) && !isWeeklyAssignmentListExpanded\}/);
assert.match(panel, /\$\{selectableWeekNeeds\.length\} tiết chưa giao, \$\{assignmentProgress\.remainingNeedCount\} tiết chưa có giáo viên/);
assert.match(panel, /draftSchedule\.items\.map\(\(item, index\) =>/);

console.log("School weekly assignment view contract checks passed.");
