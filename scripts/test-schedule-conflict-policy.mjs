import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/schedule-conflict-policy.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const policyModule = { exports: {} };
new Function("module", "exports", compiled)(policyModule, policyModule.exports);
const { hasTeacherTimeConflict } = policyModule.exports;

const sameSchoolOutdoor = [{ schoolId: "school-a", teachingEnvironment: "outdoor" }];
assert.equal(
  hasTeacherTimeConflict(sameSchoolOutdoor, { schoolId: "school-a", teachingEnvironment: "gym" }),
  false,
  "same-school outdoor activities may overlap",
);
assert.equal(
  hasTeacherTimeConflict(sameSchoolOutdoor, { schoolId: "school-a", teachingEnvironment: "in_class" }),
  true,
  "an in-class activity always conflicts",
);
assert.equal(
  hasTeacherTimeConflict(sameSchoolOutdoor, { schoolId: "school-b", teachingEnvironment: "hall" }),
  true,
  "different schools always conflict",
);
assert.equal(
  hasTeacherTimeConflict([{ schoolId: "school-a" }], { schoolId: "school-a", teachingEnvironment: "outdoor" }),
  true,
  "missing environment is treated as in-class",
);

console.log("Schedule conflict policy tests passed (4 cases).");
