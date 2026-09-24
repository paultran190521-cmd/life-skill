import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/cron/teaching-reminders/route.ts", import.meta.url), "utf8");
const settingsRoute = readFileSync(new URL("../app/api/reminder-settings/route.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("../lib/teaching-reminders.ts", import.meta.url), "utf8");
const email = readFileSync(new URL("../lib/email.ts", import.meta.url), "utf8");
const sheets = readFileSync(new URL("../lib/google-sheets.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../components/mettasoul-app.tsx", import.meta.url), "utf8");
const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

assert.deepEqual(vercel.crons, [{ path: "/api/cron/teaching-reminders", schedule: "0 */5 * * *" }]);
assert.match(route, /request\.headers\.get\("authorization"\) !== `Bearer \$\{cronSecret\}`/);
assert.match(route, /runTeachingReminders\("system:cron"\)/);
assert.match(service, /const reminderIntervalHours = 5/);
assert.match(service, /settings\.scheduleConfirmationEnabled/);
assert.match(service, /settings\.workLogReminderEnabled/);
assert.match(service, /\["sent", "reassigned"\]\.includes\(schedule\.status\)/);
assert.match(service, /\["PENDING", "CONFIRMED"\]/);
assert.match(service, /sendScheduleReminderEmail/);
assert.match(service, /sendAttendanceReminderEmail/);
assert.match(service, /ReminderRuns/);
assert.match(service, /reminderRunId\("schedule-confirmation"/);
assert.match(service, /reminderRunId\("teaching-work-log"/);
assert.match(service, /lastRunStatus/);
assert.match(settingsRoute, /admin_only_reminder_settings/);
assert.match(settingsRoute, /body\.action !== "run-now"/);
assert.match(settingsRoute, /teaching_reminders\.settings_update/);
assert.match(email, /NHẮC XÁC NHẬN LỊCH DẠY/);
assert.match(email, /Nhắc chấm công/);
assert.match(sheets, /export const reminderRunHeaders/);
assert.match(sheets, /export const reminderSettingsHeaders/);
assert.match(app, /Bộ nhắc tự động/);
assert.match(app, /Nhắc xác nhận lịch/);
assert.match(app, /Nhắc chấm công/);
assert.match(app, /Quét và gửi nhắc ngay/);

console.log("Automated five-hour teaching reminder settings contracts passed.");
