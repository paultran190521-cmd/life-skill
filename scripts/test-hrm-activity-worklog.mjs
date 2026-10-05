import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const headers = ["LogID", "UserEmail", "TaskID", "TaskName", "InputData_JSON", "CalculatedValue", "TotalMoney", "Timestamp", "DateLog", "", "Source", "ExternalEventId", "ScheduleId", "PeriodId", "RoleCode", "PolicyVersion", "RateProfileId", "CalculationJson", "ExternalStatus", "UpdatedAt"];
const values = [headers];
const sheet = {
  getLastColumn: () => headers.length,
  getLastRow: () => values.length,
  getDataRange: () => ({ getValues: () => values.map((row) => [...row]) }),
  getRange(row, column, count, width) {
    assert.equal(count, 1);
    return {
      getValues: () => [values[row - 1].slice(column - 1, column - 1 + width)],
      setValues: (rows) => { values[row - 1] = [...rows[0]]; },
    };
  },
  appendRow(row) { values.push([...row]); },
};
const context = vm.createContext({ getDatabase_: () => ({ getSheetByName: () => sheet }) });
vm.runInContext(fs.readFileSync(new URL("../outputs/hrm-unified-attendance-20261002/src/MettasoulIntegration.js", import.meta.url), "utf8"), context);
const input = { eventId: "event-1", idempotencyKey: "key-1", activityId: "activity-1", assignmentId: "assignment-1", activityTypeCode: "INTERNAL_SHARING", activityTitle: "Chia sẻ chuyên môn", userEmail: "teacher@example.com", roleCode: "LEAD", unit: "BUOI", workDate: "2026-10-03", evidenceUrl: "" };
const task = { id: "task-1", name: "Giảng dạy METTASOUL theo tiết" };
const policy = { Code: "INTERNAL_SHARING_LEAD", Version: 1, ID: "policy-1" };
const append = (id = "log-1") => context.appendIntegratedActivityWorkLog_({ getSheetByName: () => sheet }, id, task, input, policy, 500000);
assert.equal(append(), "log-1");
assert.equal(values.length, 2);
assert.equal(values[1][0], "log-1");
assert.equal(values[1][2], "task-1");
assert.equal(values[1][5], 1);
assert.equal(values[1][6], 500000);
assert.equal(values[1][8], "2026-10-03");
assert.equal(values[1][9], "Active");
assert.equal(values[1][11], "event-1");
assert.equal(append("log-2"), "log-1");
assert.equal(values.length, 2, "a retry must reuse the same row");
values[1][6] = "";
assert.equal(append("log-2"), "log-1");
assert.equal(values[1][6], 500000, "a partial row must be repaired on retry");
values[1][6] = 999;
assert.throws(() => append(), /Số tiền dòng công cũ/);
console.log("Activity WorkLogs mapping, readback, retry, and mismatch tests passed.");