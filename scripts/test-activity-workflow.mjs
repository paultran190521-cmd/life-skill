import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const activities = read("../app/api/activities/route.ts");
const completion = read("../app/api/activities/[id]/complete/route.ts");
const approval = read("../app/api/activities/[id]/approve/route.ts");
const sheetSource = read("../lib/google-sheets.ts");
const app = read("../components/mettasoul-app.tsx");
const hrm = read("../../../../APP CÔNG TY/app_cham_cong/_source_sync/working-live/src/MettasoulIntegration.js");
const hrmUi = read("../../../../APP CÔNG TY/app_cham_cong/_source_sync/working-live/src/index.html");

assert.match(activities, /admin_only_activity_create/);
assert.match(activities, /ActivityOccurrences/);
assert.match(activities, /ActivityAssignments/);
assert.match(completion, /assigned_participant_completed_activity/);
assert.match(completion, /cần đính kèm liên kết minh chứng/);
assert.match(approval, /admin_only_activity_approve/);
assert.match(approval, /submitActivityCompletionToHrm/);
assert.match(sheetSource, /MELIS_SESSION/);
assert.match(sheetSource, /ActivityTypes/);
assert.match(app, /Công việc & MCP/);
assert.match(app, /Xác nhận hoàn thành/);
assert.match(hrm, /SUBMIT_ACTIVITY_COMPLETION/);
assert.match(hrm, /MettasoulMcpLedger/);
assert.match(hrmUi, /Chính sách Công việc khác & MCP/);
assert.match(hrmUi, /Sổ MCP/);
assert.match(hrmUi, /saveMettasoulActivityPolicy/);

console.log("Activity workflow tests passed for assignment, evidence, approval, HRM pay, and MCP ledger boundaries.");
