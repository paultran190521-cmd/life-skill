import { trashDriveFileById } from "@/lib/google-drive";
import { deleteSheetRowsByIds, readSheetRowsBatch } from "@/lib/google-sheets";

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
  const trashedDriveFileIds = Array.from(new Set(
    relatedLessonPlans
      .filter((plan) => plan.source !== "external_link")
      .map((plan) => String(plan.driveFileId || "").trim())
      .filter(Boolean),
  ));

  // Nếu chuyển một file vào Thùng rác thất bại thì giữ nguyên bản ghi Sheets,
  // tránh tạo giáo án mồ côi mà người dùng không còn thấy trong hệ thống.
  await Promise.all(trashedDriveFileIds.map((fileId) => trashDriveFileById(fileId)));

  const deletedAttendanceIds = relatedAttendance.map((record) => String(record.id || "").trim()).filter(Boolean);
  const deletedLessonPlanIds = relatedLessonPlans.map((plan) => String(plan.id || "").trim()).filter(Boolean);
  await Promise.all([
    deleteSheetRowsByIds("Attendance", deletedAttendanceIds),
    deleteSheetRowsByIds("LessonPlans", deletedLessonPlanIds),
    deleteSheetRowsByIds("Schedules", deletedScheduleIds),
  ]);

  return { deletedScheduleIds, deletedAttendanceIds, deletedLessonPlanIds, trashedDriveFileIds };
}
