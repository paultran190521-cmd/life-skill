import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { findAuthorizedUserFromHint, findAuthorizedUserFromSession } from "@/lib/auth-users";
import { sessionCookieName, verifySessionToken } from "@/lib/auth-session";
import { appendSheetRow, appendSheetRows, readSheetRowById, readSheetRows, updateSheetRowById } from "@/lib/google-sheets";
import type { User } from "@/lib/types";

const attendanceEarlyMinutes = 30;
const attendanceLateAfterEndMinutes = 90;

export async function POST(request: Request) {
  try {
    const currentUser = await requireUser(request);
    const body = await request.json();
    const scheduleId = String(body.scheduleId || "").trim();
    const now = new Date().toISOString();
    const checkedInAt = body.checkedInAt || now;
    const schedule = await readSheetRowById("Schedules", scheduleId);

    if (!schedule) {
      return NextResponse.json({ error: "Không tìm thấy lịch." }, { status: 404 });
    }

    const authError = getAuthorizationError(currentUser, schedule.teacherId || "");
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 403 });
    }

    if (schedule.status === "cancelled") {
      return NextResponse.json({ error: "Không thể điểm danh lịch đã hủy." }, { status: 400 });
    }

    const existingAttendance = await readSheetRows("Attendance");
    if (existingAttendance.some((item) => item.scheduleId === scheduleId)) {
      return NextResponse.json({ error: "Tiết này đã được điểm danh." }, { status: 409 });
    }

    const slots = await readSheetRows("TimeSlots");
    const slot = slots.find((item) => item.id === schedule.timeSlotId);
    const timeError = validateAttendanceTime(schedule.date, slot?.start, slot?.end, checkedInAt);
    if (timeError) {
      return NextResponse.json({ error: timeError }, { status: 400 });
    }

    const attendance = {
      id: body.id || createId("att"),
      scheduleId,
      teacherId: schedule.teacherId,
      checkedInAt,
      note: body.note || "",
      createdAt: now,
      updatedAt: now,
    };

    await appendSheetRow("Attendance", attendance);
    await updateSheetRowById("Schedules", scheduleId, { status: "attended", updatedAt: now });
    await appendSheetRows("AuditLogs", [
      {
        id: createId("audit"),
        actorId: currentUser.id,
        actorEmail: currentUser.email,
        action: "schedule.attend",
        entityType: "Schedule",
        entityId: scheduleId,
        metadata: JSON.stringify({ status: "attended", teacherId: schedule.teacherId }),
        createdAt: now,
      },
    ]);

    return NextResponse.json({ attendance, schedule: { id: scheduleId, status: "attended", updatedAt: now } });
  } catch (error) {
    if (error instanceof RouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}

async function requireUser(request: Request) {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(sessionCookieName)?.value);
  if (session) {
    const userFromSession = await findAuthorizedUserFromSession(session.userId, session.email);
    if (userFromSession) {
      return userFromSession;
    }
  }

  const userFromHeader = await findAuthorizedUserFromHint(
    request.headers.get("x-app-user-id"),
    request.headers.get("x-app-user-email"),
  );
  if (userFromHeader) {
    return userFromHeader;
  }

  throw new RouteError(401, "Unauthorized");
}

function getAuthorizationError(user: User, scheduleTeacherId: string) {
  if (user.role === "admin" || user.teacherId === scheduleTeacherId) {
    return "";
  }

  return "Không có quyền điểm danh tiết này.";
}

function validateAttendanceTime(date: string | undefined, start: string | undefined, end: string | undefined, value: string) {
  if (!date || !start || !end) {
    return "Lịch thiếu ngày dạy hoặc khung giờ.";
  }

  const checkedInAt = new Date(value);
  const startsAt = parseScheduleDateTime(date, start);
  const endsAt = parseScheduleDateTime(date, end);
  const windowStart = new Date(startsAt.getTime() - attendanceEarlyMinutes * 60_000);
  const windowEnd = new Date(endsAt.getTime() + attendanceLateAfterEndMinutes * 60_000);

  if (Number.isNaN(checkedInAt.getTime())) {
    return "Thời gian điểm danh không hợp lệ.";
  }

  if (checkedInAt < windowStart) {
    return `Chỉ được điểm danh sớm tối đa ${attendanceEarlyMinutes} phút trước giờ bắt đầu.`;
  }

  if (checkedInAt > windowEnd) {
    return `Đã quá thời hạn điểm danh ${attendanceLateAfterEndMinutes} phút sau giờ kết thúc.`;
  }

  return "";
}

function parseScheduleDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00+07:00`);
}

class RouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
