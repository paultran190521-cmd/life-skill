import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { appendSheetRow, readSheetRows } from "@/lib/google-sheets";

export async function GET() {
  try {
    return NextResponse.json(await readSheetRows("Classes"));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const schoolId = String(body.schoolId || "").trim();
    const name = String(body.name || "").trim();
    const grade = String(body.grade || "").trim();
    const academicYear = String(body.academicYear || "").trim();

    if (!schoolId || !name || !grade) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc của lớp." }, { status: 400 });
    }

    const schools = await readSheetRows("Schools");
    if (!schools.some((school) => school.id === schoolId)) {
      return NextResponse.json({ error: "Trường đã chọn không tồn tại." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const classRoom = {
      id: body.id || createId("c"),
      schoolId,
      name,
      grade,
      academicYear,
      createdAt: now,
      updatedAt: now,
    };

    await appendSheetRow("Classes", classRoom);
    return NextResponse.json(classRoom);
  } catch (error) {
    return apiError(error);
  }
}
