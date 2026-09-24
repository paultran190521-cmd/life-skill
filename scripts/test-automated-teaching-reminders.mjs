import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/cron/teaching-reminders/route.ts", import.meta.url), "utf8");
const email = readFileSync(new URL("../lib/email.ts", import.meta.url), "utf8");
const sheets = readFileSync(new URL("../lib/google-sheets.ts", import.meta.url), "utf8");
const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

assert.deepEqual(vercel.crons, [{ path: "/api/cron/teaching-reminders", schedule: "0 */5 * * *" }]);
assert.match(route, /request\.headers\.get\("authorization"\) !== `Bearer \$\{cronSecret\}`/);
assert.match(route, /const reminderIntervalMs = 5 \* 60 \* 60 \* 1_000/);
assert.match(route, /\["sent", "reassigned"\]\.includes\(schedule\.status\)/);
assert.match(route, /\["PENDING", "CONFIRMED"\]/);
assert.match(route, /sendScheduleReminderEmail/);
assert.match(route, /sendAttendanceReminderEmail/);
assert.match(route, /ReminderRuns/);
assert.match(route, /reminderRunId\("schedule-confirmation"/);
assert.match(route, /reminderRunId\("teaching-work-log"/);
assert.match(email, /NHẮC XÁC NHẬN LỊCH DẠY/);
assert.match(email, /Nhắc chấm công/);
assert.match(sheets, /export const reminderRunHeaders/);

console.log("Automated five-hour teaching reminder contracts passed.");
