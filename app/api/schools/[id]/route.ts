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
    const name = String(body.name || "").trim();
    const district = String(body.district || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Tên trường là bắt buộc." }, { status: 400 });
    }

    const patch = {
      name,
      district: district || "Chưa cập nhật",
      updatedAt: new Date().toISOString(),
    };

    await updateSheetRowById("Schools", id, patch);
    return NextResponse.json({ id, ...patch });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const linkedClasses = await readSheetRows("Classes");
    if (linkedClasses.some((item) => item.schoolId === id)) {
      return NextResponse.json(
        { error: "Không thể xóa trường vì đang có lớp thuộc trường này." },
        { status: 400 },
      );
    }

    await deleteSheetRowById("Schools", id);
    return NextResponse.json({ id, deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
