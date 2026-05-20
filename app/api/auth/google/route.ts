import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { oauthStateCookieName } from "@/lib/auth-session";

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error("Missing GOOGLE_CLIENT_ID.");
    }

    const state = randomUUID();

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri(request));
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("prompt", "select_account");

    const response = NextResponse.redirect(authUrl);
    response.cookies.set(oauthStateCookieName, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    return apiError(error);
  }
}

function redirectUri(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  return new URL("/api/auth/google/callback", baseUrl).toString();
}
