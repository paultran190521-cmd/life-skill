import type { Schedule } from "@/lib/types";

// Keep the stable environment identifier: renaming a label must not reprice old records.
export const topicReportActivities = [
  { code: "STUDENT_TOPIC_REPORT_SUPPORT", name: "Báo cáo chuyên đề học sinh – phối hợp", singleMain: false, evidence: true },
  { code: "STUDENT_TOPIC_REPORT_LEAD", name: "Báo cáo chuyên đề học sinh – chủ trì", singleMain: true, evidence: true },
  { code: "PARTNER_FREE_TOPIC", name: "Chuyên đề phụ huynh/giáo viên", singleMain: true, evidence: true },
  { code: "DEMO_SESSION", name: "Tham gia demo/sinh hoạt chuyên môn", singleMain: false, evidence: false },
] as const;

export function topicReportActivity(code?: string) {
  return topicReportActivities.find((item) => item.code === code);
}

export function validateTopicReport(environment: string, code: string | undefined, teacherIds: string[]) {
  if (environment !== "schoolyard_report") return code ? "Chỉ Báo cáo chuyên đề được chọn loại hoạt động." : "";
  const activity = topicReportActivity(code);
  if (!activity) return "Hãy chọn loại hoạt động cho Báo cáo chuyên đề.";
  const count = new Set(teacherIds).size;
  if (!count || (activity.singleMain && count !== 1)) return "Hoạt động này cần đúng một giáo viên chính; người hỗ trợ chọn vào trợ giảng.";
  return "";
}

/** One assistant entitlement per shared activity, even when it has several main teachers. */
export function canonicalParticipantSchedule(schedule: Schedule, participantId: string, schedules: Schedule[]) {
  if (schedule.teachingEnvironment !== "schoolyard_report" || !schedule.activityTypeCode || schedule.teacherId === participantId || !schedule.groupId) return schedule;
  return schedules.filter((item) => item.groupId === schedule.groupId && item.status !== "cancelled"
    && String(item.assistantIds || "").split(",").map((id) => id.trim()).includes(participantId))
    .sort((left, right) => left.id.localeCompare(right.id))[0] || schedule;
}
