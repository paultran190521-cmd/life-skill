import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";

class Range {
  constructor(sheet, r, c, nr = 1, nc = 1) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() { return Array.from({ length: this.nr }, (_, r) => Array.from({ length: this.nc }, (_, c) => this.sheet.rows[this.r - 1 + r]?.[this.c - 1 + c] ?? "")); }
  setValues(values) { values.forEach((row, r) => row.forEach((v, c) => { (this.sheet.rows[this.r - 1 + r] ||= [])[this.c - 1 + c] = v; })); return this; }
  setValue(v) { return this.setValues([[v]]); }
  setFontWeight() { return this; }
  setBackground() { return this; }
}
class Sheet {
  constructor(name, rows = []) { Object.assign(this, { name, rows }); }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(1, ...this.rows.map((r) => r.length)); }
  getRange(...args) { return new Range(this, ...args); }
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.rows.length), this.getLastColumn()); }
  appendRow(row) { this.rows.push(row); }
}
const sheets = new Map([
  new Sheet("Users", [["Email", "Password", "Role", "Name", "ID", "Settings", "Dependents", "Tags"], ["admin@example.com", "", "admin", "Admin", "a", "{}", 0, ""], ["teacher@example.com", "", "user", "Teacher", "t", "{}", 0, "MANAGER"], ["student@example.com", "", "user", "Student", "s", "{}", 0, ""]]),
  new Sheet("Tasks", [["ID", "GroupId", "Name", "Unit", "Rate", "FieldsConfig", "Status", "PolicyJson"], ["task", "g", "Teaching", "Tiết", 1, "[]", "Active", "{}"]]),
  new Sheet("WorkLogs", [["LogID", "UserEmail", "TaskID", "TaskName", "InputData_JSON", "CalculatedValue", "TotalMoney", "Timestamp", "DateLog", "", "Source"]]),
  new Sheet("SystemConfig", [["Key", "Value"]]),
].map((s) => [s.name, s]));
const db = { getSheetByName: (n) => sheets.get(n), insertSheet: (n) => { const s = new Sheet(n); sheets.set(n, s); return s; } };
let locked = false;
const properties = new Map();
const context = vm.createContext({ console, Date, Math, JSON, Number, Object, String, Error, isFinite,
  PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties.get(key), setProperty: (key, value) => properties.set(key, value) }) },
  getDatabase_: () => db, checkIsLocked_: () => false, getAllTasks_: () => [],
  LockService: { getScriptLock: () => ({ tryLock: () => { if (locked) return false; locked = true; return true; }, waitLock: () => { if (locked) throw new Error("Locked"); locked = true; }, releaseLock: () => { locked = false; } }) },
  Session: { getScriptTimeZone: () => "Asia/Ho_Chi_Minh" }, SpreadsheetApp: { flush() {} },
  Utilities: { getUuid: () => crypto.randomUUID(), formatDate: (v) => new Date(v).toISOString().slice(0, 10) },
});
for (const file of ["MettasoulIntegration.js", "TopicReport.js"]) vm.runInContext(fs.readFileSync(new URL(`../tmp/hrm-topic-report-release/src/${file}`, import.meta.url), "utf8"), context);
context.setupMettasoulIntegration_();
context.setSystemConfigValue_(db, "METTASOUL_TEACHING_TASK_ID", "task");
context.setSystemConfigValue_(db, "METTASOUL_INTEGRATION_ENABLED", "true");
for (const [email, category, assistant] of [["teacher@example.com", "PROFESSIONAL_TEACHER", "ASSISTANT_PRO"], ["student@example.com", "STUDENT_ASSISTANT", "ASSISTANT_STUDENT"]]) context.savePayProfileAssignment_({ UserEmail: email, DefaultProfileCode: "TEACHER_A", WorkerCategory: category, AssistantProfileCode: assistant, Status: "Active" }, "admin@example.com");
for (const code of ["S_8CE3530F", "S_F64787CC", "S_B55E24A3", "ordinary"]) context.saveTeachingContextRate_({ ContextType: "SCHOOL", ExternalCode: code, Name: code, Amount: 15000, McpPoints: 5, Status: "Active" }, "admin@example.com");
const input = (overrides = {}) => ({ source: "METTASOUL", eventId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), scheduleId: "schedule", periodId: "schedule", userEmail: "teacher@example.com", roleCode: "MAIN_TEACHER", schoolId: "ordinary", schoolName: "School", environmentCode: "schoolyard_report", environmentName: "Báo cáo chuyên đề", classId: "class", className: "Class", workDate: "2026-09-23", periodStartAt: "2026-09-23T06:00:00Z", periodEndAt: "2026-09-23T06:45:00Z", policyContract: "TOPIC_REPORT_V1", activityTypeCode: "STUDENT_TOPIC_REPORT_SUPPORT", principalCount: 2, approvedBy: "admin@example.com", evidenceUrl: "https://example.com/evidence", ...overrides });
const submit = (p) => context.submitTeachingPeriod_(p, "hash");
const policies = [["STUDENT_TOPIC_REPORT_SUPPORT", 1000000, 100, 2], ["STUDENT_TOPIC_REPORT_LEAD", 1500000, 100, 1], ["PARTNER_FREE_TOPIC", 2500000, 100, 1], ["DEMO_SESSION", 0, 20, 2]];
for (const [code, cash, mcp] of policies) context.saveMettasoulActivityPolicy_({ Code: code, Name: code, ActivityTypeCode: code, RoleCode: "PARTICIPANT", Unit: code === "DEMO_SESSION" ? "SESSION" : "TOPIC", CashAmount: cash, McpPoints: mcp, RequiresEvidence: code !== "DEMO_SESSION", Status: "Active" }, "admin@example.com");
let cases = 0;
for (const [activityTypeCode, cash, mcp, principalCount] of policies) {
  for (const schoolId of ["ordinary", "S_8CE3530F", "S_F64787CC", "S_B55E24A3"]) {
    for (const minutes of [45, 90, 95]) {
      const p = input({ activityTypeCode, principalCount, schoolId, periodEndAt: new Date(Date.parse("2026-09-23T06:00:00Z") + minutes * 60000).toISOString() });
      const result = submit(p);
      assert.equal(result.money, cash, "No split, duration multiplier, teaching pay or MANAGER bonus on activity pay");
      assert.equal(result.mcpPoints, mcp + (schoolId === "ordinary" ? 0 : minutes === 45 ? 5 : 10));
      const count = sheets.get("WorkLogs").getLastRow();
      assert.equal(submit(p).idempotent, true);
      assert.equal(sheets.get("WorkLogs").getLastRow(), count);
      cases++;
    }
  }
}
for (const [userEmail, cash] of [["teacher@example.com", 80000], ["student@example.com", 30000]]) {
  for (const schoolId of ["ordinary", "S_8CE3530F"]) {
    const result = submit(input({ roleCode: "ASSISTANT", userEmail, schoolId, periodEndAt: "2026-09-23T07:35:00Z" }));
    assert.equal(result.money, cash, "Assistant fixed amount; no manager or duration bonus");
    assert.equal(result.mcpPoints, schoolId === "ordinary" ? 0 : 10);
  }
}
for (const environmentCode of ["in_class", "outdoor", "gym", "hall"]) {
  assert.equal(submit(input({ activityTypeCode: "", environmentCode, roleCode: "ASSISTANT", userEmail: "student@example.com" })).money, 0);
}
for (const activityTypeCode of ["STUDENT_TOPIC_REPORT_LEAD", "PARTNER_FREE_TOPIC"]) assert.throws(() => submit(input({ activityTypeCode })), (e) => e.code === "INVALID_PRINCIPAL_COUNT");
assert.throws(() => submit(input({ approvedBy: "" })), (e) => e.code === "ACTIVITY_APPROVAL_REQUIRED");
assert.throws(() => submit(input({ evidenceUrl: "" })), (e) => e.code === "EVIDENCE_REQUIRED");
assert.throws(() => submit(input({ environmentCode: "in_class" })), (e) => e.code === "INVALID_TOPIC_REPORT");
assert.throws(() => submit(input({ activityTypeCode: "" })), (e) => e.code === "ACTIVITY_TYPE_REQUIRED");

