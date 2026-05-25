import { NextResponse } from "next/server";
import {
  attendance as fallbackAttendance,
  chatMessages as fallbackChatMessages,
  chatThreads as fallbackChatThreads,
  classes as fallbackClasses,
  lessonPlans as fallbackLessonPlans,
  lessons as fallbackLessons,
  notifications as fallbackNotifications,
  schedules as fallbackSchedules,
  schools as fallbackSchools,
  teachers as fallbackTeachers,
  timeSlots as fallbackTimeSlots,
  users as fallbackUsers,
} from "@/lib/sample-data";
import { apiError } from "@/lib/api";
import { getAppDataFromSheets } from "@/lib/google-sheets";

export async function GET() {
  try {
    const data = await getAppDataFromSheets();

    return NextResponse.json({
      users: mergeUsers(data.users, fallbackUsers),
      teachers: withFallback(data.teachers, fallbackTeachers),
      schools: withFallback(data.schools, fallbackSchools),
      classes: withFallback(data.classes, fallbackClasses),
      lessons: withFallback(data.lessons, fallbackLessons),
      timeSlots: withFallback(data.timeSlots, fallbackTimeSlots),
      schedules: withFallback(data.schedules, fallbackSchedules),
      lessonPlans: withFallback(data.lessonPlans, fallbackLessonPlans),
      attendance: withFallback(data.attendance, fallbackAttendance),
      chatThreads: withFallback(data.chatThreads, fallbackChatThreads),
      chatMessages: withFallback(data.chatMessages, fallbackChatMessages),
      notifications: withFallback(data.notifications, fallbackNotifications),
      auditLogs: data.auditLogs,
    });
  } catch (error) {
    return apiError(error);
  }
}

function withFallback<T>(rows: T[], fallback: T[]) {
  return rows.length > 0 ? rows : fallback;
}

function mergeUsers<T extends { id: string; email: string; role: string }>(rows: T[], fallback: T[]) {
  if (rows.length === 0) {
    return fallback;
  }

  const userKeys = new Set(rows.flatMap((user) => [user.id, user.email]));
  const missingFallbackUsers = fallback.filter(
    (user) => user.role === "admin" && !userKeys.has(user.id) && !userKeys.has(user.email),
  );

  return [...rows, ...missingFallbackUsers];
}
