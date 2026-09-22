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

const { cancelActivityCompletionInHrm, cancelTeachingPeriodInHrm, hrmIntegrationConfigured, hrmIntegrationCredentialsConfigured, pingHrmIntegration, provisionMettasoulTeacherInHrm, submitTeachingPeriodToHrm } = runtimeModule.exports;
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
  assert.equal(captured.init.redirect, "manual");
  assert.equal(captured.init.headers.Accept, "application/json");
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

  await cancelActivityCompletionInHrm({
    source: "METTASOUL",
    action: "CANCEL_ACTIVITY_COMPLETION",
    eventId: "activity-cancel-1",
    idempotencyKey: "CANCEL:METTASOUL:ACTIVITY:activity-1:assignment-1",
    targetIdempotencyKey: "METTASOUL:ACTIVITY:activity-1:assignment-1",
  });
  assert.equal(JSON.parse(captured.envelope.payload).action, "CANCEL_ACTIVITY_COMPLETION");

  await provisionMettasoulTeacherInHrm({
    source: "METTASOUL", action: "PROVISION_WORKER", eventId: "identity-1", idempotencyKey: "PROVISION:u-1",
    userId: "u-1", teacherId: "t-1", name: "Giáo viên thử", userEmail: "teacher@example.com", role: "teacher",
  });
  const identityPayload = JSON.parse(captured.envelope.payload);
  assert.equal(identityPayload.action, "PROVISION_WORKER");
  assert.equal(identityPayload.userEmail, "teacher@example.com");

  const health = await pingHrmIntegration();
  assert.equal(JSON.parse(captured.envelope.payload).action, "PING");
  assert.equal(health.code, "READY");

  globalThis.fetch = async () => new Response("<html>HRM proxy response</html>", {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
  await assert.rejects(
    () => pingHrmIntegration(),
    (error) => error.code === "HRM_INVALID_RESPONSE"
      && error.diagnostic.status === 200
      && error.diagnostic.contentType === "text/html"
      && error.diagnostic.redirected === false,
  );

  const redirectCalls = [];
  globalThis.fetch = async (url, init) => {
    redirectCalls.push({ url: String(url), init });
    if (redirectCalls.length === 1) {
      return new Response(null, {
        status: 302,
        headers: { Location: "https://script.googleusercontent.com/macros/echo?result=1" },
      });
    }
    return new Response(JSON.stringify({ ok: true, code: "READY", schemaVersion: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  process.env.HRM_METTASOUL_WEBHOOK_URL = "https://script.google.com/macros/s/test/exec";
  const redirectedHealth = await pingHrmIntegration();
  assert.equal(redirectedHealth.code, "READY");
  assert.equal(redirectCalls.length, 2);
  assert.equal(redirectCalls[0].init.method, "POST");
  assert.equal(redirectCalls[0].init.redirect, "manual");
  assert.equal(redirectCalls[1].init.method, "GET");
  assert.equal(redirectCalls[1].init.redirect, "error");

  globalThis.fetch = async () => new Response(null, {
    status: 302,
    headers: { Location: "https://example.com/untrusted" },
  });
  await assert.rejects(
    () => pingHrmIntegration(),
    (error) => error.code === "HRM_UNREACHABLE"
      && error.diagnostic.errorMessage === "HRM_REDIRECT_REJECTED",
  );

  let retryCount = 0;
  globalThis.fetch = async () => {
    retryCount += 1;
    if (retryCount === 1) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } });
    return new Response(JSON.stringify({ ok: true, code: "READY", schemaVersion: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const retriedHealth = await pingHrmIntegration();
  assert.equal(retriedHealth.code, "READY");
  assert.equal(retryCount, 2);

  globalThis.fetch = async () => {
    throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENETUNREACH" } });
  };
  await assert.rejects(
    () => pingHrmIntegration(),
    (error) => error.code === "HRM_UNREACHABLE"
      && error.diagnostic.errorName === "TypeError"
      && error.diagnostic.errorMessage === "fetch failed"
      && error.diagnostic.causeCode === "ENETUNREACH",
  );
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
