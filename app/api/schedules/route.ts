import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { sendScheduleEmail } from "@/lib/email";
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

    const emailResults = await sendScheduleEmails(schedules);

    return NextResponse.json({ schedules, emailResults });
  } catch (error) {
    return apiError(error);
  }
}

async function sendScheduleEmails(schedules: Schedule[]) {
  const [teachers, schools, classes, lessons, slots] = await Promise.all([
    readSheetRows("Teachers"),
    readSheetRows("Schools"),
    readSheetRows("Classes"),
    readSheetRows("Lessons"),
    readSheetRows("TimeSlots"),
  ]);

  return Promise.all(
    schedules.map(async (schedule) => {
      const result = await sendScheduleEmail({
        schedule,
        teacher: teachers.find((teacher) => teacher.id === schedule.teacherId) || {},
        school: schools.find((school) => school.id === schedule.schoolId),
        classRoom: classes.find((classRoom) => classRoom.id === schedule.classId),
        lesson: lessons.find((lesson) => lesson.id === schedule.lessonId),
        slot: slots.find((slot) => slot.id === schedule.timeSlotId),
      });

      return {
        scheduleId: schedule.id,
        teacherId: schedule.teacherId,
        ...result,
      };
    }),
  );
}
