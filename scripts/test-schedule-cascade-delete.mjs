import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/schedule-cascade-delete.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const deletedRows = [];
const trashedFiles = [];
const fixture = {
  Schedules: [{ id: "schedule-1" }, { id: "schedule-other" }],
  Attendance: [{ id: "attendance-1", scheduleId: "schedule-1" }, { id: "attendance-other", scheduleId: "schedule-other" }],
  LessonPlans: [
    { id: "plan-upload", scheduleId: "schedule-1", source: "upload", driveFileId: "drive-plan" },
    { id: "plan-link", scheduleId: "schedule-1", source: "external_link" },
    { id: "plan-other", scheduleId: "schedule-other" },
  ],
  LessonPlanMessages: [
    { id: "message-1", lessonPlanId: "plan-upload" },
    { id: "message-2", lessonPlanId: "plan-link" },
    { id: "message-other", lessonPlanId: "plan-other" },
  ],
  LessonPlanAttachments: [
    { id: "attachment-1", lessonPlanId: "plan-upload", driveFileId: "drive-attachment" },
    { id: "attachment-other", lessonPlanId: "plan-other", driveFileId: "drive-other" },
  ],
  TeachingWorkLogs: [{ id: "work-log-cancelled", scheduleId: "schedule-1", status: "CANCELLED" }],
};
let teachingWorkLogs = fixture.TeachingWorkLogs;

const runtimeModule = { exports: {} };
new Function("module", "exports", "require", "process", compiled)(
  runtimeModule,
  runtimeModule.exports,
  (specifier) => {
    if (specifier === "@/lib/google-drive") {
      return { trashDriveFileById: async (id) => trashedFiles.push(id) };
    }
    if (specifier === "@/lib/google-sheets") {
      return {
        readSheetRowsBatch: async () => ({ ...fixture, TeachingWorkLogs: teachingWorkLogs }),
        ensureSheetHeaders: async () => undefined,
        readSheetRows: async (sheet) => sheet === "TeachingWorkLogs" ? teachingWorkLogs : [],
        teachingWorkLogHeaders: ["id", "scheduleId", "status"],
        deleteSheetRowsByIds: async (sheet, ids) => deletedRows.push({ sheet, ids: [...ids] }),
      };
    }
    if (specifier === "@/lib/app-error") {
      return { conflictError: (message) => Object.assign(new Error(message), { status: 409, code: "CONFLICT" }) };
    }
    throw new Error(`Unexpected test import: ${specifier}`);
  },
  { env: {} },
);

const { deleteSchedulesCascade, resetScheduleAssignmentData } = runtimeModule.exports;
const resetResult = await resetScheduleAssignmentData(["schedule-1"]);
assert.deepEqual(resetResult.deletedScheduleIds, ["schedule-1"]);
assert.deepEqual(resetResult.deletedAttendanceIds, ["attendance-1"]);
assert.deepEqual(resetResult.deletedLessonPlanIds, ["plan-upload", "plan-link"]);
assert.deepEqual(resetResult.deletedLessonPlanMessageIds, ["message-1", "message-2"]);
assert.deepEqual(resetResult.deletedLessonPlanAttachmentIds, ["attachment-1"]);
assert.deepEqual(resetResult.deletedTeachingWorkLogIds, ["work-log-cancelled"]);
assert.deepEqual(deletedRows.find((call) => call.sheet === "TeachingWorkLogs")?.ids, ["work-log-cancelled"]);
assert.deepEqual(new Set(trashedFiles), new Set(["drive-plan", "drive-attachment"]));
assert.equal(deletedRows.some((call) => call.sheet === "Schedules"), false);

deletedRows.length = 0;
await deleteSchedulesCascade(["schedule-1"]);
assert.deepEqual(deletedRows.find((call) => call.sheet === "Schedules")?.ids, ["schedule-1"]);

teachingWorkLogs = [{ id: "work-log-1", scheduleId: "schedule-1", status: "CONFIRMED" }];
await assert.rejects(
  () => resetScheduleAssignmentData(["schedule-1"]),
  (error) => error.status === 409 && /đã chấm công/.test(error.message),
);

teachingWorkLogs = [{ id: "work-log-pending", scheduleId: "schedule-1", status: "PENDING" }];
await assert.rejects(
  () => deleteSchedulesCascade(["schedule-1"]),
  (error) => error.status === 409 && /đang chờ HRM/.test(error.message),
);

console.log("Schedule cascade tests passed, including HRM work-log protection.");
