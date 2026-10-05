import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../outputs/hrm-unified-attendance-20261002/src/Code.js", import.meta.url), "utf8");
const start = source.indexOf("function getMonthlyMcpDetailsFromLedger_(");
const end = source.indexOf("function roundMoney_(amount)", start);
assert.ok(start >= 0 && end > start, "The HRM monthly MCP aggregation must exist");

const headers = ["ID", "UserEmail", "Points", "EntryType", "ReasonCode", "ReasonName", "Source", "ExternalEventId", "ActivityId", "AssignmentId", "WorkDate", "EvidenceUrl", "Status"];
const row = ({ email = "teacher@example.com", points, activity = "activity-1", assignment = "assignment-1", date = "2026-10-03", status = "Active" }) => ["ledger-id", email, points, points < 0 ? "REVERSAL" : "CREDIT", "INTERNAL_SHARING", "Chia sẻ chuyên môn", "METTASOUL", "event-id", activity, assignment, date, "", status];
const data = [headers,
  row({ points: 100 }),
  row({ points: 20, activity: "activity-2", assignment: "assignment-2" }),
  row({ points: -20, activity: "activity-2", assignment: "assignment-2" }),
  row({ points: 5, date: "2026-09-23" }),
  row({ points: 500, status: "Deleted" }),
  row({ email: "other@example.com", points: 50 }),
];
const db = { getSheetByName: () => ({ getDataRange: () => ({ getValues: () => data }) }) };
const context = { getDatabase_: () => db, safeDateStr_: (value) => String(value || "").slice(0, 10) };
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

const october = context.getMonthlyMcpDetailsFromLedger_(db, "2026-10");
assert.equal(october.totals["teacher@example.com"], 100, "The monthly total must include credits and reversals from the ledger once");
assert.equal(october.byWork["teacher@example.com|activity-1|assignment-1"], 100, "The related HRM work row must show its MCP credit");
assert.equal(october.byWork["teacher@example.com|activity-2|assignment-2"], 0, "A reversed activity must show no net MCP");
assert.equal(october.totals["other@example.com"], 50, "Each teacher has a separate total");
assert.equal(context.getMonthlyMcpDetailsFromLedger_(db, "2026-09").totals["teacher@example.com"], 5, "Transactions stay in their work month");
assert.equal(context.attachMonthlyMcpTotals_([{ email: "teacher@example.com" }], "2026-10")[0].monthMcp, 100, "Payroll reports use the same ledger total");
assert.match(source, /const monthMcp = mcpLedger\.totals\[targetEmail\] \|\| 0/, "The HRM dashboard uses the ledger total");
assert.doesNotMatch(source, /getMonthlyMcpTotalsFromLogs_/, "WorkLogs must not be counted as a second MCP source");

console.log("HRM MCP ledger summary checks passed.");
