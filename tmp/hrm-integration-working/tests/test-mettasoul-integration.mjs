import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";

class MockRange {
  constructor(sheet, row, column, numRows = 1, numColumns = 1) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.numRows = numRows;
    this.numColumns = numColumns;
  }
  getValues() {
    const result = [];
    for (let r = 0; r < this.numRows; r += 1) {
      const values = [];
      for (let c = 0; c < this.numColumns; c += 1) {
        values.push(this.sheet.rows[this.row - 1 + r]?.[this.column - 1 + c] ?? "");
      }
      result.push(values);
    }
    return result;
  }
  setValues(values) {
    for (let r = 0; r < values.length; r += 1) {
      while (this.sheet.rows.length < this.row + r) this.sheet.rows.push([]);
      for (let c = 0; c < values[r].length; c += 1) {
        this.sheet.rows[this.row - 1 + r][this.column - 1 + c] = values[r][c];
      }
    }
    return this;
  }
  setValue(value) { return this.setValues([[value]]); }
  setFontWeight() { return this; }
  setBackground() { return this; }
}

class MockSheet {
  constructor(name, rows = []) { this.name = name; this.rows = rows.map((row) => [...row]); }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((max, row) => Math.max(max, row.length), 0); }
  getDataRange() { return new MockRange(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  getRange(row, column, numRows = 1, numColumns = 1) { return new MockRange(this, row, column, numRows, numColumns); }
  appendRow(row) { this.rows.push([...row]); }
}

class MockSpreadsheet {
  constructor(sheets) { this.sheets = new Map(sheets.map((sheet) => [sheet.name, sheet])); }
  getSheetByName(name) { return this.sheets.get(name) ?? null; }
  insertSheet(name) { const sheet = new MockSheet(name); this.sheets.set(name, sheet); return sheet; }
}

const sheet = (name, headers, rows = []) => new MockSheet(name, [headers, ...rows]);
const ss = new MockSpreadsheet([
  sheet("Users", ["Email", "Password", "Role", "Name", "ID", "Settings", "Dependents", "Tags"], [
    ["admin@example.com", "x", "admin", "Admin", "A1", "{}", 0, ""],
    ["teacher@example.com", "x", "user", "Teacher", "T1", "{}", 0, "MANAGER"],
    ["student@example.com", "x", "user", "Student", "T2", "{}", 0, ""]
  ]),
  sheet("Tasks", ["ID", "GroupId", "Name", "Unit", "Rate", "FieldsConfig", "Status", "PolicyJson"], [
    ["TSK_KNS", "GRP_KNS", "Dạy kỹ năng sống", "Tiết", 1, "[]", "Active", "{}"]
  ]),
  // This is the live, legacy WorkLogs schema. Payroll reads TotalMoney (G),
  // so the integration must not only support the newer Money header.
  sheet("WorkLogs", ["LogID", "UserEmail", "TaskID", "TaskName", "InputData_JSON", "CalculatedValue", "TotalMoney", "Timestamp", "DateLog", ""]),
  sheet("SystemConfig", ["Key", "Value"])
]);

const scriptProperties = new Map();
let uuidCounter = 0;
const toSignedBytes = (buffer) => [...buffer].map((value) => (value > 127 ? value - 256 : value));

const context = vm.createContext({
  console,
  Date,
  Error,
  JSON,
  Math,
  Number,
  Object,
  String,
  RegExp,
  isFinite,
  getDatabase: () => ss,
  getAllTasks: () => [],
  checkIsLocked: () => false,
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Session: { getScriptTimeZone: () => "Asia/Ho_Chi_Minh" },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (key) => scriptProperties.get(key) ?? null,
      setProperty: (key, value) => scriptProperties.set(key, value)
    })
  },
  Utilities: {
    Charset: { UTF_8: "UTF_8" },
    DigestAlgorithm: { SHA_256: "SHA_256" },
    computeHmacSha256Signature: (text, secret) => toSignedBytes(crypto.createHmac("sha256", secret).update(text, "utf8").digest()),
    computeDigest: (_algorithm, text) => toSignedBytes(crypto.createHash("sha256").update(text, "utf8").digest()),
    getUuid: () => `uuid-${++uuidCounter}`,
    formatDate: (value) => new Date(value).toISOString().slice(0, 10)
  },
  ContentService: {
    MimeType: { JSON: "application/json" },
    createTextOutput: (value) => ({ value, setMimeType() { return this; } })
  }
});

const source = fs.readFileSync(new URL("../src/MettasoulIntegration.js", import.meta.url), "utf8");
vm.runInContext(source, context, { filename: "MettasoulIntegration.js" });

