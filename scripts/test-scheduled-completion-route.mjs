import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createHash } from "node:crypto";

function load(file, imports = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("module", "exports", "require", js)(module, module.exports, (name) => {
    if (!(name in imports)) throw new Error(`Missing test dependency: ${name}`);
    return imports[name];
  });
  return module.exports;
}
const policy = load("lib/topic-report-policy.ts");
const worklogs = load("lib/teaching-work-log.ts", { "node:crypto": { createHash } });
const { uniqueWorkLogRows } = load("lib/worklog-rows.ts");
assert.equal(uniqueWorkLogRows(["COMPLETED", "PENDING", "CONFIRMED"].map((status) => ({ id: "same", status }))).length, 1);
assert.equal(uniqueWorkLogRows(["COMPLETED", "PENDING"].map((status) => ({ id: "same", status })))[0].status, "PENDING");
let actor = { role: "teacher", teacherId: "t1", email: "teacher@example.com" };
let reports = [];
let submitted = [];
const rows = {
  Schedules: [{ id: "s1", teacherId: "t1", date: "2026-09-23", schoolId: "school", classId: "class", timeSlotId: "slot", teachingEnvironment: "schoolyard_report", activityTypeCode: "STUDENT_TOPIC_REPORT_SUPPORT", status: "attended", assistantIds: "t2" }],
  TimeSlots: [{ id: "slot", start: "13:00", end: "13:45" }], Schools: [{ id: "school", name: "School" }], Classes: [{ id: "class", name: "Class" }],
  Attendance: [{ id: "a1", scheduleId: "s1", teacherId: "t1" }, { id: "a2", scheduleId: "s1", teacherId: "t2" }],
  TeachingWorkLogs: [], Users: [{ teacherId: "t1", email: "teacher@example.com" }, { teacherId: "t2", email: "helper@example.com" }],
};
const sheetApi = {
  ensureSheetHeaders: async () => {}, teachingWorkLogHeaders: [],
  readSheetRowsBatch: async () => structuredClone(rows),
  appendSheetRows: async (name, items) => { rows[name].push(...structuredClone(items)); },
  updateSheetRowById: async (name, id, patch) => Object.assign(rows[name].find((row) => row.id === id), structuredClone(patch)),
};
const api = {
  createRequestId: () => "test", apiFailure: (status, error) => Response.json({ error }, { status }),
  apiError: (error) => Response.json({ error: error.message }, { status: 500 }),
};
const route = load("app/api/teaching-work-logs/route.ts", {
  "next/server": { NextResponse: Response, after: () => {} }, "@/lib/api": api, "@/lib/audit": { appendAuditLogs: async () => {} },
  "@/lib/error-codes": { ErrorCodes: {} }, "@/lib/google-sheets": sheetApi,
  "@/lib/route-auth": { requireSessionUser: async () => ({ user: actor }), evaluatePermission: () => ({ allowed: true }) },
  "@/lib/topic-report-policy": policy, "@/lib/teaching-work-log": worklogs,
  "@/lib/worklog-rows": load("lib/worklog-rows.ts"),
  "@/lib/schedule-cancellation-reports": { readCancellationReports: async () => reports, blocksParticipant: (items, id, teacher) => items.some((r) => r.scheduleId === id && r.teacherId === teacher && r.status !== "REJECTED") },
  "@/lib/hrm-integration": { submitTeachingPeriodToHrm: async (p) => { submitted.push(p); return { ok: true, workLogId: "hrm1", money: 1000000, mcpPoints: 100, policyVersion: "test" }; } },
});
const post = async (body) => { const response = await route.POST(new Request("https://local/api", { method: "POST", body: JSON.stringify(body) })); return { status: response.status, body: await response.json() }; };
let result = await post({ scheduleId: "s1", money: 999999, approvedBy: "attacker", intent: "approve", teacherId: "t2" });
assert.equal(result.body.workLog.status, "COMPLETED");
assert.equal(result.body.workLog.evidenceUrl, "", "Evidence is optional when completing");
assert.equal(result.body.workLog.teacherId, "t1", "Teacher cannot approve or impersonate another participant");
assert.equal(submitted.length, 0, "Completing is not payroll approval");
assert.equal((await post({ scheduleId: "s1" })).body.awaitingApproval, true);
assert.equal(rows.TeachingWorkLogs.length, 1);
actor = { role: "admin", email: "admin@example.com" };
assert.equal((await post({ scheduleId: "s1", teacherId: "t2", intent: "approve", evidenceUrl: "https://example.com/evidence" })).status, 409);
result = await post({ scheduleId: "s1", teacherId: "t1", intent: "approve" });
assert.equal(result.body.workLog.status, "CONFIRMED");
assert.equal(submitted.length, 1);
assert.equal(submitted[0].approvedBy, "admin@example.com");
assert.equal(submitted[0].policyContract, "TOPIC_REPORT_V1");
assert.equal("money" in submitted[0], false, "Never trust a client amount");
assert.equal((await post({ scheduleId: "s1", teacherId: "t1", intent: "approve" })).body.idempotent, true);
assert.equal(submitted.length, 1);
actor = { role: "teacher", teacherId: "outsider", email: "outsider@example.com" };
assert.equal((await post({ scheduleId: "s1" })).status, 403);
actor = { role: "teacher", teacherId: "t2", email: "helper@example.com" };
reports = [{ scheduleId: "s1", teacherId: "t2", status: "PENDING" }];
assert.equal((await post({ scheduleId: "s1", evidenceUrl: "https://example.com/evidence" })).status, 409);
reports = [];
rows.Attendance = rows.Attendance.filter((row) => row.teacherId !== "t2");
assert.equal((await post({ scheduleId: "s1", evidenceUrl: "https://example.com/evidence" })).status, 409);
console.log("Completion route tests passed: attendance, optional evidence, no client amount/approval spoofing, admin approval, idempotency, participant isolation and cancellation blocking.");

const worker = load("lib/payroll-reconciliation.ts", {
  "@/lib/google-sheets": sheetApi, "@/lib/worklog-rows": { uniqueWorkLogRows },
  "@/lib/teaching-work-log": worklogs,
  "@/lib/schedule-cancellation-reports": { readCancellationReports: async () => reports, reconcileCancellationReport: async (r) => r, blocksParticipant: (items, id, teacher) => items.some((r) => r.scheduleId === id && r.teacherId === teacher && r.status !== "REJECTED") },
  "@/lib/hrm-integration": { submitTeachingPeriodToHrm: async (p) => { submitted.push(p); return { ok: true, money: 1000000, mcpPoints: 100, workLogId: "hrm1" }; } },
});
rows.TeachingWorkLogs[0].status = "PENDING";
assert.equal((await worker.reconcilePayrollOutbox()).confirmed, 1, "Durable reconciliation works with browser closed");
assert.equal(submitted.at(-1).eventId, submitted[0].eventId, "Replay preserves event ID");
rows.TeachingWorkLogs[0].status = "PENDING";
reports = [{ scheduleId: "s1", teacherId: "t1", status: "CONFIRMED" }];
assert.equal((await worker.reconcilePayrollOutbox()).confirmed, 0, "Worker never pays cancelled participation");
reports = [];
rows.TeachingWorkLogs[0].approvedBy = "";
assert.equal((await worker.reconcilePayrollOutbox()).confirmed, 0, "Worker cannot approve an activity");
console.log("Durable outbox tests passed: automatic recovery, unchanged event ID, cancellation block and approval enforcement.");
