import assert from "node:assert/strict";
import { summarizeConfirmedWork } from "../lib/confirmed-work-summary.ts";

const occurrence = { id: "sharing-1", title: "Chia sẻ chuyên môn", status: "APPROVED" };
const confirmed = { id: "assignment-1", activityId: occurrence.id, status: "APPROVED", integrationStatus: "CONFIRMED", hrmWorkLogId: "hrm-sharing-1", cashAmount: 500000, mcpPoints: 100 };
const pending = { id: "assignment-2", activityId: occurrence.id, status: "APPROVED", integrationStatus: "PENDING", cashAmount: 500000, mcpPoints: 100 };

assert.deepEqual(
  (({ count, money, mcpPoints }) => ({ count, money, mcpPoints }))(summarizeConfirmedWork([], [occurrence], [confirmed, pending])),
  { count: 1, money: 500000, mcpPoints: 100 },
  "Only HRM-confirmed activity assignments contribute to the summary",
);

const topicLog = { id: "topic-1", status: "CONFIRMED", activityTypeCode: "TOPIC_REPORT", hrmWorkLogId: "hrm-sharing-1", money: 500000, mcpPoints: 100 };
assert.equal(summarizeConfirmedWork([topicLog], [occurrence], [confirmed]).count, 1, "The same HRM work log must not be counted twice");
assert.equal(summarizeConfirmedWork([], [{ ...occurrence, status: "CANCELLED" }], [confirmed]).count, 0, "Cancelled activity must not appear");
assert.equal(summarizeConfirmedWork([], [occurrence], [confirmed, confirmed]).count, 1, "Repeated assignment rows must not be counted twice");

console.log("Confirmed work summary checks passed.");
