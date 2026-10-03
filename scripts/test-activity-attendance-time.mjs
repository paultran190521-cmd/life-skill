import assert from "node:assert/strict";
import { activityHasEnded } from "../lib/activity-attendance-time.ts";

assert.equal(activityHasEnded("2026-10-03", "16:26", new Date("2026-10-03T09:25:00Z")), false);
assert.equal(activityHasEnded("2026-10-03", "16:26", new Date("2026-10-03T09:26:00Z")), true);
assert.equal(activityHasEnded("2026-10-03", "16:26", new Date("2026-10-04T00:00:00Z")), true);
assert.equal(activityHasEnded("2026-10-04", "16:26", new Date("2026-10-03T09:26:00Z")), false);

console.log("Activity attendance time checks passed.");
