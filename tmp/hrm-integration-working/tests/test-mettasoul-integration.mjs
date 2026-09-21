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

let missingContextCode = "";
try {
  call(`submitTeachingPeriod_(${JSON.stringify({ ...teacherInput, eventId: "evt-3", idempotencyKey: "missing-school", schoolId: "unmapped-school" })}, 'payload-hash-4')`);
} catch (error) {
  missingContextCode = error.code;
}
assert.equal(missingContextCode, "CONTEXT_RATE_MISSING", "missing school mapping must fail closed");
assert.equal(ss.getSheetByName("WorkLogs").getLastRow(), 4);

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

console.log("HRM METTASOUL integration tests passed.");
