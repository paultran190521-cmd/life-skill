import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../components/mettasoul-app.tsx", import.meta.url), "utf8");
const start = source.indexOf('aria-label="Danh sách tiết của trường trong tuần"');
const end = source.indexOf('</section> : null}', start);
assert.ok(start >= 0 && end > start, "school need list has its own collapsible section");
const section = source.slice(start, end);

assert.match(source, /const \[isSchoolNeedListExpanded, setIsSchoolNeedListExpanded\] = useState\(true\)/);
assert.match(section, /aria-expanded=\{isSchoolNeedListExpanded\}/);
assert.match(section, /aria-controls="assignment-school-needs-list"/);
assert.match(section, /onClick=\{\(\) => setIsSchoolNeedListExpanded\(\(expanded\) => !expanded\)\}/);
assert.match(section, /id="assignment-school-needs-list" hidden=\{!isSchoolNeedListExpanded\}/);
assert.match(section, /Chọn tất cả \$\{selectableWeekNeeds\.length\} tiết chưa giao/);
assert.match(section, /weekNeeds\.slice\(\)\.sort/);
assert.match(section, /editingSchoolNeedDraft && editingSchoolNeedId/);

console.log("School need list collapse contract checks passed.");
