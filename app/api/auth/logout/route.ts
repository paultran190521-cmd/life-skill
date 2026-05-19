import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/auth-session";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
  return NextResponse.json({ ok: true });
}
