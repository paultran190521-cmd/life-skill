import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../outputs/hrm-unified-attendance-20261002/src/MettasoulIntegration.js", import.meta.url), "utf8");
const context = vm.createContext({ Date, JSON, String, Array, Utilities: { getUuid: () => "test-uuid" } });
vm.runInContext(source, context);
const headers = Array.from({ length: 16 }, (_, i) => `Column${i}`);
const now = new Date("2026-10-05T00:00:00Z");
const rowFor = (identity) => vm.runInContext(
  `buildMettasoulWorkerRow_(${JSON.stringify(headers)},${JSON.stringify(identity)},new Date(${JSON.stringify(now.toISOString())}),"TASK-1")`,
  context,
);
assert.equal(rowFor({ userEmail: " New.Teacher@Example.COM ", name: "New Teacher", teacherId: "t-1", role: "teacher" })[0], "new.teacher@example.com");
assert.equal(rowFor({ email: "import@example.com", name: "Imported", teacherId: "t-2", role: "teacher" })[0], "import@example.com");
assert.equal(rowFor({ userEmail: "webhook@example.com", email: "stale@example.com", name: "Teacher", teacherId: "t-3", role: "teacher" })[0], "webhook@example.com");
console.log("HRM provisioning email mapping verified for webhook and import.");
