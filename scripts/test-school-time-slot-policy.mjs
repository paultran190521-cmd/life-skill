import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/time-slots.ts", "utf8");

assert.match(source, /timeSlotBelongsToSchool/);
assert.match(source, /if \(!prefix\) return false/);
assert.match(source, /if \(school\.includes\("tan tuc"\)\) return !isDouble && duration === 45/);
assert.match(source, /if \(school\.includes\("tdtt"\)\) return !isDouble && duration === 45/);
assert.match(source, /replace\(\/\^truong\\s\+\//);
assert.match(source, /"pt nk tdtt binh chanh": \["nktdtt", "tdtt"\]/);
assert.match(source, /if \(!isDouble \|\| duration !== 90\) return false/);
assert.match(source, /isConfiguredThuDucThreeFourSlot/);
assert.match(source, /normalizeTimeValue\(slot\.start\) === "14:50"/);
assert.match(source, /normalizeTimeValue\(slot\.end\) === "16:20"/);
assert.match(source, /normalizeTimeValue\(slot\.start\) === "14:45" && normalizeTimeValue\(slot\.end\) === "16:15"/);

const app = fs.readFileSync("components/mettasoul-app.tsx", "utf8");
assert.match(app, /return slots\.filter\(\(slot\) => isTimeSlotAllowedForSchool\(slot, schoolName\)\)/);
assert.doesNotMatch(app, /return filtered\.length > 0 \? filtered : slots/);
assert.match(app, /const requestedSchoolId = String\(item\.schoolId \|\| ""\)\.trim\(\)/);
assert.match(app, /schoolSlots = schoolId\s*\?\s*schedulingTimeSlotsForSchool/);
assert.match(app, /isConfiguredThuDucThreeFourSlot\(slot\)/);
assert.match(app, /formatScheduleTimeSlotOptionLabel\(slot, activeTimeSlots, rowSchool\?\.name/);
assert.match(app, /return `TĐ - \$\{periodDisplay\}\. \$\{slot\.start\} - \$\{slot\.end\}`/);
assert.match(app, /return `\$\{display\} · \$\{slot\.start\}-\$\{slot\.end\}`/);
assert.match(app, /<option value="">Chọn trường<\/option>/);
assert.match(app, /setDraftSchedule\(\{\s*items: \[createDraftScheduleItem\(\{ teachingEnvironment: defaultTeachingEnvironment \}\)\]/);
assert.match(app, /Chọn trường trước/);

const route = fs.readFileSync("app/api/schedules/route.ts", "utf8");
assert.match(route, /isTimeSlotAllowedForSchool/);
assert.match(route, /Khung giờ không thuộc trường đã chọn/);

const schedulePatch = fs.readFileSync("app/api/schedules/[id]/route.ts", "utf8");
assert.match(schedulePatch, /Khung giờ thay thế không thuộc trường của lịch/);

console.log("School-specific time-slot policy checks passed.");
