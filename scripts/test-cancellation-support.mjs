import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import ts from "typescript";

function load(path, imports = {}) {
  const module = { exports: {} };
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("module", "exports", "require", js)(module, module.exports, (name) => {
    if (!(name in imports)) throw new Error(`Missing test dependency: ${name}`);
    return imports[name];
  });
  return module.exports;
}
let actor = { role: "teacher", teacherId: "t1", email: "teacher@example.com" };
const schedules = [{ id: "s1", teacherId: "t1", date: "2026-10-02", timeSlotId: "slot", schoolId: "school", classId: "class", status: "attended", teachingEnvironment: "in_class" }];
const key = "METTASOUL:s1:t1:MAIN_TEACHER";
const rows = { Schedules: schedules, Attendance: [{ scheduleId: "s1", teacherId: "t1", checkedInAt: "2026-10-02T07:00:00+07:00" }], TeachingWorkLogs: [{ id: "log1", scheduleId: "s1", teacherId: "t1", idempotencyKey: key, status: "CONFIRMED", money: "165000" }] };
const reports = [];
const calls = [];
const route = load("app/api/schedule-cancellations/route.ts", {
  "node:crypto": { createHash },
  "next/server": { NextResponse: Response },
  "@/lib/api": { createRequestId: () => "test", apiFailure: (status, error) => Response.json({ error }, { status }), apiError: (error) => Response.json({ error: error.message }, { status: 500 }) },
  "@/lib/route-auth": { requireSessionUser: async () => ({ user: actor }) },
  "@/lib/google-sheets": { readSheetRowsBatch: async () => structuredClone(rows), appendSheetRows: async (_name, items) => reports.push(...items), updateSheetRowById: async (name, id, patch) => Object.assign(name === "TeachingWorkLogs" ? rows.TeachingWorkLogs.find((row) => row.id === id) : reports.find((row) => row.id === id), patch) },
  "@/lib/schedule-cancellation-reports": { readCancellationReports: async () => reports, reconcileCancellationReport: async () => { throw new Error("Confirmed pay must wait for admin review"); } },
  "@/lib/hrm-integration": { adjustCancelledPeriodInHrm: async (payload) => { calls.push(payload); return { money: 82500, mcpPoints: 20 }; } },
  "@/lib/audit": { appendAuditLogs: async () => {} },
  "@/lib/topic-report-policy": { canonicalParticipantSchedule: (schedule) => schedule },
  "@/lib/teaching-work-log": { resolveTeachingRole: (schedule, teacherId) => schedule.teacherId === teacherId ? "MAIN_TEACHER" : "", teachingWorkLogKey: (scheduleId, teacherId, role) => `METTASOUL:${scheduleId}:${teacherId}:${role}` },
});
async function send(method, body) {
  const response = await route[method](new Request("https://local/api/schedule-cancellations", { method, body: JSON.stringify(body) }));
  return { status: response.status, body: await response.json() };
}
const reported = await send("POST", { scheduleId: "s1", reason: "Trường hủy tiết thứ hai" });
assert.equal(reported.status, 202);
assert.equal(reports[0].status, "PENDING");
assert.equal(rows.TeachingWorkLogs[0].status, "CONFIRMED", "Teacher report never deletes confirmed pay");
assert.equal((await send("PATCH", { id: reports[0].id, supportPercent: 50, adminReason: "Trường thông báo muộn" })).status, 403);
actor = { role: "admin", email: "admin@example.com" };
const reviewed = await send("PATCH", { id: reports[0].id, supportPercent: 50, adminReason: "Trường thông báo muộn" });
assert.equal(reviewed.status, 200);
assert.equal(reviewed.body.report.status, "REVIEWED");
assert.equal(reviewed.body.report.adminReason, "Trường thông báo muộn");
assert.equal(rows.TeachingWorkLogs[0].money, 82500);
assert.equal(calls[0].targetIdempotencyKey, key);
assert.equal(calls[0].supportPercent, 50);
console.log("Teacher cancellation and admin support review passed without deleting the HRM work log.");

