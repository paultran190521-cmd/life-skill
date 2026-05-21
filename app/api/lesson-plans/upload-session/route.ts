import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { createSessionToken, sessionCookieName, verifySessionToken } from "@/lib/auth-session";
import { createLessonPlanUploadSession } from "@/lib/google-drive";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = verifySessionToken(cookieStore.get(sessionCookieName)?.value);
    if (!session) {
      throw new Error("Bạn cần đăng nhập Google trước khi tải giáo án lên Drive.");
    }

    const accessToken = await getGoogleDriveAccessToken(session);
    if (!accessToken) {
      throw new Error("Phiên đăng nhập Google chưa có quyền Drive. Vui lòng đăng xuất rồi đăng nhập Google lại.");
    }

    const body = await request.json();
    const scheduleId = String(body.scheduleId || "");
    const fileName = String(body.fileName || "");
    const mimeType = String(body.mimeType || "application/octet-stream");
    const fileSize = Number(body.fileSize || 0);

    if (!scheduleId || !fileName || !fileSize) {
      throw new Error("Missing scheduleId, fileName, or fileSize.");
    }

    return NextResponse.json(
      await createLessonPlanUploadSession({
        scheduleId,
        fileName,
        mimeType,
        fileSize,
        accessToken,
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}

async function getGoogleDriveAccessToken(session: NonNullable<ReturnType<typeof verifySessionToken>>) {
  if (session.googleAccessToken && (session.googleAccessTokenExpiresAt || 0) > Date.now()) {
    return session.googleAccessToken;
  }

  if (!session.googleRefreshToken) {
    return null;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: session.googleRefreshToken,
      grant_type: "refresh_token",
    }),
  });

  const token = (await tokenResponse.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!tokenResponse.ok || !token.access_token) {
    throw new Error(token.error || "Cannot refresh Google Drive access token.");
  }

  const cookieStore = await cookies();
  cookieStore.set(
    sessionCookieName,
    createSessionToken(session.userId, session.email, {
      googleAccessToken: token.access_token,
      googleRefreshToken: session.googleRefreshToken,
      googleAccessTokenExpiresAt: Date.now() + Math.max((token.expires_in || 3600) - 60, 0) * 1000,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    },
  );

  return token.access_token;
}
