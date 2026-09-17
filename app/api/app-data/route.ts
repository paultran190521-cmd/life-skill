import { NextResponse } from "next/server";
import { apiError, createRequestId } from "@/lib/api";
import { getAppDataFromSheets } from "@/lib/google-sheets";
import { hrmIntegrationConfigured } from "@/lib/hrm-integration";
import { requireSessionUser } from "@/lib/route-auth";
import { schoolGuideMapUrlForName } from "@/lib/school-guide-data";

export async function GET(request: Request) {
  const requestId = createRequestId("app-data");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    const data = await getAppDataFromSheets({ includeHistory: new URL(request.url).searchParams.get("history") !== "lazy" });
    const schools = data.schools.map((school) => ({
      ...school,
      mapUrl: schoolGuideMapUrlForName(school.name),
    }));
    const persistedUser = data.users.find(
      (user) => user.id === auth.user.id || user.email.trim().toLowerCase() === auth.user.email.trim().toLowerCase(),
    ) ?? auth.user;
    const teacherId = String(auth.user.teacherId || "").trim();

    if (auth.user.role === "teacher" || auth.user.role === "assistant") {
      const assignedSchedules = teacherId
        ? data.schedules.filter((schedule) =>
            schedule.teacherId === teacherId ||
            String(schedule.assistantIds || "").split(",").map((id) => id.trim()).includes(teacherId),
          )
        : [];
      const sharedGroupIds = new Set(assignedSchedules.map((schedule) => String(schedule.groupId || "").trim()).filter(Boolean));
      const assignedScheduleIds = new Set(assignedSchedules.map((schedule) => schedule.id));
      // Lịch cùng group là một hoạt động chung đã được giao cho giáo viên này.
      // Chỉ dùng các bản ghi đó để hiển thị đồng giảng, không đưa chúng vào danh sách lịch của người khác.
      const scopedSchedules = data.schedules.filter(
        (schedule) =>
          assignedScheduleIds.has(schedule.id) ||
          (Boolean(schedule.groupId) && sharedGroupIds.has(String(schedule.groupId).trim())),
      );
      const visibleTeacherIds = new Set<string>([teacherId]);
      for (const schedule of scopedSchedules) {
        visibleTeacherIds.add(schedule.teacherId);
        for (const assistantId of String(schedule.assistantIds || "").split(",").map((id) => id.trim()).filter(Boolean)) {
          visibleTeacherIds.add(assistantId);
        }
      }

      return NextResponse.json({
        users: [persistedUser],
        teachers: teacherId ? data.teachers.filter((teacher) => visibleTeacherIds.has(teacher.id)) : [],
        schools,
        classes: data.classes,
        topics: data.topics,
        lessons: data.lessons,
        timeSlots: data.timeSlots,
        schedules: scopedSchedules,
        lessonPlans: teacherId
          ? data.lessonPlans.filter((plan) => auth.user.role === "assistant"
              ? assignedScheduleIds.has(plan.scheduleId)
              : plan.teacherId === teacherId)
          : [],
        attendance: teacherId ? data.attendance.filter((record) => record.teacherId === teacherId) : [],
        teachingWorkLogs: teacherId ? data.teachingWorkLogs.filter((record) => record.teacherId === teacherId) : [],
        hrmIntegration: { configured: hrmIntegrationConfigured() },
        notifications: data.notifications.filter(
          (notification) => notification.role === auth.user.role || notification.role === "all",
        ),
        appAnnouncements: data.appAnnouncements.filter((announcement) => announcement.active),
        auditLogs: [],
        weeklyUpdates: [],
        teacherAvailability: teacherId
          ? data.teacherAvailability.filter((item) => item.teacherId === teacherId && item.status === "available")
          : [],
      }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }

    return NextResponse.json({
      users: data.users,
      teachers: data.teachers,
      schools,
      classes: data.classes,
      topics: data.topics,
      lessons: data.lessons,
      timeSlots: data.timeSlots,
      schedules: data.schedules,
      lessonPlans: data.lessonPlans,
      attendance: data.attendance,
      teachingWorkLogs: data.teachingWorkLogs,
      hrmIntegration: { configured: hrmIntegrationConfigured() },
      notifications: data.notifications,
      appAnnouncements: data.appAnnouncements,
      auditLogs: data.auditLogs,
      weeklyUpdates: data.weeklyUpdates,
      teacherAvailability: data.teacherAvailability.filter((item) => item.status === "available"),
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return apiError(error, requestId);
  }
}
