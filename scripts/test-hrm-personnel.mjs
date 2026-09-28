import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/hrm-personnel.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function("exports", "module", compiled)(module.exports, module);
const { cooperationYearsFromPersonnelCode } = module.exports;

assert.equal(cooperationYearsFromPersonnelCode("26122022/CTV-MS", 2026), 4);
assert.equal(cooperationYearsFromPersonnelCode("19112025/CTVMT", 2026), 1);
assert.equal(cooperationYearsFromPersonnelCode("MNV-2026", 2026), 0);
assert.equal(cooperationYearsFromPersonnelCode("MNV-2027", 2026), undefined);
assert.equal(cooperationYearsFromPersonnelCode("CTV-MS", 2026), undefined);
console.log("HRM personnel code calculation tests passed.");
