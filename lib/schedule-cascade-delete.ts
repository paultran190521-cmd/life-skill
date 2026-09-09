import { trashDriveFileById } from "@/lib/google-drive";
import { deleteSheetRowsByIds, readSheetRowsBatch } from "@/lib/google-sheets";

const GAS_TIMEOUT_MS = 25_000;

export type ScheduleCascadeDeleteResult = {
  deletedScheduleIds: string[];
  deletedAttendanceIds: string[];
  deletedLessonPlanIds: string[];
  trashedDriveFileIds: string[];
};

/**
 * Xóa lịch cùng toàn bộ dữ liệu nghiệp vụ phụ thuộc. Audit log được giữ lại để
 * truy vết thao tác xóa, còn xác nhận nằm trên chính dòng Schedule nên biến mất
 * cùng lịch. Giáo án upload được chuyển vào Thùng rác Google Drive trước khi
 * các bản ghi Sheets bị xóa.
 */
export async function deleteSchedulesCascade(scheduleIds: string[]): Promise<ScheduleCascadeDeleteResult> {
  const requestedIds = Array.from(new Set(scheduleIds.map((id) => String(id || "").trim()).filter(Boolean)));
  if (requestedIds.length === 0) {
    return { deletedScheduleIds: [], deletedAttendanceIds: [], deletedLessonPlanIds: [], trashedDriveFileIds: [] };
  }

  const { Schedules: schedules, Attendance: attendance, LessonPlans: lessonPlans } = await readSheetRowsBatch(
    ["Schedules", "Attendance", "LessonPlans"] as const,
  );
  const requestedIdSet = new Set(requestedIds);
  const targetSchedules = schedules.filter((schedule) => requestedIdSet.has(String(schedule.id || "").trim()));
  const deletedScheduleIds = targetSchedules.map((schedule) => String(schedule.id || "").trim()).filter(Boolean);
  const deletedIdSet = new Set(deletedScheduleIds);
  const relatedAttendance = attendance.filter((record) => deletedIdSet.has(String(record.scheduleId || "").trim()));
  const relatedLessonPlans = lessonPlans.filter((plan) => deletedIdSet.has(String(plan.scheduleId || "").trim()));
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

  const deletedAttendanceIds = relatedAttendance.map((record) => String(record.id || "").trim()).filter(Boolean);
  const deletedLessonPlanIds = relatedLessonPlans.map((plan) => String(plan.id || "").trim()).filter(Boolean);
  await Promise.all([
    deleteSheetRowsByIds("Attendance", deletedAttendanceIds),
    deleteSheetRowsByIds("LessonPlans", deletedLessonPlanIds.filter((id) => !deletedViaGasIds.has(id))),
    deleteSheetRowsByIds("Schedules", deletedScheduleIds),
  ]);

  return { deletedScheduleIds, deletedAttendanceIds, deletedLessonPlanIds, trashedDriveFileIds: Array.from(trashedDriveFileIds) };
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