const cancelled = input();
const report = { eventId: "cancel-1", targetIdempotencyKey: cancelled.idempotencyKey, scheduleId: cancelled.scheduleId, userEmail: cancelled.userEmail, reason: "Trường thông báo hủy" };
context.reportCancelledPeriod_(report, "hash");
context.reportCancelledPeriod_(report, "hash");
assert.throws(() => submit(cancelled), (e) => e.code === "PERIOD_CANCELLED");
const paid = input(); submit(paid);
assert.throws(() => context.reportCancelledPeriod_({ ...report, eventId: "cancel-2", targetIdempotencyKey: paid.idempotencyKey }, "hash"), (e) => e.code === "WORKLOG_ALREADY_CONFIRMED");

// Simulate a crash after cash write but before ledger/event commit. Retry repairs, never duplicates.
const partial = input({ schoolId: "S_8CE3530F" });
const award = context.awardTeachingContextMcp_;
context.awardTeachingContextMcp_ = () => { throw new Error("Simulated ledger failure"); };
assert.throws(() => submit(partial), /Simulated ledger failure/);
const count = sheets.get("WorkLogs").getLastRow();
context.awardTeachingContextMcp_ = award;
assert.throws(() => context.reportCancelledPeriod_({ ...report, targetIdempotencyKey: partial.idempotencyKey }, "hash"), (e) => e.code === "WORKLOG_ALREADY_CONFIRMED");
const recovered = submit(partial);
assert.equal(recovered.money, 1000000);
assert.equal(recovered.mcpPoints, 105);
assert.equal(sheets.get("WorkLogs").getLastRow(), count);
assert.equal(submit(partial).idempotent, true);