const scheduleRows = {
  Schedules: [{ id: "future", teacherId: "t1", date: "2099-10-02", schoolId: "school", classId: "class", lessonId: "lesson", timeSlotId: "slot", status: "sent", teachingEnvironment: "in_class" }],
  TeachingWorkLogs: [], TimeSlots: [{ id: "slot", start: "13:00", end: "13:45" }],
  Schools: [{ id: "school", name: "Trường xa" }], Classes: [{ id: "class", name: "10A1" }],
  Users: [{ teacherId: "t1", email: "teacher@example.com" }], Notifications: [],
};
const createdSupport = [];
let dropPendingSupport = false;
const scheduleRoute = load("app/api/schedules/[id]/route.ts", {
  "node:crypto": { createHash }, "next/server": { NextResponse: Response },
  "@/lib/api": { createRequestId: () => "test", createId: () => "notification", apiFailure: (status, error) => Response.json({ error }, { status }), apiError: (error) => Response.json({ error: error.message }, { status: 500 }) },
  "@/lib/audit": { appendAuditLog: async () => {} },
  "@/lib/email": { sendScheduleEmail: async () => {} },
  "@/lib/google-sheets": {
    ensureSheetHeaders: async () => {}, scheduleHeaders: [], teachingWorkLogHeaders: [], schoolTeachingNeedHeaders: [],
    readSheetRowById: async (name, id) => scheduleRows[name]?.find((row) => row.id === id),
    readSheetRows: async (name) => scheduleRows[name] || [], readSheetRowsBatch: async () => structuredClone(scheduleRows),
    appendSheetRows: async (name, items) => {
      if (dropPendingSupport && name === "TeachingWorkLogs" && items.some((item) => item.status === "PENDING")) {
        dropPendingSupport = false;
        return;
      }
      scheduleRows[name].push(...structuredClone(items));
    },
    updateSheetRowById: async (name, id, patch) => Object.assign(scheduleRows[name].find((row) => row.id === id), patch),
  },
  "@/lib/schedule-cascade-delete": { deleteSchedulesCascade: async () => {}, resetScheduleAssignmentData: async () => {} },
  "@/lib/route-auth": { requireSessionUser: async () => ({ user: { role: "admin", email: "admin@example.com" }, source: "session" }), evaluatePermission: () => ({ allowed: true, decision: "allow", authMode: "enforce", reason: "test" }) },
  "@/lib/schedule-conflict-index": { invalidateScheduleConflictIndex: () => {} },
  "@/lib/schedule-conflict-policy": { hasTeacherTimeConflict: () => false },
  "@/lib/teaching-work-log-cancellation": { cancelConfirmedTeachingWorkLogs: async () => { throw new Error("Do not reverse pay or MCP for admin support"); } },
  "@/lib/hrm-integration": { adjustCancelledPeriodInHrm: async () => { throw new Error("No prior work log to adjust"); }, submitCancelledSupportToHrm: async (payload) => { createdSupport.push(payload); return { money: 82500, mcpPoints: 20, workLogId: "hrm-support", policyVersion: "CANCEL_SUPPORT:50" }; } },
  "@/lib/teaching-work-log": load("lib/teaching-work-log.ts", { "node:crypto": { createHash } }),
  "@/lib/time-slots": { isTimeSlotAllowedForSchool: () => true },
});
const cancelled = await scheduleRoute.PATCH(new Request("https://local/api/schedules/future", { method: "PATCH", body: JSON.stringify({ status: "cancelled", supportPercent: 50, adminReason: "Trường hủy trước buổi" }) }), { params: Promise.resolve({ id: "future" }) });
assert.equal(cancelled.status, 200, "Admin cancellation before check-in can create a support work log");
assert.equal(createdSupport[0].entryMode, "CANCEL_SUPPORT");
assert.equal(createdSupport[0].supportPercent, 50);
assert.equal(scheduleRows.TeachingWorkLogs[0].money, 82500);
assert.equal(scheduleRows.TeachingWorkLogs[0].mcpPoints, 20);
assert.equal(scheduleRows.Schedules[0].cancellationReason, "Trường hủy trước buổi");
scheduleRows.Schedules.push({ ...scheduleRows.Schedules[0], id: "lost-pending", status: "sent", cancellationReason: "" });
dropPendingSupport = true;
const priorSupportCalls = createdSupport.length;
const missingPending = await scheduleRoute.PATCH(new Request("https://local/api/schedules/lost-pending", { method: "PATCH", body: JSON.stringify({ status: "cancelled", supportPercent: 50, adminReason: "Trường hủy trước buổi" }) }), { params: Promise.resolve({ id: "lost-pending" }) });
assert.equal(missingPending.status, 500);
assert.equal(createdSupport.length, priorSupportCalls, "No HRM support record may be created without a durable local PENDING row");
const supportLog = scheduleRows.TeachingWorkLogs[0];
supportLog.status = "PENDING";
const worker = load("lib/payroll-reconciliation.ts", {
  "@/lib/google-sheets": {
    readSheetRowsBatch: async () => structuredClone({ TeachingWorkLogs: scheduleRows.TeachingWorkLogs, Schedules: scheduleRows.Schedules, Attendance: [] }),
    updateSheetRowById: async (_name, id, patch) => Object.assign(scheduleRows.TeachingWorkLogs.find((row) => row.id === id), patch),
  },
  "@/lib/hrm-integration": {
    submitTeachingPeriodToHrm: async () => { throw new Error("Support must use its own HRM action"); },
    submitCancelledSupportToHrm: async (payload) => { createdSupport.push(payload); return { workLogId: "hrm-support", money: 82500, mcpPoints: 20 }; },
  },
  "@/lib/schedule-cancellation-reports": { readCancellationReports: async () => [], blocksParticipant: () => false },
  "@/lib/teaching-work-log": load("lib/teaching-work-log.ts", { "node:crypto": { createHash } }),
  "@/lib/worklog-rows": load("lib/worklog-rows.ts"),
});
assert.equal((await worker.reconcilePayrollOutbox()).confirmed, 1, "Pending support must recover without an attendance row");
assert.equal(supportLog.status, "CONFIRMED");
assert.equal(createdSupport.at(-1).entryMode, "CANCEL_SUPPORT");
console.log("Admin cancellation before check-in records support and the teacher-visible reason.");