const call = (expression) => vm.runInContext(expression, context);
const setupResult = call("setupMettasoulIntegration() ");
assert.equal(setupResult.success, true);
assert.equal(ss.getSheetByName("TeachingPayProfiles").getLastRow(), 6, "five seed profiles plus header");
assert.equal(ss.getSheetByName("TeachingContextRates").getLastRow(), 6, "five seed environments plus header");
assert.equal(ss.getSheetByName("WorkLogs").getLastColumn(), 20, "integration columns are appended");

call("setMettasoulRuntimeConfigValue_(getDatabase(), 'METTASOUL_TEACHING_TASK_ID', 'TSK_KNS')");
call("setMettasoulRuntimeConfigValue_(getDatabase(), 'METTASOUL_INTEGRATION_ENABLED', 'true')");
assert.equal(scriptProperties.get("METTASOUL_TEACHING_TASK_ID"), "TSK_KNS", "task mapping is shared through Script Properties");
assert.equal(scriptProperties.get("METTASOUL_INTEGRATION_ENABLED"), "true", "enabled state is shared through Script Properties");

scriptProperties.delete("METTASOUL_INTEGRATION_ENABLED");
assert.equal(call("getMettasoulRuntimeConfigValue_(getDatabase(), 'METTASOUL_INTEGRATION_ENABLED')"), "true", "legacy sheet config is migrated once");
assert.equal(scriptProperties.get("METTASOUL_INTEGRATION_ENABLED"), "true", "migration persists the shared switch");
// Admin RPC functions receive actor as a second argument; invoke explicitly.
call(`saveTeachingContextRate(${JSON.stringify({ ContextType: "SCHOOL", ExternalCode: "school-remote", Name: "Trường xa", Amount: 15000, McpPoints: 5, Status: "Active" })}, 'admin@example.com')`);
call(`savePayProfileAssignment(${JSON.stringify({ UserEmail: "teacher@example.com", DefaultProfileCode: "TEACHER_A", WorkerCategory: "PROFESSIONAL_TEACHER", AssistantProfileCode: "ASSISTANT_PRO", Status: "Active" })}, 'admin@example.com')`);
call(`savePayProfileAssignment(${JSON.stringify({ UserEmail: "student@example.com", DefaultProfileCode: "", WorkerCategory: "STUDENT_ASSISTANT", AssistantProfileCode: "", Status: "Active" })}, 'admin@example.com')`);
const nameSync = call(`syncMettasoulWorkerNamesFromJson(${JSON.stringify(JSON.stringify([
  { email: "teacher@example.com", name: "Giáo viên METTASOUL", role: "teacher", teacherId: "teacher-1" },
  { email: "not-in-hrm@example.com", name: "Chưa có HRM", role: "teacher", teacherId: "teacher-2" }
]))}, 'admin@example.com')`);
assert.equal(nameSync.updated, 1, "matching HRM identity receives the METTASOUL display name");
assert.equal(nameSync.unchanged, 0);
assert.equal(nameSync.notFound, 1, "missing HRM identities are reported without being created");
assert.equal(ss.getSheetByName("Users").rows[2][3], "Giáo viên METTASOUL", "only the HRM name column changes");
const rateImport = call(`applyTeachingPayAssignmentsFromRates(${JSON.stringify([
  { email: "teacher@example.com", rate: "165.000 đồng/tiết" },
  { email: "missing@example.com", rate: 155000 },
  { email: "student@example.com", rate: 123456 }
])}, '2026-09-05', '2027-09-05', 'admin@example.com')`);
assert.equal(rateImport.updated.length, 1, "a source rate maps only to an existing HRM rate profile");
assert.equal(rateImport.updated[0].profileCode, "TEACHER_A");
assert.equal(rateImport.needsReview.length, 2, "missing identity and unmapped rate require review instead of a zero-pay assignment");
const importedAssignmentHeaders = ss.getSheetByName("PayProfileAssignments").rows[0];
const importedTeacherAssignment = ss.getSheetByName("PayProfileAssignments").rows.find((row) => row[importedAssignmentHeaders.indexOf("UserEmail")] === "teacher@example.com");
assert.equal(importedTeacherAssignment[importedAssignmentHeaders.indexOf("EffectiveFrom")], "2026-09-05");
assert.equal(importedTeacherAssignment[importedAssignmentHeaders.indexOf("EffectiveTo")], "2027-09-05");
const melisPolicies = call("applyMettasoulMelisActivityPolicies('admin@example.com')");
assert.equal(melisPolicies.activityPolicies.length, 2, "both MELIS session policies are configured");

const teacherInput = {
  eventId: "evt-1",
  idempotencyKey: "schedule-1:lesson1:teacher@example.com:MAIN_TEACHER",
  scheduleId: "schedule-1",
  periodId: "lesson1",
  userEmail: "teacher@example.com",
  roleCode: "MAIN_TEACHER",
  schoolId: "school-remote",
  schoolName: "Trường xa",
  environmentCode: "outdoor",
  environmentName: "Ngoài sân",
  classId: "class-1",
  className: "6A",
  workDate: "2026-09-15",
  periodStartAt: "2026-09-15T01:00:00.000Z",
  periodEndAt: "2026-09-15T02:00:00.000Z"
};

