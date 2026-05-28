import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const workspaceRoot = process.cwd();

const rules = [
  {
    file: "app/api/announcements/route.ts",
    checks: ['requireSessionUser(request)', 'evaluateRolePermission(auth.user, "admin"'],
  },
  {
    file: "app/api/announcements/[id]/route.ts",
    checks: ['requireSessionUser(request)', 'evaluateRolePermission(auth.user, "admin"'],
  },
  {
    file: "app/api/schools/route.ts",
    checks: ['requireSessionUser(request)', 'evaluateRolePermission(auth.user, "admin"'],
  },
  {
    file: "app/api/schools/[id]/route.ts",
    checks: ['requireSessionUser(request)', 'evaluateRolePermission(auth.user, "admin"'],
  },
  {
    file: "app/api/classes/route.ts",
    checks: ['requireSessionUser(request)', 'evaluateRolePermission(auth.user, "admin"'],
  },
  {
    file: "app/api/classes/[id]/route.ts",
    checks: ['requireSessionUser(request)', 'evaluateRolePermission(auth.user, "admin"'],
  },
  {
    file: "app/api/lessons/route.ts",
    checks: ['requireSessionUser(request)', 'evaluateRolePermission(auth.user, "admin"'],
  },
  {
    file: "app/api/lessons/[id]/route.ts",
    checks: ['requireSessionUser(request)', 'evaluateRolePermission(auth.user, "admin"'],
  },
  {
    file: "app/api/time-slots/route.ts",
    checks: ['requireSessionUser(request)', 'evaluateRolePermission(auth.user, "admin"'],
  },
  {
    file: "app/api/time-slots/[id]/route.ts",
    checks: ['requireSessionUser(request)', 'evaluateRolePermission(auth.user, "admin"'],
  },
  {
    file: "app/api/teachers/route.ts",
    checks: ['requireSessionUser(request)', 'evaluateRolePermission(auth.user, "admin"'],
  },
  {
    file: "app/api/teachers/[id]/route.ts",
    checks: ['requireSessionUser(request)', 'evaluateRolePermission(auth.user, "admin"'],
  },
  {
    file: "app/api/users/route.ts",
    checks: ['requireSessionUser(request)', 'evaluateRolePermission(auth.user, "admin"'],
  },
  {
    file: "app/api/users/[id]/route.ts",
    checks: ['requireSessionUser(request)', 'evaluateRolePermission(auth.user, "admin"'],
  },
  {
    file: "app/api/schedules/route.ts",
    checks: ['requireSessionUser(request)', 'evaluateRolePermission(auth.user, "admin"', "detectScheduleConflicts("],
  },
  {
    file: "app/api/schedules/[id]/route.ts",
    checks: ['requireSessionUser(request)', "evaluatePermission({", "forbidden_schedule_operation"],
  },
  {
    file: "app/api/attendance/route.ts",
    checks: ['requireSessionUser(request)', "evaluatePermission({", "teacher_must_own_schedule_attendance"],
  },
  {
    file: "app/api/lesson-plans/route.ts",
    checks: ['requireSessionUser(request)', "evaluatePermission({", "teacher_must_own_schedule_lesson_plan"],
  },
  {
    file: "app/api/lesson-plans/[id]/route.ts",
    checks: ['requireSessionUser(request)', "evaluatePermission({", "teacher_must_own_lesson_plan"],
  },
  {
    file: "app/api/notifications/route.ts",
    checks: ['requireSessionUser(request)', "evaluatePermission({", "teacher_feedback_only"],
  },
  {
    file: "app/api/app-data/route.ts",
    checks: ['requireSessionUser(request, { allowHeaderFallback: false })'],
  },
  {
    file: "app/api/admin/health/route.ts",
    checks: ['requireSessionUser(request)', 'evaluateRolePermission(auth.user, "admin"'],
  },
  {
    file: "app/api/admin/observability/route.ts",
    checks: ['requireSessionUser(request)', 'evaluateRolePermission(auth.user, "admin"'],
  },
];

const negativeRules = [
  {
    file: "app/api/schedules/[id]/confirm/route.ts",
    checks: ["verifyScheduleConfirmationToken("],
    notChecks: ["requireSessionUser("],
  },
  {
    file: "app/api/schedules/confirm-all/route.ts",
    checks: ["verifyScheduleConfirmationBatchToken("],
    notChecks: ["requireSessionUser("],
  },
];

async function main() {
  const failures = [];

  for (const rule of rules) {
    const source = await readRoute(rule.file);
    for (const check of rule.checks) {
      if (!source.includes(check)) {
        failures.push(`[missing] ${rule.file} -> ${check}`);
      }
    }
  }

  for (const rule of negativeRules) {
    const source = await readRoute(rule.file);
    for (const check of rule.checks) {
      if (!source.includes(check)) {
        failures.push(`[missing] ${rule.file} -> ${check}`);
      }
    }
    for (const notCheck of rule.notChecks) {
      if (source.includes(notCheck)) {
        failures.push(`[unexpected] ${rule.file} -> ${notCheck}`);
      }
    }
  }

  const modeSource = await readRoute("lib/route-auth.ts");
  if (!modeSource.includes('process.env.AUTH_ENFORCEMENT_MODE === "shadow" ? "shadow" : "enforce"')) {
    failures.push("[missing] lib/route-auth.ts -> enforce default expression");
  }

  if (failures.length > 0) {
    console.error("Authz regression test failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`Authz regression test passed (${rules.length + negativeRules.length} route rules checked).`);
}

async function readRoute(relativePath) {
  const absolutePath = resolve(workspaceRoot, relativePath);
  return readFile(absolutePath, "utf8");
}

main().catch((error) => {
  console.error("Authz regression test crashed:", error);
  process.exit(1);
});
