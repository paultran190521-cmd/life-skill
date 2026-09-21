import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/time-slots.ts", "utf8");

assert.match(source, /timeSlotBelongsToSchool/);
assert.match(source, /if \(!prefix\) return false/);
assert.match(source, /school\.includes\("tan tuc"\).*isDoubleTeachingTimeSlot/);
assert.match(source, /school\.includes\("thu duc"\).*=== 45/);

const app = fs.readFileSync("components/mettasoul-app.tsx", "utf8");
assert.match(app, /return slots\.filter\(\(slot\) => isTimeSlotAllowedForSchool\(slot, schoolName\)\)/);
assert.doesNotMatch(app, /return filtered\.length > 0 \? filtered : slots/);

const route = fs.readFileSync("app/api/schedules/route.ts", "utf8");
assert.match(route, /isTimeSlotAllowedForSchool/);
assert.match(route, /Khung giờ không thuộc trường đã chọn/);

const schedulePatch = fs.readFileSync("app/api/schedules/[id]/route.ts", "utf8");
assert.match(schedulePatch, /Khung giờ thay thế không thuộc trường của lịch/);

console.log("School-specific time-slot policy checks passed.");
