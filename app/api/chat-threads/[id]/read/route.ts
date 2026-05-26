import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { sessionCookieName, verifySessionToken } from "@/lib/auth-session";
import { findAuthorizedUserFromHint, findAuthorizedUserFromSession } from "@/lib/auth-users";
import { ensureSheetHeaders, readSheetRowById, readSheetRows, updateSheetRowById } from "@/lib/google-sheets";
import type { User } from "@/lib/types";

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

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const currentUser = await requireUser(request);
    const { id } = await params;
    const now = new Date().toISOString();
    const thread = await readSheetRowById("ChatThreads", id);

    if (!thread) {
      return NextResponse.json({ error: "Không tìm thấy kênh chat." }, { status: 404 });
    }

    const authError = getThreadAuthorizationError(currentUser, thread.teacherId || "");
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 403 });
    }

    await ensureSheetHeaders("ChatMessages", chatMessageHeaders);

    const readField = currentUser.role === "admin" ? "readByAdminAt" : "readByTeacherAt";
    const messages = await readSheetRows("ChatMessages");
    const unreadMessages = messages.filter(
      (message) => message.threadId === id && message.senderRole !== currentUser.role && !message[readField],
    );

    await Promise.all(
      unreadMessages.map((message) =>
        updateSheetRowById("ChatMessages", message.id, {
          [readField]: now,
        }),
      ),
    );

    return NextResponse.json({ updated: unreadMessages.length, readAt: now });
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
  if (user.role === "admin" || user.teacherId === teacherId) {
    return "";
  }
  return "Không có quyền đọc kênh chat này.";
}

class RouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