// Admin reversal offsets both activity MCP and far-school MCP and blocks late replay.
const reversal = context.cancelTeachingPeriod_({ eventId: "reverse-1", idempotencyKey: `CANCEL:${partial.idempotencyKey}`, targetIdempotencyKey: partial.idempotencyKey }, "hash");
assert.equal(reversal.mcpReversalPoints, -105);
const reversals = context.readSheetObjects_(sheets.get("MettasoulMcpLedger")).filter((row) => row.ExternalEventId === "reverse-1");
assert.equal(reversals.length, 1);
assert.equal(Number(reversals[0].Points) + recovered.mcpPoints, 0);
assert.throws(() => submit(partial), (e) => e.code === "PERIOD_CANCELLED");

const module = { exports: {} };
new Function("exports", "module", ts.transpileModule(fs.readFileSync(new URL("../lib/topic-report-policy.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(module.exports, module);
const { validateTopicReport, canonicalParticipantSchedule } = module.exports;
assert.equal(validateTopicReport("schoolyard_report", "STUDENT_TOPIC_REPORT_SUPPORT", ["a", "b"]), "");
assert.ok(validateTopicReport("schoolyard_report", "PARTNER_FREE_TOPIC", ["a", "b"]));
assert.ok(validateTopicReport("in_class", "DEMO_SESSION", ["a"]));
const a = { id: "a", teacherId: "t1", groupId: "g", assistantIds: "helper", teachingEnvironment: "schoolyard_report", activityTypeCode: "STUDENT_TOPIC_REPORT_SUPPORT" };
const b = { ...a, id: "b", teacherId: "t2" };
assert.equal(canonicalParticipantSchedule(b, "helper", [b, a]).id, "a");
assert.equal(canonicalParticipantSchedule(b, "t2", [b, a]).id, "b");
console.log(`Topic-report checks passed: ${cases} policy/school/duration combinations; assistant pay, approval, evidence, idempotency, partial-write recovery, cancellation and MCP reversal.`);
