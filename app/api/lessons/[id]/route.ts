import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { updateSheetRowById } from "@/lib/google-sheets";
import { normalizeLessonInput } from "@/lib/lessons";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.active === false) {
      patch.active = false;
    } else {
      Object.assign(patch, normalizeLessonInput(body));
      patch.active = body.active ?? true;
    }

    await updateSheetRowById("Lessons", id, patch);
    return NextResponse.json({ id, ...patch });
  } catch (error) {
    return apiError(error);
  }
}
