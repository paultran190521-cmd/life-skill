import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { deleteSheetRowById, readSheetRows, updateSheetRowById } from "@/lib/google-sheets";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
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

    const patch = {
      schoolId,
      name,
      grade,
      academicYear,
      updatedAt: new Date().toISOString(),
    };

    await updateSheetRowById("Classes", id, patch);
    return NextResponse.json({ id, ...patch });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const schedules = await readSheetRows("Schedules");
    if (schedules.some((item) => item.classId === id && item.status !== "cancelled")) {
      return NextResponse.json(
        { error: "Không thể xóa lớp vì đang có lịch dạy liên quan." },
        { status: 400 },
      );
    }

    await deleteSheetRowById("Classes", id);
    return NextResponse.json({ id, deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
