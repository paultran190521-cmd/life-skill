import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { updateSheetRowById } from "@/lib/google-sheets";
import type { Role } from "@/lib/types";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const patch: Record<string, unknown> = {
      ...body,
      updatedAt: new Date().toISOString(),
    };
    if (body.role !== undefined) {
      patch.role = normalizeRole(body.role);
    }

    await updateSheetRowById("Users", id, patch);
    return NextResponse.json({ id, ...patch });
  } catch (error) {
    return apiError(error);
  }
}

function normalizeRole(role: unknown): Role {
  return role === "teacher" ? "teacher" : "admin";
}
