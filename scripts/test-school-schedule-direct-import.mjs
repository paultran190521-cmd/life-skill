import assert from "node:assert/strict";
import fs from "node:fs";

const needRoute = fs.readFileSync("app/api/school-teaching-needs/route.ts", "utf8");
assert.doesNotMatch(needRoute, /mirrorAppNeedToIntake|assertAppNeedCanEditIntake/);
assert.match(needRoute, /SchoolScheduleImports/);
assert.match(needRoute, /sourceKind: "WEEKLY_OVERRIDE"/);
assert.match(needRoute, /sourceKind: "DIRECT_EDIT"/);
assert.match(needRoute, /notifySchoolScheduleChange/);
assert.match(needRoute, /lastEditedBy: editorName/);

const patterns = fs.readFileSync("lib/school-schedule-patterns.ts", "utf8");
assert.match(patterns, /patternDateInWeek/);
assert.match(patterns, /materializePatternNeed/);
assert.match(patterns, /effectiveFrom/);
assert.match(patterns, /effectiveTo/);

const materialize = fs.readFileSync("app/api/school-schedule-patterns/materialize/route.ts", "utf8");
assert.match(materialize, /existingByPatternDate/);
assert.match(materialize, /existingByIdentity/);

const app = fs.readFileSync("components/mettasoul-app.tsx", "utf8");
assert.match(app, /Tải mẫu lịch nền học kỳ/);
assert.match(app, /Tạo lịch tuần từ lịch nền/);
assert.doesNotMatch(app, />Đối chiếu Sheet</);

console.log("Direct CRM schedule import checks passed.");
