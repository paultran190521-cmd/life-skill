import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { appendSheetRow, readSheetRows } from "@/lib/google-sheets";
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
    const user = {
      id: body.id || createId("u"),
      name: body.name,
      email: body.email,
      role: normalizeRole(body.role),
      teacherId: body.teacherId || "",
      avatarUrl: body.avatarUrl || getAvatarUrl(body.email, body.name),
      isActive: body.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await appendSheetRow("Users", user);
    return NextResponse.json(user);
  } catch (error) {
    return apiError(error);
  }
}

function normalizeRole(role: unknown): Role {
  return role === "teacher" ? "teacher" : "admin";
}
