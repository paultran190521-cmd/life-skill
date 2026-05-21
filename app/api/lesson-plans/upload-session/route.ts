import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { createLessonPlanUploadSession } from "@/lib/google-drive";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const scheduleId = String(body.scheduleId || "");
    const fileName = String(body.fileName || "");
    const mimeType = String(body.mimeType || "application/octet-stream");
    const fileSize = Number(body.fileSize || 0);

    if (!scheduleId || !fileName || !fileSize) {
      throw new Error("Missing scheduleId, fileName, or fileSize.");
    }

    return NextResponse.json(
      await createLessonPlanUploadSession({
        scheduleId,
        fileName,
        mimeType,
        fileSize,
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}