const first = call(`submitTeachingPeriod_(${JSON.stringify(teacherInput)}, 'payload-hash-1')`);
assert.equal(first.ok, true);
assert.equal(first.money, 210000, "A tier + remote + outdoor + manager");
assert.equal(first.mcpPoints, 5, "the configured far-school MCP is returned");
assert.equal(ss.getSheetByName("WorkLogs").getLastRow(), 2);
const createdWorkLogHeaders = ss.getSheetByName("WorkLogs").rows[0];
const createdWorkLog = ss.getSheetByName("WorkLogs").rows[1];
assert.ok(createdWorkLog[createdWorkLogHeaders.indexOf("LogID")], "legacy LogID is populated");
assert.equal(createdWorkLog[createdWorkLogHeaders.indexOf("CalculatedValue")], 1, "legacy quantity column is populated");
assert.equal(createdWorkLog[createdWorkLogHeaders.indexOf("TotalMoney")], 210000, "legacy payroll money column is populated");
assert.equal(createdWorkLog[createdWorkLogHeaders.indexOf("DateLog")], "2026-09-15", "legacy work-date column is populated");
assert.match(createdWorkLog[createdWorkLogHeaders.indexOf("InputData_JSON")], /schoolAllowance/, "calculation audit details are retained");
assert.equal(ss.getSheetByName("MettasoulMcpLedger").getLastRow(), 2, "MCP is written to the separate ledger");
const teacherLedger = call("getMettasoulMcpLedger_({ userEmail: 'teacher@example.com' })");
assert.equal(teacherLedger.entries.length, 1, "only the requested teacher's MCP entries are returned");
assert.equal(teacherLedger.entries[0].points, 5, "far-school MCP remains HRM-authoritative");
assert.equal(teacherLedger.entries[0].reasonCode, "TEACHING_FAR_SCHOOL");
assert.equal(teacherLedger.entries[0].schoolName, "Trường xa", "MCP ledger identifies the source school");

const retry = call(`submitTeachingPeriod_(${JSON.stringify({ ...teacherInput, eventId: "evt-retry" })}, 'payload-hash-2')`);
assert.equal(retry.ok, true);
assert.equal(retry.idempotent, true);
assert.equal(ss.getSheetByName("WorkLogs").getLastRow(), 2, "idempotent retry must not append a second WorkLog");

const assistantInput = {
  ...teacherInput,
  eventId: "evt-2",
  idempotencyKey: "schedule-1:lesson2:teacher@example.com:ASSISTANT",
  periodId: "lesson2",
  roleCode: "ASSISTANT"
};
const assistant = call(`submitTeachingPeriod_(${JSON.stringify(assistantInput)}, 'payload-hash-3')`);
assert.equal(assistant.money, 80000, "professional assistant receives no context or manager allowance");
assert.equal(ss.getSheetByName("WorkLogs").getLastRow(), 3);

const studentAssistantInput = {
  ...assistantInput,
  eventId: "evt-student",
  idempotencyKey: "schedule-1:lesson2:student@example.com:ASSISTANT",
  userEmail: "student@example.com"
};
const studentAssistant = call(`submitTeachingPeriod_(${JSON.stringify(studentAssistantInput)}, 'payload-hash-student')`);
assert.equal(studentAssistant.money, 30000, "student assistant receives the student rate only");
assert.equal(ss.getSheetByName("WorkLogs").getLastRow(), 4);

const melisSingle = call(`submitActivityCompletion_(${JSON.stringify({
  eventId: "activity-1", idempotencyKey: "activity-melis-single:teacher@example.com", activityId: "activity-melis-single",
  assignmentId: "assignment-1", userEmail: "teacher@example.com", activityTypeCode: "MELIS_SESSION_1_STUDENT",
  roleCode: "PARTICIPANT", unit: "SESSION", workDate: "2026-09-16", title: "Dạy MELIS 1 học viên", evidenceUrl: ""
})}, 'activity-hash-1')`);
assert.equal(melisSingle.money, 270000, "one-student MELIS session pays 270,000 VND");
assert.equal(melisSingle.mcpPoints, 0, "MELIS pay policy does not invent MCP");

