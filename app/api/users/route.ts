import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { appendSheetRow, appendSheetRows, readSheetRows } from "@/lib/google-sheets";
import { getAvatarUrl } from "@/lib/avatar";
import type { Role } from "@/lib/types";

export async function GET() {
  try {
    return NextResponse.json(await readSheetRows("Users"));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const rawUsers = Array.isArray(body?.users) ? body.users : Array.isArray(body) ? body : [body];
    const users = rawUsers.map((item: Record<string, unknown>, index: number) => {
      const name = String(item.name || "").trim();
      const email = String(item.email || "")
        .trim()
        .toLowerCase();
      if (!name || !email) {
        throw new Error(`Dòng tài khoản ${index + 1} thiếu Họ tên hoặc Email.`);
      }

      return {
        id: String(item.id || createId("u")),
        name,
        email,
        role: normalizeRole(item.role),
        teacherId: String(item.teacherId || "").trim(),
        avatarUrl: String(item.avatarUrl || "").trim() || getAvatarUrl(email, name),
        isActive: item.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };
    });

    if (users.length === 1) {
      await appendSheetRow("Users", users[0]);
      return NextResponse.json(users[0]);
    }

    await appendSheetRows("Users", users);
    return NextResponse.json({ users });
  } catch (error) {
    return apiError(error);
  }
}

function normalizeRole(role: unknown): Role {
  return role === "teacher" ? "teacher" : "admin";
}
