import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const integration = readFileSync(new URL("../outputs/hrm-unified-attendance-20261002/src/MettasoulIntegration.js", import.meta.url), "utf8");
const adjustment = readFileSync(new URL("../outputs/hrm-unified-attendance-20261002/src/AttendanceAdjust.js", import.meta.url), "utf8");
const start = integration.indexOf("function assertTeachingCheckInWindow_(input) {");
const end = integration.indexOf("function assertHrmUserExists_(ss, email)", start);
assert.ok(start >= 0 && end > start, "Live HRM source exposes the check-in window validator");
const context = vm.createContext({
  Date, Number, String, Object, JSON, isNaN, isFinite,
  Utilities: { formatDate: (value) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } },
  integrationError_: (code, message) => Object.assign(new Error(message), { code }),
});
vm.runInContext(integration.slice(start, end), context);
const workDate = "2026-10-02";
const sessionStart = "2026-10-02T06:00:00+07:00";
const valid = { workDate, sessionStartAt: sessionStart, periodStartAt: "2026-10-02T07:00:00+07:00", checkedInAt: "2026-10-02T05:35:00+07:00", environmentCode: "in_class", activityTypeCode: "" };
assert.doesNotThrow(() => context.assertTeachingCheckInWindow_(valid));
assert.throws(() => context.assertTeachingCheckInWindow_({ ...valid, checkedInAt: "2026-10-02T05:29:00+07:00" }), (error) => error.code === "CHECK_IN_OUTSIDE_WINDOW");
assert.throws(() => context.assertTeachingCheckInWindow_({ ...valid, activityTypeCode: "DEMO_SESSION" }), (error) => error.code === "TOPIC_REQUIRES_APPROVAL");

let updated;
let eventResponse;
const events = new Map([["original", { EventId: "event-1", Status: "CONFIRMED", ScheduleId: "schedule-1", PeriodId: "schedule-1" }]]);
const workLog = { ID: "work-1", Status: "ACTIVE", InputData: JSON.stringify({ calculation: { total: 165000, mcpPoints: 20, policyVersion: "BASE" } }) };
Object.assign(context, {
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  getDatabase_: () => ({}), assertIntegrationReady_: () => {},
  findIntegrationEventByKey_: (_ss, key) => events.get(key),
  normalizeCode_: (value) => String(value || "").toUpperCase(),
  safeParseJson_: (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } },
  findDurableTeachingWorkLog_: () => workLog,
  updateTeachingWorkLogPolicySnapshot_: (_ss, _log, calculation) => { updated = calculation; return true; },
  updateTeachingIntegrationEventResponse_: (_ss, _event, calculation) => { eventResponse = calculation; },
  upsertIntegrationEvent_: (_ss, event) => events.set(event.IdempotencyKey, event),
});
vm.runInContext(adjustment, context);
for (const [percent, expected] of [[0, 0], [50, 82500], [100, 165000]]) {
  const calculated = context.applyCancelSupportCalculation_({ total: 165000, mcpPoints: 20, policyVersion: "BASE" }, { supportPercent: percent, adminReason: "Trường hủy", approvedBy: "admin@example.com" });
  assert.equal(calculated.total, expected, `Cancel support ${percent}% uses the original rate`);
  assert.equal(calculated.mcpPoints, 20, "Far-school MCP remains unchanged even at 0% support");
}
const payload = { eventId: "adjust-1", targetIdempotencyKey: "original", supportPercent: 50, adminReason: "Trường hủy tiết", adminEmail: "admin@example.com" };
const response = context.adjustCancelledTeachingPeriod_(payload, "hash-1");
assert.equal(response.money, 82500);
assert.equal(response.mcpPoints, 20, "School MCP remains intact after support adjustment");
assert.equal(updated.fullTeachingAmount, 165000);
assert.equal(eventResponse.total, 82500);
assert.equal(context.adjustCancelledTeachingPeriod_(payload, "hash-1").money, 82500, "Retry is idempotent");
assert.throws(() => context.adjustCancelledTeachingPeriod_({ ...payload, supportPercent: 100 }, "hash-2"), (error) => error.code === "ADJUSTMENT_ALREADY_REVIEWED");
console.log("Unified HRM check-in window and 50% support adjustment passed.");
