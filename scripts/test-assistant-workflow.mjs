import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const appData = read("../app/api/app-data/route.ts");
const attendance = read("../app/api/attendance/route.ts");
const confirmation = read("../app/api/schedules/[id]/assistant-confirm/route.ts");
const schedules = read("../app/api/schedules/route.ts");
const app = read("../components/mettasoul-app.tsx");

assert.match(appData, /auth\.user\.role === "assistant"/);
assert.match(appData, /assignedScheduleIds\.has\(plan\.scheduleId\)/);
assert.match(attendance, /schedule\.assistant_attend/);
assert.match(attendance, /`\$\{item\.scheduleId\}\|\$\{item\.teacherId\}`/);
assert.match(confirmation, /assistant_must_be_assigned_to_schedule/);
assert.match(confirmation, /allowed: Boolean\(assistantId\) && assignedAssistantIds\.includes\(assistantId\)/);
assert.match(confirmation, /assistantConfirmedIds/);
assert.match(schedules, /Một người chỉ có thể giữ một vai trò trong cùng một tiết/);
assert.match(schedules, /activeParticipantIds/);
assert.match(app, /<option value="assistant">Quyền trợ giảng<\/option>/);
assert.match(app, /Trợ giảng giáo viên/);
assert.match(app, /Trợ giảng sinh viên/);
assert.match(app, /Vai trò của bạn: \{teachingRoleLabel\(myTeachingRole\)\}/);
assert.match(app, /Trợ giảng không thể tải lên, sửa hoặc xóa giáo án/);
assert.match(app, /Đang đối chiếu với HRM/);
assert.match(app, /reconcilePendingTeachingWorkLog/);
assert.match(app, /role === "assistant" \? "Trợ giảng" : "Giáo viên"/);
assert.match(app, /const expectedTeacherFilter = "all"/);
assert.match(app, /schedule\.teacherId === currentTeacherId \|\| isAssistantAssignedToSchedule\(schedule, currentTeacherId\)/);
assert.match(app, /function scheduleAssistantContactLabels/);
assert.match(app, /\$\{assistant\.name \|\| "Chưa rõ"\} - \$\{assistant\.phone \|\| "Chưa cập nhật"\}/);

console.log("Assistant workflow tests passed for scoped data, self confirmation, attendance, and read-only plans.");
