import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { deleteSheetRowById, updateSheetRowById } from "@/lib/google-sheets";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const fileName = String(body.fileName || "").trim();

    if (!fileName) {
      throw new Error("Missing fileName.");
    }

    const updatedAt = new Date().toISOString();
    await updateSheetRowById("LessonPlans", id, {
      fileName,
      updatedAt,
    });

    return NextResponse.json({
      id,
      fileName,
      updatedAt,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    await deleteSheetRowById("LessonPlans", id);
    return NextResponse.json({ id, deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
