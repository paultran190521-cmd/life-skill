import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadTs(path, dependencies = {}) {
  const exports = {};
  const source = fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error(`Unexpected import: ${name}`);
    },
    Date, Map, Set, URL, console,
  }, { filename: path });
  return exports;
}

const policy = loadTs("lib/lesson-plan-reuse.ts");
const source = {
  id: "first", teacherId: "teacher-1", lessonId: "lesson-1", lessonPeriods: "lesson1,lesson2",
  date: "2026-10-01", sentAt: "2026-09-25T02:00:00.000Z", status: "sent",
};
const target = {
  id: "later", teacherId: "teacher-1", lessonId: "lesson-1", lessonPeriods: "lesson2,lesson1",
  date: "2026-10-08", sentAt: "2026-10-03T02:00:00.000Z", status: "sent",
};
const plan = {
  id: "plan-1", scheduleId: source.id, teacherId: source.teacherId,
  uploadedAt: "2026-09-30T02:00:00.000Z", driveUrl: "https://drive.google.com/file/plan-1", fileName: "Lesson.pdf",
};
assert.equal(policy.canReuseLessonPlan(target, source, plan), true);
assert.equal(policy.findReusableLessonPlan(target, [source, target], [plan])?.id, plan.id);
assert.equal(policy.canReuseLessonPlan({ ...target, lessonPeriods: "lesson1" }, source, plan), false);
assert.equal(policy.canReuseLessonPlan({ ...target, lessonId: "another" }, source, plan), false);
assert.equal(policy.canReuseLessonPlan({ ...target, teacherId: "another" }, source, plan), false);
assert.equal(policy.canReuseLessonPlan({ ...target, sentAt: "2026-09-29T02:00:00.000Z" }, source, plan), false);
assert.equal(policy.canReuseLessonPlan({ ...target, date: "2026-09-20" }, source, plan), false);
assert.equal(policy.confirmedReusedLessonPlan(target, [source, target], [plan]), undefined);
assert.equal(policy.confirmedReusedLessonPlan({ ...target, reusedLessonPlanId: plan.id }, [source, target], [plan])?.id, plan.id);
assert.equal(policy.confirmedReusedLessonPlan({ ...target, reusedLessonPlanId: plan.id }, [target], [plan]), undefined);
assert.equal(policy.confirmedReusedLessonPlan({ ...target, reusedLessonPlanId: plan.id }, [source, target], []), undefined);

const rows = { Schedules: [source, target], LessonPlans: [plan] };
let user = { role: "teacher", teacherId: "teacher-1" };
let updates = 0;
const route = loadTs("app/api/lesson-plans/reuse/route.ts", {
  "next/server": { NextResponse: { json: (body) => ({ status: 200, body }) } },
  "@/lib/api": {
    apiError: (error) => { throw error; },
    apiFailure: (status, error) => ({ status, error }),
    createRequestId: () => "test-request",
  },
  "@/lib/audit": { appendAuditLog: async () => {} },
  "@/lib/google-sheets": {
    ensureSheetHeaders: async () => {}, scheduleHeaders: [], toSchedules: (items) => items,
    readSheetRowsBatch: async () => rows,
    updateSheetRowById: async (_sheet, id, patch) => {
      updates += 1;
      Object.assign(rows.Schedules.find((item) => item.id === id), patch);
    },
  },
  "@/lib/lesson-plan-reuse": policy,
  "@/lib/route-auth": {
    requireSessionUser: async () => ({ user, source: "session" }),
    evaluatePermission: ({ allowed, reason }) => ({ allowed, reason, authMode: "enforce", decision: allowed ? "allow" : "deny" }),
  },
});
const request = (scheduleId, sourcePlanId) => ({ json: async () => ({ scheduleId, sourcePlanId }) });
user = { role: "teacher", teacherId: "other" };
assert.equal((await route.POST(request(target.id, plan.id))).status, 403);
user = { role: "teacher", teacherId: "teacher-1" };
assert.equal((await route.POST(request(target.id, "missing"))).status, 409);
assert.equal((await route.POST(request(target.id, plan.id))).status, 200);
assert.equal(rows.Schedules[1].reusedLessonPlanId, plan.id);
assert.equal(updates, 1);
assert.equal((await route.POST(request(target.id, plan.id))).status, 200);
assert.equal(updates, 1);
const app = fs.readFileSync(new URL("../components/mettasoul-app.tsx", import.meta.url), "utf8");
assert.equal((app.match(/id: "plans", label: "Kế hoạch GD"/g) || []).length, 3);
assert.match(app, /coveredPlanScheduleIds/);
console.log("Lesson-plan reuse matching, permissions, persistence and invalidation tests passed.");