const melisPair = call(`submitActivityCompletion_(${JSON.stringify({
  eventId: "activity-2", idempotencyKey: "activity-melis-pair:teacher@example.com", activityId: "activity-melis-pair",
  assignmentId: "assignment-2", userEmail: "teacher@example.com", activityTypeCode: "MELIS_SESSION_2_STUDENTS",
  roleCode: "PARTICIPANT", unit: "SESSION", workDate: "2026-09-16", title: "Dạy MELIS 2 học viên", evidenceUrl: ""
})}, 'activity-hash-2')`);
assert.equal(melisPair.money, 400000, "two-student MELIS session pays 400,000 VND");
assert.equal(melisPair.mcpPoints, 0, "MELIS pair policy does not invent MCP");

let missingContextCode = "";
try {
  call(`submitTeachingPeriod_(${JSON.stringify({ ...teacherInput, eventId: "evt-3", idempotencyKey: "missing-school", schoolId: "unmapped-school" })}, 'payload-hash-4')`);
} catch (error) {
  missingContextCode = error.code;
}
assert.equal(missingContextCode, "CONTEXT_RATE_MISSING", "missing school mapping must fail closed");
assert.equal(ss.getSheetByName("WorkLogs").getLastRow(), 6, "the failed teaching request does not add a seventh WorkLog");

const secret = "01234567890123456789012345678901";
const signedPayload = JSON.stringify({ source: "METTASOUL", action: "PING" });
const timestamp = 1_800_000_000;
const nonce = "nonce-1";
const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${nonce}.${signedPayload}`).digest("hex");
const verified = call(`verifyMettasoulEnvelope_(${JSON.stringify({ version: "1", timestamp, nonce, payload: signedPayload, signature })}, ${JSON.stringify(secret)}, ${timestamp * 1000})`);
assert.equal(verified.payloadText, signedPayload);

let invalidSignatureCode = "";
try {
  call(`verifyMettasoulEnvelope_(${JSON.stringify({ version: "1", timestamp, nonce, payload: signedPayload, signature: "00".repeat(32) })}, ${JSON.stringify(secret)}, ${timestamp * 1000})`);
} catch (error) {
  invalidSignatureCode = error.code;
}
assert.equal(invalidSignatureCode, "INVALID_SIGNATURE");

const cancel = call(`cancelTeachingPeriod_(${JSON.stringify({ eventId: "evt-cancel", targetIdempotencyKey: teacherInput.idempotencyKey })}, 'payload-hash-5')`);
assert.equal(cancel.code, "WORKLOG_CANCELLED");
assert.equal(call("getMettasoulMcpLedger_({ userEmail: 'teacher@example.com' })").entries.length, 0, "cancelled teaching leaves no active MCP in METTASOUL");
const workLogHeaders = ss.getSheetByName("WorkLogs").rows[0];
const statusIndex = 9; // Legacy HRM keeps Status in J but its header is blank.
assert.equal(ss.getSheetByName("WorkLogs").rows[1][statusIndex], "Deleted");

// Generic HRM batch configuration must be a patch operation.  In particular,
// applying only BHXH/tax must never erase METTASOUL task access, pay setup or
// existing fixed deductions.
const codeSource = fs.readFileSync(new URL("../src/Code.js", import.meta.url), "utf8");
vm.runInContext(codeSource, context, { filename: "Code.js" });
context.getDatabase = () => ss;
const teacherUserRow = ss.getSheetByName("Users").rows.find((row) => row[0] === "teacher@example.com");
teacherUserRow[5] = JSON.stringify({
  allowedTasks: ["TSK_KNS", "TSK_OLD"],
  salaryLevelId: "SALARY_EXISTING",
  deductions: { DED_A: "LEVEL_A" },
  insuranceType: "1"
});

const insuranceOnly = call("batchAssignUsers(['teacher@example.com'], { updateInsuranceType: true, insuranceType: '2' })");
assert.equal(insuranceOnly.success, true);
assert.deepEqual(JSON.parse(teacherUserRow[5]), {
  allowedTasks: ["TSK_KNS", "TSK_OLD"],
  salaryLevelId: "SALARY_EXISTING",
  deductions: { DED_A: "LEVEL_A" },
  insuranceType: "2"
}, "BHXH/tax-only batch edit preserves task, salary and deductions");
assert.equal(ss.getSheetByName("UserConfigAudit").getLastRow(), 2, "a configuration edit is recorded with a header and an audit row");
assert.equal(ss.getSheetByName("UserConfigAudit").rows[1][2], "chế độ BHXH & thuế", "audit identifies the changed group");

const tasksOnly = call("batchAssignUsers(['teacher@example.com'], { updateAllowedTasks: true, allowedTasks: ['TSK_KNS'] })");
assert.equal(tasksOnly.success, true);
assert.deepEqual(JSON.parse(teacherUserRow[5]), {
  allowedTasks: ["TSK_KNS"],
  salaryLevelId: "SALARY_EXISTING",
  deductions: { DED_A: "LEVEL_A" },
  insuranceType: "2"
}, "intentional task update preserves payroll configuration");

console.log("HRM METTASOUL integration tests passed.");
