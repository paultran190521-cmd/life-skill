import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { sessionCookieName, verifySessionToken } from "@/lib/auth-session";
import { findAuthorizedUserFromHint, findAuthorizedUserFromSession } from "@/lib/auth-users";
import { appendSheetRow, readSheetRows } from "@/lib/google-sheets";
import type { ChatThread, User } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const currentUser = await requireUser(request);
    const body = await request.json();
    const type = body.type === "schedule" ? "schedule" : "teacher";
    const teacherId = String(body.teacherId || currentUser.teacherId || "").trim();
    const now = new Date().toISOString();

    if (type !== "teacher") {
      return NextResponse.json({ error: "Chỉ hỗ trợ tạo nhanh kênh theo giáo viên." }, { status: 400 });
    }

    const authError = getTeacherThreadAuthorizationError(currentUser, teacherId);
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 403 });
    }

    const teachers = await readSheetRows("Teachers");
    const teacher = teachers.find((item) => item.id === teacherId);
    if (!teacher) {
      return NextResponse.json({ error: "Không tìm thấy giáo viên." }, { status: 404 });
    }

    const existingThreads = await readSheetRows("ChatThreads");
    const existingThread = existingThreads.find((thread) => thread.type === "teacher" && thread.teacherId === teacherId);
    if (existingThread) {
      return NextResponse.json({ thread: toChatThread(existingThread), created: false });
    }

    const thread: ChatThread = {
      id: createId("thread"),
      type: "teacher",
      teacherId,
      title: `Trao đổi với ${teacher.name || "giáo viên"}`,
    };

    await appendSheetRow("ChatThreads", { ...thread, createdAt: now, updatedAt: now });
    return NextResponse.json({ thread, created: true });
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

function getTeacherThreadAuthorizationError(user: User, teacherId: string) {
  if (!teacherId) {
    return "Thiếu giáo viên.";
  }
  if (user.role === "admin" || user.teacherId === teacherId) {
    return "";
  }
  return "Không có quyền mở kênh chat này.";
}

function toChatThread(row: Record<string, string>): ChatThread {
  return {
    id: row.id,
    type: row.type === "schedule" ? "schedule" : "teacher",
    teacherId: row.teacherId,
    scheduleId: row.scheduleId || undefined,
    title: row.title,
  };
}

class RouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
