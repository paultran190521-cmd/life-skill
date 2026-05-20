import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { appendSheetRow, appendSheetRows, readSheetRows } from "@/lib/google-sheets";
import { normalizeLessonInput } from "@/lib/lessons";

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
    const isBulk = Array.isArray(body?.lessons) || Array.isArray(body);
    const rawLessons = Array.isArray(body?.lessons) ? body.lessons : Array.isArray(body) ? body : [body];
    const now = new Date().toISOString();

    const lessons = rawLessons.map((item: Record<string, unknown>, index: number) => ({
      id: typeof item.id === "string" && item.id ? item.id : createId("l"),
      ...normalizeLessonInput(item, index),
      active: item.active ?? true,
      createdAt: now,
      updatedAt: now,
    }));

    if (isBulk) {
      await appendSheetRows("Lessons", lessons);
      return NextResponse.json({ lessons });
    }

    await appendSheetRow("Lessons", lessons[0]);
    return NextResponse.json(lessons[0]);
  } catch (error) {
    return apiError(error);
  }
}
