const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let calls = 0;
const client = { spreadsheets: { values: { batchGet: async ({ ranges }) => {
  calls++;
  return { data: { valueRanges: ranges.map(range => ({ range, values: [['id'], [range]] })) } };
} } } };
const exportsObject = {};
const source = ts.transpileModule(fs.readFileSync('lib/google-sheets.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(source, { exports: exportsObject, require: name => name === 'googleapis' ? { google: { auth: { JWT: class {} }, sheets: () => client } } : {}, process: { env: { GOOGLE_SERVICE_ACCOUNT_EMAIL: 'test', GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----test', GOOGLE_SHEETS_SPREADSHEET_ID: 'test' } }, setTimeout, console });
(async () => {
  const [plans, messages, samePlans] = await Promise.all([exportsObject.readSheetRows('LessonPlans'), exportsObject.readSheetRows('LessonPlanMessages'), exportsObject.readSheetRows('LessonPlans')]);
  assert.equal(calls, 1, 'Concurrent reads must use a single quota request');
  assert.equal(plans[0].id, "'LessonPlans'");
  assert.equal(messages[0].id, "'LessonPlanMessages'");
  assert.deepEqual(plans, samePlans);
  await exportsObject.readSheetRows('LessonPlans');
  assert.equal(calls, 2, 'Subsequent reads must remain fresh');
  client.spreadsheets.values.batchGet = async () => { throw new Error('quota'); };
  const failures = await Promise.allSettled([exportsObject.readSheetRows('LessonPlans'), exportsObject.readSheetRows('Users')]);
  assert.ok(failures.every(result => result.status === 'rejected'), 'Reject all waiters without hanging');
  console.log('Sheet batching: coalescing, isolation, freshness and failure propagation passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
