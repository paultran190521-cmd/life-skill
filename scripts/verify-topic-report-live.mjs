// Read-only: checks the deployed contract and existing policies; never submits payroll.
import fs from "node:fs";
import ts from "typescript";
import { createHmac, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const url = new URL(process.env.HRM_METTASOUL_WEBHOOK_URL || "https://invalid.example");
assert.equal(url.hostname, "script.google.com");
assert.ok(url.pathname.includes("AKfycbxikAeDzABlDeBTfDHyWmwauEIIM1AG6ut8C3v5tUBm88diqIXlD_eOINF-sbSwmLmUKQ"));
const module = { exports: {} };
const source = fs.readFileSync(new URL("../lib/hrm-integration.ts", import.meta.url), "utf8");
new Function("module", "exports", "require", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(module, module.exports, (name) => {
  if (name === "node:crypto") return { createHmac, randomUUID };
  throw new Error(name);
});
const started = Date.now();
const ping = await module.exports.pingHrmIntegration();
assert.ok(ping.policyContracts?.includes("TOPIC_REPORT_V1"));
assert.equal(ping.cancellationReports, true);
const data = await module.exports.getTopicReportPoliciesFromHrm();
const expected = { STUDENT_TOPIC_REPORT_SUPPORT: [1000000, 100], STUDENT_TOPIC_REPORT_LEAD: [1500000, 100], PARTNER_FREE_TOPIC: [2500000, 100], DEMO_SESSION: [0, 20] };
for (const [code, [cash, mcp]] of Object.entries(expected)) {
  const policy = data.policies.find((p) => p.ActivityTypeCode === code && p.Status === "Active");
  assert.ok(policy, `Missing ${code}`);
  assert.equal(Number(policy.CashAmount), cash);
  assert.equal(Number(policy.McpPoints), mcp);
}
for (const [code, cash] of [["ASSISTANT_PRO", 80000], ["ASSISTANT_STUDENT", 30000]]) assert.equal(Number(data.assistants.find((p) => p.Code === code && p.Status === "Active")?.BaseRate), cash);
console.log(JSON.stringify({ ok: true, contract: "TOPIC_REPORT_V1", policyCount: 4, assistantProfiles: 2, durationMs: Date.now() - started, mode: "READ_ONLY_NO_PAYROLL" }));
