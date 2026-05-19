import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { appendSheetRow, readSheetRows } from "@/lib/google-sheets";
import type { Schedule } from "@/lib/types";

export async function GET() {
  try {
    return NextResponse.json(await readSheetRows("Schedules"));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const teacherIds = Array.isArray(body.teacherIds) ? body.teacherIds : [body.teacherId].filter(Boolean);

    const schedules: Schedule[] = teacherIds.map((teacherId: string) => ({
      id: createId("sch"),
      date: body.date,
      teacherId,
      schoolId: body.schoolId,
      classId: body.classId,
      lessonId: body.lessonId,
      timeSlotId: body.timeSlotId,
      status: "sent",
      sentAt: now,
    }));

    await Promise.all(
      schedules.map((schedule) =>
        appendSheetRow("Schedules", {
          ...schedule,
          createdBy: body.createdBy || "u-admin",
          createdAt: now,
          updatedAt: now,
        }),
      ),
    );

    return NextResponse.json({ schedules });
  } catch (error) {
    return apiError(error);
  }
}
