import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getAppDataFromSheets } from "@/lib/google-sheets";

export async function GET() {
  try {
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
      auditLogs: data.auditLogs,
    });
  } catch (error) {
    return apiError(error);
  }
}
