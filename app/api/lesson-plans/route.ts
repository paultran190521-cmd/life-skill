import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { appendSheetRow } from "@/lib/google-sheets";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const lessonPlan = {
      id: body.id || createId("lp"),
      scheduleId: body.scheduleId,
      teacherId: body.teacherId,
      fileName: body.fileName,
      driveFileId: body.driveFileId || "",
      driveUrl: body.driveUrl || "",
      uploadedAt: body.uploadedAt || now,
      createdAt: now,
      updatedAt: now,
    };

    await appendSheetRow("LessonPlans", lessonPlan);
    return NextResponse.json(lessonPlan);
  } catch (error) {
    return apiError(error);
  }
}
