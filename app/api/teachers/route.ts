import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { appendSheetRow, appendSheetRows, readSheetRows } from "@/lib/google-sheets";
import { getAvatarUrl } from "@/lib/avatar";

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
    const rawTeachers = Array.isArray(body?.teachers) ? body.teachers : Array.isArray(body) ? body : [body];
    const teachers = rawTeachers.map((item: Record<string, unknown>, index: number) => {
      const name = String(item.name || "").trim();
      const email = String(item.email || "")
        .trim()
        .toLowerCase();
      if (!name || !email) {
        throw new Error(`Dòng giáo viên ${index + 1} thiếu Họ tên hoặc Email.`);
      }

      return {
        id: String(item.id || createId("t")),
        name,
        email,
        phone: String(item.phone || "").trim() || "Chưa cập nhật",
        avatarUrl: String(item.avatarUrl || "").trim() || getAvatarUrl(email, name),
        specialty: String(item.specialty || "").trim() || "Kỹ năng sống",
        active: item.active ?? true,
        createdAt: now,
        updatedAt: now,
      };
    });

    if (teachers.length === 1) {
      await appendSheetRow("Teachers", teachers[0]);
      return NextResponse.json(teachers[0]);
    }

    await appendSheetRows("Teachers", teachers);
    return NextResponse.json({ teachers });
  } catch (error) {
    return apiError(error);
  }
}
