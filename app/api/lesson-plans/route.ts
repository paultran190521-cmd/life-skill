import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { uploadLessonPlanToDrive } from "@/lib/google-drive";
import { appendSheetRow } from "@/lib/google-sheets";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const scheduleId = String(formData.get("scheduleId") || "");
    const teacherId = String(formData.get("teacherId") || "");

    if (!(file instanceof File)) {
      throw new Error("Missing lesson plan file.");
    }
    if (!scheduleId || !teacherId) {
      throw new Error("Missing scheduleId or teacherId.");
    }

    const now = new Date().toISOString();
    const upload = await uploadLessonPlanToDrive({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer: Buffer.from(await file.arrayBuffer()),
      scheduleId,
    });
    const lessonPlan = {
      id: createId("lp"),
      scheduleId,
      teacherId,
      fileName: file.name,
      driveFileId: upload.driveFileId,
      driveUrl: upload.driveUrl,
      uploadedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await appendSheetRow("LessonPlans", lessonPlan);
    return NextResponse.json(lessonPlan);
  } catch (error) {
    return apiError(error);
  }
}
