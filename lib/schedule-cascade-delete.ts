import { trashDriveFileById } from "@/lib/google-drive";
import { conflictError } from "@/lib/app-error";
import {
  deleteSheetRowsByIds,
  ensureSheetHeaders,
  readSheetRows,
  readSheetRowsBatch,
  teachingWorkLogHeaders,
} from "@/lib/google-sheets";

const GAS_TIMEOUT_MS = 25_000;

export type ScheduleCascadeDeleteResult = {
  deletedScheduleIds: string[];
  deletedAttendanceIds: string[];
  deletedLessonPlanIds: string[];
  deletedLessonPlanMessageIds: string[];
  deletedLessonPlanAttachmentIds: string[];
  deletedTeachingWorkLogIds: string[];
  trashedDriveFileIds: string[];
};

/**
 * Xóa lịch cùng toàn bộ dữ liệu nghiệp vụ phụ thuộc. Audit log được giữ lại để
 * truy vết thao tác xóa, còn xác nhận nằm trên chính dòng Schedule nên biến mất
 * cùng lịch. Giáo án upload được chuyển vào Thùng rác Google Drive trước khi
 * các bản ghi Sheets bị xóa.
 */
export async function deleteSchedulesCascade(scheduleIds: string[]): Promise<ScheduleCascadeDeleteResult> {
  const result = await deleteScheduleDependentData(scheduleIds);
  await deleteSheetRowsByIds("Schedules", result.deletedScheduleIds);
  return result;
}

/**
 * Xóa dữ liệu phát sinh của lịch nhưng giữ lại chính dòng Schedule. Dùng trước
 * khi phân công lại để dữ liệu của giáo viên cũ không đi theo người nhận mới.
 */
export async function resetScheduleAssignmentData(scheduleIds: string[]): Promise<ScheduleCascadeDeleteResult> {
  return deleteScheduleDependentData(scheduleIds);
}

export async function assertNoConfirmedTeachingWorkLogs(scheduleIds: string[]) {
  const requestedIds = new Set(scheduleIds.map((id) => String(id || "").trim()).filter(Boolean));
  if (requestedIds.size === 0) return;

  await ensureSheetHeaders("TeachingWorkLogs", teachingWorkLogHeaders);
  const workLogs = await readSheetRows("TeachingWorkLogs");
  const protectedWorkLogs = workLogs.filter((row) =>
    requestedIds.has(String(row.scheduleId || "").trim())
    && ["CONFIRMED", "PENDING"].includes(String(row.status || "").toUpperCase()),
  );
  if (protectedWorkLogs.length > 0) {
    throw conflictError(
      "Không thể hủy, xóa hoặc chuyển lịch đã chấm công hoặc đang chờ HRM xác nhận. Hãy xử lý dòng công trong HRM trước.",
    );
  }
}

