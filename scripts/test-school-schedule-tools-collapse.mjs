import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../components/mettasoul-app.tsx", import.meta.url), "utf8");
const start = source.indexOf('id="assignment-school-schedule-tools"');
const end = source.indexOf('{schoolNeedLoadError ?', start);
assert.ok(start >= 0 && end > start, "schedule tools have a separate collapsible region");
const toolsRegion = source.slice(start, end);

assert.match(source, /const \[isSchoolScheduleToolsExpanded, setIsSchoolScheduleToolsExpanded\] = useState\(true\)/);
assert.match(source.slice(0, start), /aria-expanded=\{isSchoolScheduleToolsExpanded\}/);
assert.match(source.slice(0, start), /aria-controls="assignment-school-schedule-tools"/);
assert.match(source.slice(0, start), /onClick=\{\(\) => setIsSchoolScheduleToolsExpanded\(\(expanded\) => !expanded\)\}/);
assert.match(toolsRegion, /hidden=\{!isSchoolScheduleToolsExpanded\}/);
assert.match(toolsRegion, /weekStaffing\.missingAssignments/);
assert.match(toolsRegion, /Lịch tuần cập nhật/);
assert.match(toolsRegion, /Lịch nền cố định/);
assert.match(toolsRegion, /Xác nhận lưu lịch nền học kỳ/);
assert.ok(source.indexOf('id="assignment-school-needs-list"') > end, "weekly school need list remains outside schedule tools");

console.log("School schedule tools collapse contract checks passed.");
