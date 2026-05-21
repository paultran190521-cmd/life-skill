import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { appendSheetRow } from "@/lib/google-sheets";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const scheduleId = String(body.scheduleId || "");
    const teacherId = String(body.teacherId || "");
    const fileName = String(body.fileName || "");
    const driveFileId = String(body.driveFileId || "");
    const driveUrl = String(body.driveUrl || "");

    if (!scheduleId || !teacherId) {
      throw new Error("Missing scheduleId or teacherId.");
    }
    if (!fileName || !driveFileId || !driveUrl) {
      throw new Error("Missing Google Drive file metadata.");
    }

    const now = new Date().toISOString();
    const lessonPlan = {
      id: createId("lp"),
      scheduleId,
      teacherId,
      fileName,
      driveFileId,
      driveUrl,
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
