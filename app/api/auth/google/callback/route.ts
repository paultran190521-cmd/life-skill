import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import {
  createSessionToken,
  oauthStateCookieName,
  sessionCookieName,
} from "@/lib/auth-session";
import { findAuthorizedUserByEmail } from "@/lib/auth-users";
import { readSheetRows, updateSheetRowById } from "@/lib/google-sheets";

type GoogleTokenResponse = {
  id_token?: string;
  error?: string;
};

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string;
  name?: string;
  picture?: string;
};

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const cookieStore = await cookies();
    const expectedState = cookieStore.get(oauthStateCookieName)?.value;

    if (!code || !state || !expectedState || state !== expectedState) {
      const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join(", ");
      throw new Error(`Google login state is invalid. Code: ${!!code}, State: ${state}, Expected: ${expectedState}, Cookies: [${allCookies}]`);
    }

    const profile = await fetchGoogleProfile(request, code);
    if (!profile.email || profile.email_verified !== "true") {
      throw new Error("Google account email is not verified.");
    }

    const user = await findAuthorizedUserByEmail(profile.email);
    if (!user) {
      throw new Error("Email này chưa được phân quyền trong menu Giáo viên.");
    }

    // Update avatar with Google profile picture if available
    if (profile.picture) {
      try {
        if (user.teacherId) {
          await updateSheetRowById("Teachers", user.teacherId, { avatarUrl: profile.picture });
        }
        
        const usersRows = await readSheetRows("Users");
        const userRow = usersRows.find(
          (row) => row.email && row.email.toLowerCase() === profile.email?.toLowerCase()
        );
        if (userRow) {
          await updateSheetRowById("Users", userRow.id, { avatarUrl: profile.picture });
        }
        
        user.avatarUrl = profile.picture;
      } catch (err) {
        console.error("Failed to update avatar in Google Sheet:", err);
      }
    }

    cookieStore.delete(oauthStateCookieName);
    cookieStore.set(sessionCookieName, createSessionToken(user.id, user.email), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    const response = NextResponse.redirect(new URL("/", request.nextUrl.origin));
    return response;
  } catch (error) {
    return apiError(error);
  }
}

async function fetchGoogleProfile(request: NextRequest, code: string) {
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
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(request),
    }),
  });

  const token = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenResponse.ok || !token.id_token) {
    throw new Error(token.error || "Cannot exchange Google login code.");
  }

  const profileResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token.id_token)}`,
  );
  const profile = (await profileResponse.json()) as GoogleTokenInfo;
  if (!profileResponse.ok || profile.aud !== clientId) {
    throw new Error("Cannot verify Google login token.");
  }

  return profile;
}

function redirectUri(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  return new URL("/api/auth/google/callback", baseUrl).toString();
}
