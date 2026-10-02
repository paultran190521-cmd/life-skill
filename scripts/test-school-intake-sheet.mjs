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
const context = vm.createContext({ MailApp: { sendEmail(message) { sent = message; } } });
vm.runInContext(gas, context);
vm.runInContext(`sendIntakeEmail_('reviewer@example.com', 'Duyệt lịch', {
  title: 'Chờ duyệt', badge: 'CẦN KIỂM TRA', intro: 'Lịch từ <người gửi>',
  account: 'reviewer@example.com', week: '2026-10-05', batchId: 'batch-1',
  summary: { schoolCount: 2, rowCount: 3, newCount: 1 }, note: '<xấu>',
  instruction: 'Kiểm tra rồi duyệt', action: 'Mở bảng lịch',
  url: 'https://docs.google.com/spreadsheets/d/example/edit'
});`, context);
assert.equal(sent.to, "reviewer@example.com");
assert.match(sent.body, /MỞ BẰNG TÀI KHOẢN GOOGLE: reviewer@example\.com/);
assert.match(sent.htmlBody, /TÀI KHOẢN ĐƯỢC CẤP QUYỀN/);
assert.match(sent.htmlBody, /Lịch từ &lt;người gửi&gt;/);
assert.match(sent.htmlBody, /&lt;xấu&gt;/);
assert.doesNotMatch(sent.htmlBody, /<xấu>/);
assert.match(sent.htmlBody, /#gid=0/);
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
console.log("School intake dropdown and email checks passed");
