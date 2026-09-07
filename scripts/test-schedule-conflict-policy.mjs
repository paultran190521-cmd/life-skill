import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/schedule-conflict-policy.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const policyModule = { exports: {} };
new Function("module", "exports", compiled)(policyModule, policyModule.exports);
const { canShareClassTimeSlot, hasTeacherTimeConflict } = policyModule.exports;

const participantSource = fs.readFileSync(new URL("../lib/scheduling-participants.ts", import.meta.url), "utf8");
const participantCompiled = ts.transpileModule(participantSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const participantModule = { exports: {} };
new Function("module", "exports", participantCompiled)(participantModule, participantModule.exports);
const { classifySchedulingParticipantIds } = participantModule.exports;

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

assert.equal(
  canShareClassTimeSlot(
    { groupId: "group-a", teachingEnvironment: "outdoor" },
    { groupId: "group-a", teachingEnvironment: "hall" },
  ),
  true,
  "co-teachers in the same non-classroom activity may repeat participant classes",
);
assert.equal(
  canShareClassTimeSlot(
    { groupId: "group-a", teachingEnvironment: "outdoor" },
    { groupId: "group-b", teachingEnvironment: "outdoor" },
  ),
  false,
  "separate activities do not share the same class booking",
);
assert.equal(
  canShareClassTimeSlot(
    { groupId: "group-a", teachingEnvironment: "in_class" },
    { groupId: "group-a", teachingEnvironment: "in_class" },
  ),
  false,
  "in-class assignments keep strict class conflict detection",
);

const ordinaryParticipants = classifySchedulingParticipantIds(
  ["teacher-1", "assistant-1", "teacher-without-user"],
  [
    { teacherId: "teacher-1", role: "teacher" },
    { teacherId: "assistant-1", role: "assistant" },
  ],
);
assert.deepEqual([...ordinaryParticipants.teacherIds], ["teacher-1", "teacher-without-user"]);
assert.deepEqual([...ordinaryParticipants.assistantIds], ["assistant-1"]);

const duplicateRoleParticipants = classifySchedulingParticipantIds(
  ["teacher-duplicate"],
  [
    { teacherId: "teacher-duplicate", role: "assistant" },
    { teacherId: "teacher-duplicate", role: "teacher" },
  ],
);
assert.deepEqual([...duplicateRoleParticipants.teacherIds], ["teacher-duplicate"]);
assert.deepEqual([...duplicateRoleParticipants.assistantIds], []);

console.log("Schedule conflict and participant policy tests passed (11 cases).");
