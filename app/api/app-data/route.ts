import { NextResponse } from "next/server";
import { apiError, createRequestId } from "@/lib/api";
import { getAppDataFromSheets } from "@/lib/google-sheets";
import { requireSessionUser } from "@/lib/route-auth";

export async function GET(request: Request) {
  const requestId = createRequestId("app-data");
  try {
    await requireSessionUser(request, { allowHeaderFallback: false });
    const data = await getAppDataFromSheets();

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
