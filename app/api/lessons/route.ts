import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { appendSheetRow, readSheetRows } from "@/lib/google-sheets";

export async function GET() {
  try {
    return NextResponse.json(await readSheetRows("Lessons"));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const lesson = {
      id: body.id || createId("l"),
      grade: body.grade,
      title: body.title,
      objective: body.objective,
      durationMinutes: body.durationMinutes || 35,
      active: body.active ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await appendSheetRow("Lessons", lesson);
    return NextResponse.json(lesson);
  } catch (error) {
    return apiError(error);
  }
}
