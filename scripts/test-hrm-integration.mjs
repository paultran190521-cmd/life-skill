import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/hrm-integration.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const runtimeModule = { exports: {} };
new Function("module", "exports", "require", "process", compiled)(
  runtimeModule,
  runtimeModule.exports,
  (specifier) => {
    if (specifier === "node:crypto") return { createHmac, randomUUID };
    throw new Error(`Unexpected test import: ${specifier}`);
  },
  process,
);

const { cancelTeachingPeriodInHrm, hrmIntegrationConfigured, hrmIntegrationCredentialsConfigured, pingHrmIntegration, submitTeachingPeriodToHrm } = runtimeModule.exports;
const previousUrl = process.env.HRM_METTASOUL_WEBHOOK_URL;
const previousSecret = process.env.HRM_METTASOUL_WEBHOOK_SECRET;
const previousEnabled = process.env.HRM_METTASOUL_INTEGRATION_ENABLED;
const previousFetch = globalThis.fetch;

try {
  delete process.env.HRM_METTASOUL_WEBHOOK_URL;
  delete process.env.HRM_METTASOUL_WEBHOOK_SECRET;
  delete process.env.HRM_METTASOUL_INTEGRATION_ENABLED;
  assert.equal(hrmIntegrationConfigured(), false);
  await assert.rejects(
    () => submitTeachingPeriodToHrm({ source: "METTASOUL" }),
    (error) => error.code === "HRM_INTEGRATION_DISABLED",
  );

  process.env.HRM_METTASOUL_WEBHOOK_URL = "https://hrm.example.test/webhook";
  process.env.HRM_METTASOUL_WEBHOOK_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.HRM_METTASOUL_INTEGRATION_ENABLED = "false";
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init, envelope: JSON.parse(init.body) };
    const payload = JSON.parse(captured.envelope.payload);
    return new Response(JSON.stringify({
      ok: true,
      ...(payload.action === "PING"
        ? { code: "READY", schemaVersion: 1 }
        : { workLogId: "LOG_MTS_1", money: 80000, policyVersion: "profile:1" }),
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  assert.equal(hrmIntegrationCredentialsConfigured(), true);
  assert.equal(hrmIntegrationConfigured(), false);
  const healthWhileWritesDisabled = await pingHrmIntegration();
  assert.equal(healthWhileWritesDisabled.code, "READY");
  await assert.rejects(
    () => submitTeachingPeriodToHrm({ source: "METTASOUL" }),
    (error) => error.code === "HRM_INTEGRATION_DISABLED",
  );

  process.env.HRM_METTASOUL_INTEGRATION_ENABLED = "true";

  const payload = {
    source: "METTASOUL",
    action: "SUBMIT_TEACHING_PERIOD",
    eventId: "event-1",
    idempotencyKey: "key-1",
  };
  const result = await submitTeachingPeriodToHrm(payload);
  assert.equal(hrmIntegrationConfigured(), true);
  assert.equal(result.workLogId, "LOG_MTS_1");
  assert.equal(captured.url, process.env.HRM_METTASOUL_WEBHOOK_URL);
  assert.equal(captured.envelope.version, "1");
  assert.equal(captured.envelope.payload, JSON.stringify(payload));
  const expectedSignature = createHmac("sha256", process.env.HRM_METTASOUL_WEBHOOK_SECRET)
    .update(`${captured.envelope.timestamp}.${captured.envelope.nonce}.${captured.envelope.payload}`)
    .digest("hex");
  assert.equal(captured.envelope.signature, expectedSignature);

  await cancelTeachingPeriodInHrm({
    source: "METTASOUL",
    action: "CANCEL_TEACHING_PERIOD",
    eventId: "cancel-1",
    idempotencyKey: "CANCEL:key-1",
    targetIdempotencyKey: "key-1",
  });
  assert.equal(JSON.parse(captured.envelope.payload).action, "CANCEL_TEACHING_PERIOD");

  const health = await pingHrmIntegration();
  assert.equal(JSON.parse(captured.envelope.payload).action, "PING");
  assert.equal(health.code, "READY");
} finally {
  globalThis.fetch = previousFetch;
  if (previousUrl === undefined) delete process.env.HRM_METTASOUL_WEBHOOK_URL;
  else process.env.HRM_METTASOUL_WEBHOOK_URL = previousUrl;
  if (previousSecret === undefined) delete process.env.HRM_METTASOUL_WEBHOOK_SECRET;
  else process.env.HRM_METTASOUL_WEBHOOK_SECRET = previousSecret;
  if (previousEnabled === undefined) delete process.env.HRM_METTASOUL_INTEGRATION_ENABLED;
  else process.env.HRM_METTASOUL_INTEGRATION_ENABLED = previousEnabled;
}

console.log("HRM integration tests passed for disabled state and HMAC envelope signing.");
