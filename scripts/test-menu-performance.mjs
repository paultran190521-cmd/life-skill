import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const source = read("components/mettasoul-app.tsx");
const tree = ts.createSourceFile("app.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const app = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "MettasoulApp");
const helpers = app.body.statements.filter((node) => ts.isFunctionDeclaration(node) && node.name?.text.startsWith("render"));
// A hook in a conditional helper, or mounting a newly created function as a
// component, would reintroduce lost input focus / hook-order failures.
for (const helper of helpers) {
  function check(node) {
    if (ts.isCallExpression(node)) assert.ok(!/^use[A-Z]/.test(node.expression.getText(tree)), `${helper.name.text} contains a hook`);
    ts.forEachChild(node, check);
  }
  check(helper);
}
const localFunctions = new Set(app.body.statements.filter(ts.isFunctionDeclaration).map((node) => node.name.text));
function checkTags(node) {
  if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
    assert.ok(!localFunctions.has(node.tagName.getText(tree)), "A local render function is mounted as a React component");
  }
  ts.forEachChild(node, checkTags);
}
checkTags(app);

function load(code, context = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, ...context });
  return exports;
}
const { indexById, groupByKey, attendanceLookupKey, legacyScheduleGroupKey } = load(read("lib/view-index.ts"));
const duplicates = [{ id: "a", value: 1 }, { id: "a", value: 2 }];
assert.equal(indexById(duplicates).get("a"), duplicates[0]);
assert.notEqual(attendanceLookupKey("a|b", "c"), attendanceLookupKey("a", "b|c"));

function functionText(text, name) {
  const file = ts.createSourceFile("app.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(file);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(found, `Missing ${name}`);
  return found;
}

// Read-only baseline; no requests, email, or production records are created.
const baseline = execFileSync("git", ["show", "641f693:components/mettasoul-app.tsx"], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
const count = 3000;
const teachers = Array.from({ length: 100 }, (_, i) => ({ id: `t${i}`, name: `Teacher ${i}` }));
const schools = Array.from({ length: 20 }, (_, i) => ({ id: `s${i}` }));
const classes = Array.from({ length: 300 }, (_, i) => ({ id: `c${i}` }));
const lessons = Array.from({ length: 180 }, (_, i) => ({ id: `l${i}` }));
const timeSlots = Array.from({ length: 60 }, (_, i) => ({ id: `slot${i}` }));
const schedules = Array.from({ length: count }, (_, i) => ({ id: `event${i}`, teacherId: `t${i % 100}`, schoolId: `s${i % 20}`, classId: `c${i % 300}`, lessonId: `l${i % 180}`, timeSlotId: `slot${i % 60}` }));
const lessonPlans = schedules.flatMap((schedule, i) => [0, 1].map((version) => ({ id: `plan${i}-${version}`, scheduleId: schedule.id, uploadedAt: `2026-09-${version + 10}` })));
const attendance = schedules.flatMap((schedule, i) => [{ id: `attendance${i}`, scheduleId: schedule.id, teacherId: schedule.teacherId }, { id: `assistant${i}`, scheduleId: schedule.id, teacherId: "assistant" }]);
const indexStart = performance.now();
const shared = { teachers, schools, classes, lessons, timeSlots, lessonPlans, attendance, attendanceLookupKey,
  teacherById: indexById(teachers), schoolById: indexById(schools), classById: indexById(classes), lessonById: indexById(lessons), slotById: indexById(timeSlots),
  plansBySchedule: groupByKey([...lessonPlans].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)), (row) => row.scheduleId),
  attendanceByParticipant: new Map(attendance.map((row) => [attendanceLookupKey(row.scheduleId, row.teacherId), row])),
};
const indexBuildMs = performance.now() - indexStart;
let oldLookup, newLookup;
for (const role of ["admin", "teacher", "assistant"]) {
  const context = { ...shared, role, currentTeacherId: role === "assistant" ? "assistant" : "t0" };
  oldLookup = load(`export ${functionText(baseline, "lookupSchedule")}`, context).lookupSchedule;
  newLookup = load(`export ${functionText(source, "lookupSchedule")}`, context).lookupSchedule;
  for (const schedule of [schedules[0], schedules[99], schedules[1700], { ...schedules[0], id: "missing", teacherId: "missing" }]) {
    assert.equal(JSON.stringify(newLookup(schedule)), JSON.stringify(oldLookup(schedule)), `Lookup semantics changed for ${role}`);
  }
}

const groupedRows = [
  { ...schedules[0], date: "2026-09-15", teachingEnvironment: "in_class", groupId: "g", status: "sent" },
  { ...schedules[0], id: "peer", teacherId: "t1", date: "2026-09-15", teachingEnvironment: "in_class", groupId: "g", status: "sent" },
  { ...schedules[0], id: "cancelled", teacherId: "t2", date: "2026-09-15", teachingEnvironment: "in_class", groupId: "g", status: "cancelled" },
];
const active = groupedRows.filter((row) => row.status !== "cancelled");
const context = { teachers, schedules: groupedRows, teacherById: indexById(teachers), legacyScheduleGroupKey,
  peerScheduleIndexes: { byGroup: groupByKey(active, (row) => row.groupId || ""), byLegacy: groupByKey(active, legacyScheduleGroupKey) } };
const oldPeers = load(`export ${functionText(baseline, "scheduleCoTeacherNames")}`, context).scheduleCoTeacherNames;
const newPeers = load(`export ${functionText(source, "scheduleCoTeacherNames")}`, context).scheduleCoTeacherNames;
for (const row of [...groupedRows, { ...groupedRows[0], groupId: undefined }]) {
  assert.equal(JSON.stringify(newPeers(row)), JSON.stringify(oldPeers(row)));
}

let formatterCount = 0;
class CountingFormatter extends Intl.DateTimeFormat { constructor(...args) { super(...args); formatterCount++; } }
const format = load(`export ${functionText(source, "safeFormatDate")}`, { invalidDateFallback: "—", dateFormatters: new Map(), Intl: { DateTimeFormat: CountingFormatter } }).safeFormatDate;
for (let i = 0; i < 1000; i++) assert.equal(format("2026-09-15", { day: "2-digit", month: "2-digit", year: "numeric" }), "15/09/2026");
assert.equal(format("invalid", {}), "—");
assert.equal(formatterCount, 1);

function measure(fn) {
  const samples = [];
  for (let run = 0; run < 5; run++) {
    const start = performance.now();
    for (const schedule of schedules) fn(schedule);
    samples.push(performance.now() - start);
  }
  return +samples.sort((a, b) => a - b)[2].toFixed(2);
}
console.log(JSON.stringify({ passed: true, hookFreeRenderHelpers: helpers.length, lookupRows: count,
  indexBuildMs: +indexBuildMs.toFixed(2), beforeMedianMs: measure(oldLookup), afterMedianMs: measure(newLookup),
  dateFormatterConstructionsFor1000Calls: formatterCount,
  note: "Local CPU benchmark, not browser navigation latency; indexes rebuild when source arrays change." }, null, 2));
