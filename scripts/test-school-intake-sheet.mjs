import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/school-intake-storage.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(compiled, {
  exports,
  require(name) {
    if (name === "node:crypto") return { createHash() {} };
    if (name === "googleapis") return { google: {} };
    throw new Error(`Unexpected import: ${name}`);
  },
  process: { env: {} }, Map, Set,
});

const catalog = [
  ["", "", "", "Trường A", "Khối 12", "12A1", "", "", "Trường A", "Chiều", "Tiết 1", "", "", "", "", "", ""],
  ["", "", "", "Trường A", "Khối 12", "12A2", "", "", "Trường A", "Chiều", "Tiết 2", "", "", "", "", "", ""],
  ["", "", "", "Trường B", "Khối 10", "10A1", "", "", "Trường B", "Sáng", "Tiết 1", "", "", "", "", "", ""],
];
const input = [
  ["id-1", "05/10/2026", "Trường A", "Khối 12", "12A1", "Chiều", "Tiết 1", "13:00", "13:45", "Trong lớp", "Dạy", "", "", "", "", "", "Đã đồng bộ", "need-1", "", "batch-1"],
  ["id-2", "06/10/2026", "Trường B", "Khối 10", "10A1", "Sáng", "Tiết 1", "07:00", "07:45", "Trong lớp", "Dạy", "", "", "", "", "", "Đã đồng bộ", "need-2", "", "batch-2"],
];
const before = JSON.stringify(input);
const rules = exports.buildIntakeDropdownRows(catalog, input);
assert.equal(rules.length, 2);
assert.equal(rules[0].values[0].dataValidation.condition.values[0].userEnteredValue, "Khối 12");
assert.deepEqual(Array.from(rules[0].values[1].dataValidation.condition.values, (item) => item.userEnteredValue), ["12A1", "12A2"]);
assert.deepEqual(Array.from(rules[1].values[1].dataValidation.condition.values, (item) => item.userEnteredValue), ["10A1"]);
assert.equal(rules[1].values[2].dataValidation.condition.values[0].userEnteredValue, "Sáng");
assert.equal(JSON.stringify(input), before, "Rebuilding validation must not alter schedules or sync status");

const gas = fs.readFileSync(new URL("../integrations/school-intake-gas/Code.js", import.meta.url), "utf8");
let sent;
const context = vm.createContext({});
vm.runInContext(gas, context);
context.intakeApi_ = (method, data, path) => { sent = { method, data, path }; return { sent: true }; };
vm.runInContext(`sendIntakeEmail_('reviewer@example.com', 'Duyệt lịch', {
  title: 'Chờ duyệt', badge: 'CẦN KIỂM TRA', intro: 'Lịch từ <người gửi>', event: 'submitted',
  account: 'reviewer@example.com', week: '2026-10-05', batchId: 'batch-1',
  summary: { schoolCount: 2, rowCount: 3, newCount: 1 }, note: '<xấu>',
  instruction: 'Kiểm tra rồi duyệt', action: 'Mở bảng lịch',
  url: 'https://docs.google.com/spreadsheets/d/example/edit'
});`, context);
assert.deepEqual(JSON.parse(JSON.stringify(sent)), { method: "POST", data: { event: "submitted", batchId: "batch-1" }, path: "/api/school-intake/notify" });
let repairedRules;
const inputSheet = {
  getMaxRows: () => 8,
  getRange(row, column, height, width) {
    if (row === 6 && column === 3 && height === 3 && width === 5) return { getDisplayValues: () => [
      ["Trường A", "Khối 12", "12A1", "Chiều", "Tiết 1"],
      ["Trường B", "Khối 10", "10A1", "Sáng", "Tiết 1"],
      ["", "", "", "", ""],
    ] };
    if (row === 6 && column === 4 && height === 2 && width === 4) return { setDataValidations: (rules) => { repairedRules = rules; } };
    throw new Error(`Unexpected input range ${row},${column},${height},${width}`);
  },
};
const catalogSheet = {
  getLastRow: () => 4,
  getRange: () => ({ getDisplayValues: () => catalog.map((row) => row.slice(3, 11)) }),
};
class Validation {
  setAllowInvalid() { return this; }
  setHelpText() { return this; }
  requireValueInList(values) { this.values = values; return this; }
  requireFormulaSatisfied(formula) { this.formula = formula; return this; }
  build() { return { values: this.values, formula: this.formula }; }
}
context.SpreadsheetApp = { getActive: () => ({ getSheetByName: (name) => name === "Nhập lịch" ? inputSheet : catalogSheet }), newDataValidation: () => new Validation() };
assert.equal(vm.runInContext("repairIntakeDropdowns_()", context), 2);
assert.deepEqual(Array.from(repairedRules[0][1].values), ["12A1", "12A2"]);
assert.deepEqual(Array.from(repairedRules[1][1].values), ["10A1"]);

context.Date = Date;
context.Utilities = {
  formatDate(date, _timeZone, format) {
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return format === "yyyy-MM" ? `${yyyy}-${mm}` : `${yyyy}-${mm}-${dd}`;
  },
};
const weekOptions = vm.runInContext(`intakeWeekOptions_('Tất cả', [
  [new Date(2026, 9, 1)],
  [new Date(2026, 9, 5)],
  [new Date(2026, 9, 11)],
  [new Date(2026, 10, 2)],
  ['not-a-date']
])`, context);
assert.deepEqual(Array.from(weekOptions), ["Tất cả", "2026-09-28", "2026-10-05", "2026-11-02"], "Week options must normalize each schedule date to its Monday");
const octoberWeekOptions = vm.runInContext(`intakeWeekOptions_('2026-10', [
  [new Date(2026, 9, 1)],
  [new Date(2026, 9, 5)],
  [new Date(2026, 10, 2)]
])`, context);
assert.deepEqual(Array.from(octoberWeekOptions), ["Tất cả", "2026-09-28", "2026-10-05"], "Month filtering must retain the Monday that starts an October schedule week");
console.log("School intake dropdown and email checks passed");
