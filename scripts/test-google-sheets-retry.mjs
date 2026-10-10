import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/google-sheets.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
vm.runInNewContext(compiled, {
  exports,
  require(name) {
    if (name === "googleapis") return { google: {} };
    if (name === "@/lib/app-error") return { externalServiceError: (message) => new Error(message) };
    if (name === "@/lib/worklog-rows") return { uniqueWorkLogRows: () => [] };
    if (name === "@/lib/avatar") return { getAvatarUrl: () => "" };
    throw new Error(`Unexpected import: ${name}`);
  },
  process: { env: {} }, Map, Set, Date, Array, String, Number, Object, Promise, setTimeout,
});

assert.equal(exports.isRetryableGoogleSheetsReadError({ response: { status: 500 } }), true);
assert.equal(exports.isRetryableGoogleSheetsReadError({ status: 503 }), true);
assert.equal(exports.isRetryableGoogleSheetsReadError({ code: 429 }), true);
assert.equal(exports.isRetryableGoogleSheetsReadError({ response: { status: 403 } }), false);
assert.equal(exports.isRetryableGoogleSheetsReadError(new Error("network unavailable")), false);
assert.match(source, /withGoogleSheetsReadRetry\(\(\) => client\.spreadsheets\.get/);
assert.match(source, /withGoogleSheetsReadRetry\(\(\) => getSheetsClient\(\)\.spreadsheets\.values\.batchGet/);

console.log("Google Sheets transient-read retry checks passed.");
