import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { appendSheetRow, readSheetRows } from "@/lib/google-sheets";

export async function GET() {
  try {
    return NextResponse.json(await readSheetRows("Teachers"));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const teacher = {
      id: body.id || createId("t"),
      name: body.name,
      email: body.email,
      phone: body.phone || "Chưa cập nhật",
      avatarUrl:
        body.avatarUrl ||
        "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=160&q=80",
      specialty: body.specialty || "Kỹ năng sống",
      active: body.active ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await appendSheetRow("Teachers", teacher);
    return NextResponse.json(teacher);
  } catch (error) {
    return apiError(error);
  }
}
