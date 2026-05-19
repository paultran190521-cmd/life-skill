import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { appendSheetRow, readSheetRows } from "@/lib/google-sheets";

export async function GET() {
  try {
    return NextResponse.json(await readSheetRows("TimeSlots"));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const timeSlot = {
      id: body.id || createId("ts"),
      label: body.label,
      start: body.start,
      end: body.end,
      active: body.active ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await appendSheetRow("TimeSlots", timeSlot);
    return NextResponse.json(timeSlot);
  } catch (error) {
    return apiError(error);
  }
}
