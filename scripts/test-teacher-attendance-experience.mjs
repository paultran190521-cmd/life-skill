import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync(new URL("../components/mettasoul-app.tsx", import.meta.url), "utf8");
const reminderRoute = readFileSync(new URL("../app/api/attendance/reminders/route.ts", import.meta.url), "utf8");
const email = readFileSync(new URL("../lib/email.ts", import.meta.url), "utf8");

assert.match(component, /title="Lịch chưa dạy"/);
assert.match(component, /teacher-untaught-date-/);
assert.match(component, /onOpenDetail: setSelectedScheduleDetail/);
assert.match(component, /label="Chưa chấm công"/);
assert.match(component, /label="Đã chấm công"/);
assert.match(component, /sendAttendanceReminder/);
assert.match(reminderRoute, /admin_only_attendance_reminder/);
assert.match(reminderRoute, /hasEnded/);
assert.match(reminderRoute, /sendAttendanceReminderEmail/);
assert.match(email, /renderAttendanceReminderEmail/);
assert.match(email, /NHẮC CHẤM CÔNG/);

console.log("Teacher details, untaught calendar, and admin attendance reminder contracts passed.");
