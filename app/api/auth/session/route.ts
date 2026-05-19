import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { sessionCookieName, verifySessionToken } from "@/lib/auth-session";
import { findAuthorizedUserFromSession } from "@/lib/auth-users";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = verifySessionToken(cookieStore.get(sessionCookieName)?.value);
    if (!session) {
      return NextResponse.json({ user: null });
    }

    const user = await findAuthorizedUserFromSession(session.userId, session.email);
    return NextResponse.json({ user });
  } catch (error) {
    return apiError(error);
  }
}
