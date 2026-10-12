import assert from "node:assert/strict";
import fs from "node:fs";

const needRoute = fs.readFileSync("app/api/school-teaching-needs/route.ts", "utf8");
assert.doesNotMatch(needRoute, /mirrorAppNeedToIntake|assertAppNeedCanEditIntake/);
assert.match(needRoute, /SchoolScheduleImports/);
assert.match(needRoute, /sourceKind: "WEEKLY_OVERRIDE"/);
assert.match(needRoute, /sourceKind: "DIRECT_EDIT"/);
assert.match(needRoute, /isSchoolNeedCancelled/);

const needRules = fs.readFileSync("lib/school-teaching-needs.ts", "utf8");
assert.match(needRules, /legacySourceRowId/);
assert.match(needRules, /byLegacySourceRowId/);
assert.match(needRoute, /notifySchoolScheduleChange/);
assert.match(needRoute, /lastEditedBy: editorName/);

const patterns = fs.readFileSync("lib/school-schedule-patterns.ts", "utf8");
assert.match(patterns, /patternDateInWeek/);
assert.match(patterns, /materializePatternNeed/);
assert.match(patterns, /effectiveFrom/);
assert.match(patterns, /effectiveTo/);

const materialize = fs.readFileSync("app/api/school-schedule-patterns/materialize/route.ts", "utf8");
assert.match(materialize, /planPatternMaterialization/);
assert.match(materialize, /retiredCount/);
const assignment = fs.readFileSync("app/api/schedules/route.ts", "utf8");
assert.match(assignment, /hasPendingSchoolNeedReview/);
const reconcile = fs.readFileSync("app/api/school-teaching-needs/reconcile/route.ts", "utf8");
assert.match(reconcile, /canceledBySchool/);
assert.match(reconcile, /needStatuses/);

const app = fs.readFileSync("components/mettasoul-app.tsx", "utf8");
assert.match(app, /Lịch tuần cập nhật/);
assert.match(app, /Lịch nền cố định/);
assert.match(app, /buildFixedSchoolBaselineBatch\(sourceRows, schools, baselineEffectiveFrom, baselineEffectiveTo\)/);
assert.match(app, /source = \{ fullSnapshot: true, scopes, materializeAllWeeks: true \}/);
assert.match(app, /materializeAllWeeks: true/);
assert.match(app, /patterns = \(await apiRequest<\{ patterns: SchoolSchedulePattern\[\] \}>.*\.patterns\s*\.filter\(\(pattern\) => pattern\.effectiveFrom === baselineEffectiveFrom && pattern\.effectiveTo === baselineEffectiveTo\)/s);
assert.doesNotMatch(app, />Tạo lịch tuần từ lịch nền</);
const assignmentWeekEffect = app.slice(app.indexOf('if (authStatus !== "signed-in" || role !== "admin" || activeTab !== "assignment" || !assignmentSchoolId) return;'), app.indexOf('}, [activeTab, authStatus, role, assignmentWeekStart, assignmentSchoolId, activeTimeSlots, schools]);'));
assert.match(assignmentWeekEffect, /\/api\/school-teaching-needs\?from=/);
assert.doesNotMatch(assignmentWeekEffect, /\/api\/school-schedule-patterns\/materialize/);
const baselineApply = app.slice(app.indexOf('async function applySemesterPatternWorkbook()'), app.indexOf('function startEditSchoolNeed('));
assert.match(baselineApply, /\/api\/school-schedule-patterns/);
assert.doesNotMatch(app, /Áp dụng lịch nền vào tuần đang xem/);
const patternRoute = fs.readFileSync("app/api/school-schedule-patterns/route.ts", "utf8");
assert.match(patternRoute, /planSchoolSchedulePatternBatchSnapshot/);
assert.match(patternRoute, /planPatternMaterializationRange/);
assert.match(app, /extractGsheetScheduleRows/);
assert.match(app, /Mã CRM \(giữ khi sửa\)/);
assert.doesNotMatch(app, />Đối chiếu Sheet</);

console.log("Direct CRM schedule import checks passed.");
