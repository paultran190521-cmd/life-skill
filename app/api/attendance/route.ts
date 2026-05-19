import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { appendSheetRow } from "@/lib/google-sheets";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const attendance = {
      id: body.id || createId("att"),
      scheduleId: body.scheduleId,
      teacherId: body.teacherId,
      checkedInAt: body.checkedInAt || now,
      note: body.note || "",
      createdAt: now,
      updatedAt: now,
    };

    await appendSheetRow("Attendance", attendance);
    return NextResponse.json(attendance);
  } catch (error) {
    return apiError(error);
  }
}
