import { NextResponse } from "next/server";
import { apiError, createRequestId } from "@/lib/api";
import { getAppDataFromSheets } from "@/lib/google-sheets";
import { requireSessionUser } from "@/lib/route-auth";

export async function GET(request: Request) {
  const requestId = createRequestId("app-data");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    const data = await getAppDataFromSheets();
    const teacherId = String(auth.user.teacherId || "").trim();

    if (auth.user.role === "teacher") {
      const scopedSchedules = teacherId
        ? data.schedules.filter((schedule) => schedule.teacherId === teacherId)
        : [];
      const scopedScheduleIds = new Set(scopedSchedules.map((schedule) => schedule.id));

      return NextResponse.json({
        users: [auth.user],
        teachers: teacherId ? data.teachers.filter((teacher) => teacher.id === teacherId) : [],
        schools: data.schools,
        classes: data.classes,
        lessons: data.lessons,
        timeSlots: data.timeSlots,
        schedules: scopedSchedules,
        lessonPlans: teacherId
          ? data.lessonPlans.filter((plan) => plan.teacherId === teacherId)
          : [],
        attendance: teacherId
          ? data.attendance.filter(
              (record) => record.teacherId === teacherId || scopedScheduleIds.has(record.scheduleId),
            )
          : [],
        notifications: data.notifications.filter(
          (notification) => notification.role === "teacher" || notification.role === "all",
        ),
        appAnnouncements: data.appAnnouncements.filter((announcement) => announcement.active),
        auditLogs: [],
      });
    }

    return NextResponse.json({
      users: data.users,
      teachers: data.teachers,
      schools: data.schools,
      classes: data.classes,
      lessons: data.lessons,
      timeSlots: data.timeSlots,
      schedules: data.schedules,
      lessonPlans: data.lessonPlans,
      attendance: data.attendance,
      notifications: data.notifications,
      appAnnouncements: data.appAnnouncements,
      auditLogs: data.auditLogs,
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}
