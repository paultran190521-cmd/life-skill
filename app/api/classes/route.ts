import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { appendSheetRow, appendSheetRows, readSheetRows } from "@/lib/google-sheets";

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
    const namesInput = String(body.names || "").trim();
    const rawNames = namesInput || name;
    const academicYear = String(body.academicYear || "").trim();
    const manualGrade = String(body.grade || "").trim();

    if (!schoolId || !rawNames) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc của lớp." }, { status: 400 });
    }

    const schools = await readSheetRows("Schools");
    if (!schools.some((school) => school.id === schoolId)) {
      return NextResponse.json({ error: "Trường đã chọn không tồn tại." }, { status: 400 });
    }

    const names = rawNames
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (names.length === 0) {
      return NextResponse.json({ error: "Vui lòng nhập ít nhất một tên lớp." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const classes = names.map((className, index) => ({
      id: index === 0 && body.id ? body.id : createId("c"),
      schoolId,
      name: className,
      grade: inferGradeFromClassName(className, manualGrade),
      academicYear,
      createdAt: now,
      updatedAt: now,
    }));

    if (classes.length === 1) {
      await appendSheetRow("Classes", classes[0]);
      return NextResponse.json(classes[0]);
    }

    await appendSheetRows("Classes", classes);
    return NextResponse.json({ classes });
  } catch (error) {
    return apiError(error);
  }
}

function inferGradeFromClassName(className: string, fallbackGrade: string) {
  const matched = className.match(/\d{1,2}/);
  if (!matched) {
    return fallbackGrade || "Chưa cập nhật";
  }

  const gradeNumber = Number(matched[0]);
  if (!Number.isFinite(gradeNumber) || gradeNumber <= 0) {
    return fallbackGrade || "Chưa cập nhật";
  }

  return `Khối ${gradeNumber}`;
}
