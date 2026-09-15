import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/schedule-participant-scope.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const runtimeModule = { exports: {} };
new Function("module", "exports", "require", compiled)(runtimeModule, runtimeModule.exports, () => ({}));
const { resolveScheduleParticipantSelection } = runtimeModule.exports;
const classes = [
  { id: "6A", grade: "Khối 6" },
  { id: "6B", grade: "Khối 6" },
  { id: "7A", grade: "Khối 7" },
];

assert.deepEqual(resolveScheduleParticipantSelection({
  teachingEnvironment: "outdoor", participantScope: "whole_grade", participantGrade: "Khối 6", requestedClassIds: ["6A"],
}, classes), { participantScope: "whole_grade", participantGrade: "Khối 6", classIds: ["6A", "6B"] });
assert.deepEqual(resolveScheduleParticipantSelection({
  teachingEnvironment: "hall", participantScope: "whole_school", requestedClassIds: ["6A"],
}, classes), { participantScope: "whole_school", participantGrade: "", classIds: ["6A", "6B", "7A"] });
assert.deepEqual(resolveScheduleParticipantSelection({
  teachingEnvironment: "in_class", participantScope: "whole_school", requestedClassIds: ["6B", "6A"],
}, classes), { participantScope: "selected_classes", participantGrade: "", classIds: ["6B"] });

console.log("Schedule participant scope tests passed for selected class, whole grade, and whole school.");
