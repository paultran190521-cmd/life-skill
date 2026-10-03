import assert from "node:assert/strict";
import { renderActivityRewardMessage } from "../lib/activity-reward-message.ts";

const sample = { teacherName: "Cô A", activityTitle: "Chia sẻ chuyên môn", activityDate: "2026-10-03", roleLabel: "Người tham dự", money: 0, mcpPoints: 20 };
const attendee = renderActivityRewardMessage(sample);
assert.match(attendee.html, /20 MCP/);
assert.doesNotMatch(attendee.html, /Thù lao được HRM ghi nhận/);
assert.match(attendee.html, /03\/10\/2026/);

const lead = renderActivityRewardMessage({ ...sample, roleLabel: "Người chủ trì", money: 500000, mcpPoints: 100 });
assert.match(lead.html, /500\.000 ₫/);
assert.match(lead.html, /100 MCP/);

const noBenefit = renderActivityRewardMessage({ ...sample, activityTitle: "<script>", money: 0, mcpPoints: 0 });
assert.doesNotMatch(noBenefit.html, /Thù lao được HRM ghi nhận|MCP được HRM ghi nhận/);
assert.match(noBenefit.html, /&lt;script&gt;/);
assert.doesNotMatch(noBenefit.html, /<script>/);

console.log("Activity reward email content tests passed.");
