import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { sessionCookieName, verifySessionToken } from "@/lib/auth-session";
import { findAuthorizedUserFromHint, findAuthorizedUserFromSession } from "@/lib/auth-users";
import { appendSheetRowWithHeaders } from "@/lib/google-sheets";
import type { ChatMessage, User } from "@/lib/types";

const chatMessageHeaders = [
  "id",
  "threadId",
  "senderId",
  "senderName",
  "senderRole",
  "body",
  "createdAt",
  "attachmentName",
  "attachmentUrl",
  "readByAdminAt",
  "readByTeacherAt",
];

export async function POST(request: Request) {
  try {
    const currentUser = await requireUser(request);
    const body = await request.json();
    const threadId = String(body.threadId || "").trim();
    const threadTeacherId = String(body.threadTeacherId || "").trim();
    const text = String(body.body || "").trim();
    const attachmentName = String(body.attachmentName || "").trim();
    const attachmentUrl = String(body.attachmentUrl || "").trim();
    const now = new Date().toISOString();

    if (!threadId) {
      return NextResponse.json({ error: "Thiếu kênh chat." }, { status: 400 });
    }
    if (!text && !attachmentUrl) {
      return NextResponse.json({ error: "Tin nhắn không được để trống." }, { status: 400 });
    }
    if (attachmentUrl && !isValidUrl(attachmentUrl)) {
      return NextResponse.json({ error: "Link đính kèm không hợp lệ." }, { status: 400 });
    }

    const authError = getThreadAuthorizationError(currentUser, threadTeacherId);
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 403 });
    }

    const message: ChatMessage = {
      id: body.id || createId("m"),
      threadId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      body: text,
      createdAt: now,
      attachmentName: attachmentName || undefined,
      attachmentUrl: attachmentUrl || undefined,
      readByAdminAt: currentUser.role === "admin" ? now : undefined,
      readByTeacherAt: currentUser.role === "teacher" ? now : undefined,
    };

    await appendSheetRowWithHeaders("ChatMessages", chatMessageHeaders, message);
    return NextResponse.json({ message });
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
      return withTeacherHint(userFromSession, request);
    }
  }

  const userFromHeader = await findAuthorizedUserFromHint(
    request.headers.get("x-app-user-id"),
    request.headers.get("x-app-user-email"),
  );
  if (userFromHeader) {
    return withTeacherHint(userFromHeader, request);
  }

  throw new RouteError(401, "Unauthorized");
}

function withTeacherHint(user: User, request: Request) {
  if (user.role !== "teacher" || user.teacherId) {
    return user;
  }

  const teacherId = String(request.headers.get("x-app-teacher-id") || "").trim();
  if (!teacherId) {
    return user;
  }

  return { ...user, teacherId };
}

function getThreadAuthorizationError(user: User, teacherId: string) {
  if (!teacherId) {
    return "Thiếu giáo viên của kênh chat.";
  }
  if (user.role === "admin" || user.teacherId === teacherId) {
    return "";
  }
  return "Không có quyền gửi tin nhắn trong kênh này.";
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

class RouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