async function deleteScheduleDependentData(scheduleIds: string[]): Promise<ScheduleCascadeDeleteResult> {
  const requestedIds = Array.from(new Set(scheduleIds.map((id) => String(id || "").trim()).filter(Boolean)));
  if (requestedIds.length === 0) {
    return {
      deletedScheduleIds: [],
      deletedAttendanceIds: [],
      deletedLessonPlanIds: [],
      deletedLessonPlanMessageIds: [],
      deletedLessonPlanAttachmentIds: [],
      deletedTeachingWorkLogIds: [],
      trashedDriveFileIds: [],
    };
  }

  await assertNoConfirmedTeachingWorkLogs(requestedIds);

  const rows = await readSheetRowsBatch(
    ["Schedules", "Attendance", "LessonPlans", "LessonPlanMessages", "LessonPlanAttachments", "TeachingWorkLogs"] as const,
  );
  const requestedIdSet = new Set(requestedIds);
  const targetSchedules = rows.Schedules.filter((schedule) => requestedIdSet.has(String(schedule.id || "").trim()));
  const deletedScheduleIds = targetSchedules.map((schedule) => String(schedule.id || "").trim()).filter(Boolean);
  const deletedIdSet = new Set(deletedScheduleIds);
  const relatedAttendance = rows.Attendance.filter((record) => deletedIdSet.has(String(record.scheduleId || "").trim()));
  const relatedLessonPlans = rows.LessonPlans.filter((plan) => deletedIdSet.has(String(plan.scheduleId || "").trim()));
  const relatedLessonPlanIdSet = new Set(relatedLessonPlans.map((plan) => String(plan.id || "").trim()).filter(Boolean));
  const relatedMessages = rows.LessonPlanMessages.filter((message) => relatedLessonPlanIdSet.has(String(message.lessonPlanId || "").trim()));
  const relatedAttachments = rows.LessonPlanAttachments.filter((attachment) => relatedLessonPlanIdSet.has(String(attachment.lessonPlanId || "").trim()));
  const uploadedLessonPlans = relatedLessonPlans.filter(
    (plan) => plan.source !== "external_link" && String(plan.driveFileId || "").trim(),
  );
  const deletedViaGasIds = new Set<string>();
  const trashedDriveFileIds = new Set<string>();

  // Giáo án upload qua GAS cần xóa bằng đúng webhook đó: GAS có quyền trên
  // thư mục giáo án, đồng thời chuyển file vào Thùng rác và xóa đúng dòng Sheet.
  // Chỉ dùng service account làm phương án dự phòng cho các bản ghi cũ.
  await Promise.all(uploadedLessonPlans.map(async (plan) => {
    const lessonPlanId = String(plan.id || "").trim();
    const driveFileId = String(plan.driveFileId || "").trim();
    if (await deleteLessonPlanViaGas(lessonPlanId)) {
      deletedViaGasIds.add(lessonPlanId);
      trashedDriveFileIds.add(driveFileId);
      return;
    }
    await trashDriveFileById(driveFileId);
    trashedDriveFileIds.add(driveFileId);
  }));

  const attachmentDriveFileIds = Array.from(new Set(relatedAttachments
    .map((attachment) => String(attachment.driveFileId || "").trim())
    .filter(Boolean)));
  await Promise.all(attachmentDriveFileIds.map(async (driveFileId) => {
    if (!await deleteChatAttachmentViaGas(driveFileId)) {
      await trashDriveFileById(driveFileId);
    }
    trashedDriveFileIds.add(driveFileId);
  }));

  const deletedAttendanceIds = relatedAttendance.map((record) => String(record.id || "").trim()).filter(Boolean);
  const deletedLessonPlanIds = relatedLessonPlans.map((plan) => String(plan.id || "").trim()).filter(Boolean);
  const deletedLessonPlanMessageIds = relatedMessages.map((message) => String(message.id || "").trim()).filter(Boolean);
  const deletedLessonPlanAttachmentIds = relatedAttachments.map((attachment) => String(attachment.id || "").trim()).filter(Boolean);
  const deletedTeachingWorkLogIds = rows.TeachingWorkLogs
    .filter((workLog) => deletedIdSet.has(String(workLog.scheduleId || "").trim()))
    .map((workLog) => String(workLog.id || "").trim())
    .filter(Boolean);
  await Promise.all([
    deleteSheetRowsByIds("Attendance", deletedAttendanceIds),
    deleteSheetRowsByIds("LessonPlanMessages", deletedLessonPlanMessageIds),
    deleteSheetRowsByIds("LessonPlanAttachments", deletedLessonPlanAttachmentIds),
    deleteSheetRowsByIds("LessonPlans", deletedLessonPlanIds.filter((id) => !deletedViaGasIds.has(id))),
    deleteSheetRowsByIds("TeachingWorkLogs", deletedTeachingWorkLogIds),
  ]);

  return {
    deletedScheduleIds,
    deletedAttendanceIds,
    deletedLessonPlanIds,
    deletedLessonPlanMessageIds,
    deletedLessonPlanAttachmentIds,
    deletedTeachingWorkLogIds,
    trashedDriveFileIds: Array.from(trashedDriveFileIds),
  };
}

async function deleteLessonPlanViaGas(lessonPlanId: string) {
  const webhookUrl = process.env.GAS_UPLOAD_WEBHOOK_URL || process.env.GAS_MAIL_WEBHOOK_URL;
  const secret = process.env.GAS_UPLOAD_WEBHOOK_SECRET || process.env.GAS_MAIL_WEBHOOK_SECRET;
  if (!lessonPlanId || !webhookUrl || !secret) return false;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GAS_TIMEOUT_MS);
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=utf-8" },
      body: JSON.stringify({ action: "deleteLessonPlan", secret, requestId: `schedule-delete-${crypto.randomUUID()}`, lessonPlanId }),
      signal: controller.signal,
    });
    const rawText = (await response.text()).trim();
    if (!response.ok || !rawText || rawText.startsWith("<")) return false;
    const payload = JSON.parse(rawText) as { ok?: boolean };
    return payload.ok === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function deleteChatAttachmentViaGas(driveFileId: string) {
  const webhookUrl = process.env.GAS_UPLOAD_WEBHOOK_URL || process.env.GAS_MAIL_WEBHOOK_URL;
  const secret = process.env.GAS_UPLOAD_WEBHOOK_SECRET || process.env.GAS_MAIL_WEBHOOK_SECRET;
  if (!driveFileId || !webhookUrl || !secret) return false;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=utf-8" },
      body: JSON.stringify({
        action: "deleteLessonPlanChatAttachment",
        secret,
        requestId: `schedule-reset-${crypto.randomUUID()}`,
        driveFileId,
      }),
      signal: AbortSignal.timeout(GAS_TIMEOUT_MS),
    });
    const payload = await response.json().catch(() => null) as { ok?: boolean } | null;
    return response.ok && payload?.ok === true;
  } catch {
    return false;
  }
}
