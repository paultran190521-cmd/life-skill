import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createHash } from "node:crypto";

function loadTs(path, dependencies = {}, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === "node:crypto") return { createHash };
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error(`Unexpected import: ${name}`);
    },
    console,
    Date,
    Set,
    Map,
    ...globals,
  }, { filename: path });
  return exports;
}

const grouping = loadTs("lib/attendance-grouping.ts");
const policy = loadTs("lib/pre-class-attendance-policy.ts", { "@/lib/attendance-grouping": grouping });
const date = "2026-10-03";
const start = Date.parse(`${date}T08:00:00+07:00`);
const schedules = [
  { id: "s1", date, teacherId: "t1", schoolId: "school-1", classId: "class-1", timeSlotId: "slot-1", status: "sent" },
  { id: "s2", date, teacherId: "t1", schoolId: "school-1", classId: "class-2", timeSlotId: "slot-2", status: "confirmed" },
  { id: "cancelled", date, teacherId: "t1", schoolId: "school-1", classId: "class-1", timeSlotId: "slot-1", status: "cancelled" },
];
const slots = [{ id: "slot-1", start: "08:00" }, { id: "slot-2", start: "09:00" }];
const select = (now, attendance = []) => policy.selectPreClassAttendanceAlerts(schedules, attendance, slots, now);
assert.equal(select(start - 16 * 60_000).length, 0);
assert.equal(select(start - 15 * 60_000).length, 1);
assert.equal(select(start - 60_000).length, 1);
assert.equal(select(start).length, 0);
assert.equal(select(start - 15 * 60_000, [{ scheduleId: "s2", teacherId: "t1" }]).length, 0);
assert.deepEqual(Array.from(select(start - 15 * 60_000)[0].scheduleIds), ["s1", "s2"]);

const store = {
  Schedules: [schedules[0]], Attendance: [], TimeSlots: slots,
  Users: [
    { id: "u1", name: "Admin One", email: "ONE@example.com", role: "admin", isActive: "true" },
    { id: "u2", name: "Admin Two", email: "two@example.com", role: "admin", isActive: "true" },
    { id: "u3", name: "Former Admin", email: "old@example.com", role: "admin", isActive: "false" },
    { id: "u4", name: "Teacher", email: "teacher@example.com", role: "teacher", isActive: "true" },
  ],
  Teachers: [{ id: "t1", name: "Teacher One" }], Schools: [{ id: "school-1", name: "School One" }],
  Classes: [{ id: "class-1", name: "Class One" }], ReminderRuns: [],
};
const sent = [];
let shouldFail = false;
const fixedDate = class extends Date {
  constructor(...args) { super(...(args.length ? args : [start - 15 * 60_000])); }
  static now() { return start - 15 * 60_000; }
};
const service = loadTs("lib/pre-class-attendance-alerts.ts", {
  "@/lib/email": { sendPreClassAttendanceAlertEmail: async (input) => {
    sent.push(input);
    return shouldFail ? { sent: false, reason: "simulated" } : { sent: true, id: "mail-test" };
  } },
  "@/lib/google-sheets": {
    ensureSheetHeaders: async () => {}, reminderRunHeaders: [],
    readSheetRowsBatch: async () => store,
    readSheetRows: async () => store.Attendance,
    appendSheetRows: async (name, rows) => { store[name].push(...rows); },
  },
  "@/lib/pre-class-attendance-policy": policy,
}, { Date: fixedDate });

const first = await service.runPreClassAttendanceAlerts();
assert.equal(first.ok, true);
assert.equal(first.sentEmailCount, 2);
assert.equal(first.recordedAlertCount, 2);
assert.deepEqual(sent.map((input) => input.admin.email).sort(), ["one@example.com", "two@example.com"]);
assert.equal((await service.runPreClassAttendanceAlerts()).sentEmailCount, 0);
assert.equal(sent.length, 2);

store.ReminderRuns.length = 0;
store.Attendance.push({ scheduleId: "s1", teacherId: "t1" });
assert.equal((await service.runPreClassAttendanceAlerts()).candidateCount, 0);
store.Attendance.length = 0;
shouldFail = true;
const failed = await service.runPreClassAttendanceAlerts();
assert.equal(failed.ok, false);
assert.equal(failed.failedEmailCount, 2);
assert.equal(store.ReminderRuns.length, 0);

const route = fs.readFileSync(new URL("../app/api/cron/pre-class-attendance-alerts/route.ts", import.meta.url), "utf8");
const workflow = fs.readFileSync(new URL("../.github/workflows/pre-class-attendance-alerts.yml", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../components/mettasoul-app.tsx", import.meta.url), "utf8");
assert.match(route, /authorization.*Bearer/);
assert.match(workflow, /cron: "\*\/5 \* \* \* \*"/);
assert.match(workflow, /secrets\.CRON_SECRET/);
assert.match(app, /Kế hoạch<br \/>giảng dạy/);
console.log("Pre-class attendance alert policy and safe delivery tests passed.");
