import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/school-intake-bidirectional.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(compiled, {
  exports,
  require(name) {
    if (name === "node:crypto") return { createHash: () => ({ update() { return this; }, digest() { return "abcdef1234567890"; } }) };
    if (name === "googleapis") return { google: {} };
    if (name === "@/lib/school-intake-storage") return {};
    throw new Error(`Unexpected import: ${name}`);
  },
  process: { env: {} }, Date, Array, String, JSON,
});

const schools = [{ id: "school-1", name: "Trường A" }];
const classes = [{ id: "class-1", schoolId: "school-1", name: "10A1", grade: "Khối 10" }];
const need = { id: "need-1", date: "2026-10-05", schoolId: "school-1", classId: "class-1", periodLabel: "Tiết 1", start: "07:00", end: "07:45", teachingEnvironment: "in_class", status: "OPEN", sourceNote: "" };
const fields = exports.needFields(need, schools, classes);
assert.deepEqual(Array.from(fields), ["05/10/2026", "Trường A", "Khối 10", "10A1", "Sáng", "Tiết 1", "07:00", "07:45", "Trong lớp", "Dạy", ""]);
const effective = ["intake-1", ...fields, need.id, "batch-1", "2026-10-02T00:00:00Z"];
const input = ["intake-1", ...fields, "", "", "SAME", "", "Đã đồng bộ", need.id, "", "batch-1"];
assert.equal(exports.isIntakeRowDirty(input, effective), false);
assert.equal(exports.appNeedDiffersFromEffective(need, effective, schools, classes), false);
assert.equal(exports.isIntakeRowDirty(input.map((value, index) => index === 4 ? "10A2" : value), effective), true);
assert.equal(exports.isIntakeRowDirty(input.map((value, index) => index === 16 ? "Đã sửa · cần gửi lại" : value), effective), true);
assert.equal(exports.appNeedDiffersFromEffective({ ...need, start: "07:05" }, effective, schools, classes), true);
assert.equal(exports.needFields({ ...need, status: "CANCELLED" }, schools, classes)[9], "Trường hủy tiết");

const writes = [], appends = [], formatting = [];
const linked = {
  rowId: "intake-1", inputNumber: 6, effectiveNumber: 2,
  input, effective,
};
const ioExports = {};
vm.runInNewContext(compiled, {
  exports: ioExports,
  require(name) {
    if (name === "node:crypto") return { createHash: () => ({ update() { return this; }, digest() { return "abcdef1234567890"; } }) };
    if (name === "googleapis") return { google: {
      auth: { JWT: class {} },
      sheets: () => ({ spreadsheets: {
        get: async () => ({ data: { sheets: [{ properties: { sheetId: 0, title: "Nhập lịch" } }] } }),
        batchUpdate: async (request) => { formatting.push(request); },
      } }),
    } };
    if (name === "@/lib/school-intake-storage") return {
      readIntakeWeekLocks: async () => new Map(), weekStartOf: () => "2026-10-05",
      readIntakeTab: async (tab) => tab === "Danh mục" ? [["header"], ["", "", "", "Trường A", "Khối 10", "10A1", "", "", "Trường A", "Sáng", "Tiết 1"]] : [["header"]],
      writeIntakeRanges: async (ranges) => { writes.push(...ranges); },
      appendIntakeRows: async (...args) => { appends.push(args); },
      buildIntakeDropdownRows: () => [{ values: Array.from({ length: 4 }, () => ({ dataValidation: {} })) }],
      schoolIntakeSpreadsheetId: "test-sheet", intakeInputFirstDataRow: 6, intakeInputLastRow: 1004,
    };
    throw new Error(`Unexpected import: ${name}`);
  },
  process: { env: {} }, Date, Array, String, JSON,
});
await ioExports.mirrorAppNeedToIntake({ ...need, start: "07:05", updatedAt: "2026-10-02T00:00:00Z" }, need, "Admin", schools, classes, linked);
assert.equal(writes.length, 3);
assert.equal(writes[0].range, "'Nhập lịch'!A6:L6");
assert.equal(writes[0].values[0].length, 12);
assert.equal(writes[0].values[0][7], 425 / 1440);
assert.equal(writes[2].range, "'Lịch hiệu lực'!A2:O2");
assert.equal(formatting.length, 1);
assert.equal(appends[0][0], "Lịch sử");
await assert.rejects(() => ioExports.mirrorAppNeedToIntake(need, need, "Admin", schools, classes, { ...linked, input: input.map((value, index) => index === 16 ? "Đã sửa · cần gửi lại" : value) }), /đang chờ duyệt/);
console.log("School intake two-way conflict checks passed.");
