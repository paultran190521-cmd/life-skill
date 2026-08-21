import { NextResponse } from "next/server";
import { apiError, createRequestId } from "@/lib/api";
import { requireSessionUser, requireRole } from "@/lib/route-auth";
import { ensureSheetHeaders } from "@/lib/google-sheets";
import {
  topicHeaders,
  weeklyUpdateHeaders,
  appAnnouncementHeaders,
} from "@/lib/google-sheets";

/**
 * Danh sách tất cả các tab cần có trong Google Sheet.
 * Khi gọi POST /api/setup-sheets, hệ thống sẽ tự tạo tab nếu thiếu
 * và đảm bảo hàng header đúng cho từng tab.
 */
const ALL_SHEETS: { name: Parameters<typeof ensureSheetHeaders>[0]; headers: string[] }[] = [
  {
    name: "Users",
    headers: ["id", "name", "email", "role", "teacherId", "avatarUrl", "isActive", "createdAt", "updatedAt"],
  },
  {
    name: "Teachers",
    headers: ["id", "name", "email", "phone", "avatarUrl", "specialty", "active", "createdAt", "updatedAt"],
  },
  {
    name: "Schools",
    headers: ["id", "name", "district", "address", "contactName", "contactPhone", "createdAt", "updatedAt"],
  },
  {
    name: "Classes",
    headers: ["id", "schoolId", "name", "grade", "academicYear", "createdAt", "updatedAt"],
  },
  {
    name: "Topics",
    headers: topicHeaders,
  },
  {
    name: "Lessons",
    headers: [
      "id", "topicId", "grade", "title", "objective", "objectives",
      "durationMinutes", "sortOrder", "active", "createdAt", "updatedAt", "samplePlanUrl",
    ],
  },
  {
    name: "TimeSlots",
    headers: ["id", "label", "start", "end", "active", "createdAt", "updatedAt"],
  },
  {
    name: "Schedules",
    headers: [
      "id", "date", "teacherId", "schoolId", "classId", "lessonId", "timeSlotId",
      "status", "sentAt", "confirmedAt", "reassignedFrom", "cancelledAt",
      "createdBy", "createdAt", "updatedAt", "teachingEnvironment", "groupId", "assistantIds",
    ],
  },
  {
    name: "LessonPlans",
    headers: [
      "id", "scheduleId", "teacherId", "fileName", "driveFileId", "driveUrl",
      "uploadedAt", "createdAt", "updatedAt", "source",
    ],
  },
  {
    name: "Attendance",
    headers: ["id", "scheduleId", "teacherId", "checkedInAt", "note", "createdAt", "updatedAt"],
  },
  {
    name: "Notifications",
    headers: ["id", "title", "body", "role", "targetUserId", "read", "createdAt", "updatedAt"],
  },
  {
    name: "AppAnnouncements",
    headers: appAnnouncementHeaders,
  },
  {
    name: "AuditLogs",
    headers: ["id", "actorId", "actorEmail", "action", "entityType", "entityId", "metadata", "createdAt"],
  },
  {
    name: "WeeklyUpdates",
    headers: weeklyUpdateHeaders,
  },
];

export async function POST(request: Request) {
  const requestId = createRequestId("setup-sheets");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: true });
    requireRole(auth.user, "admin");

    const results: { sheet: string; status: string; headers: string[] }[] = [];

    for (const sheet of ALL_SHEETS) {
      try {
        const headers = await ensureSheetHeaders(sheet.name, sheet.headers);
        const wasCreated = headers.length === sheet.headers.length;
        results.push({
          sheet: sheet.name,
          status: wasCreated ? "ok" : "updated",
          headers,
        });
      } catch (error) {
        results.push({
          sheet: sheet.name,
          status: `error: ${error instanceof Error ? error.message : String(error)}`,
          headers: [],
        });
      }
    }

    const created = results.filter((r) => r.status === "ok").length;
    const updated = results.filter((r) => r.status === "updated").length;
    const errors = results.filter((r) => r.status.startsWith("error")).length;

    return NextResponse.json({
      success: errors === 0,
      summary: `${created} sheets OK, ${updated} updated, ${errors} errors`,
      results,
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function GET(request: Request) {
  const requestId = createRequestId("setup-sheets");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: true });
    requireRole(auth.user, "admin");

    return NextResponse.json({
      message: "Gửi POST /api/setup-sheets để tự động tạo tất cả tab Google Sheet còn thiếu.",
      sheets: ALL_SHEETS.map((s) => ({ name: s.name, headerCount: s.headers.length })),
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}
