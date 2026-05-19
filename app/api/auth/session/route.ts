import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { sessionCookieName, verifySessionToken } from "@/lib/auth-session";
import { readSheetRows } from "@/lib/google-sheets";
import type { Role, User } from "@/lib/types";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = verifySessionToken(cookieStore.get(sessionCookieName)?.value);
    if (!session) {
      return NextResponse.json({ user: null });
    }

    const user = await findUser(session.userId, session.email);
    return NextResponse.json({ user });
  } catch (error) {
    return apiError(error);
  }
}

async function findUser(userId: string, email: string) {
  const rows = await readSheetRows("Users");
  const normalizedEmail = email.trim().toLowerCase();
  const users = rows.map<User>((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: normalizeRole(row.role),
    teacherId: row.teacherId || undefined,
    avatarUrl: row.avatarUrl || undefined,
    isActive: row.isActive !== "false",
  }));

  return (
    users.find((user) => user.id === userId && user.isActive !== false) ??
    users.find((user) => user.email.trim().toLowerCase() === normalizedEmail && user.isActive !== false) ??
    null
  );
}

function normalizeRole(role: string): Role {
  return role === "teacher" ? "teacher" : "admin";
}
