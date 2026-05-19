import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { updateSheetRowById } from "@/lib/google-sheets";
import type { ScheduleStatus } from "@/lib/types";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const now = new Date().toISOString();
    const status = body.status as ScheduleStatus;
    const patch: Record<string, unknown> = {
      status,
      updatedAt: now,
    };

    if (body.teacherId !== undefined) {
      patch.teacherId = body.teacherId;
    }
    if (body.reassignedFrom !== undefined) {
      patch.reassignedFrom = body.reassignedFrom;
    }
    if (status === "confirmed") {
      patch.confirmedAt = now;
    }
    if (status === "cancelled") {
      patch.cancelledAt = now;
    }

    await updateSheetRowById("Schedules", id, patch);

    return NextResponse.json({ id, ...body, updatedAt: now });
  } catch (error) {
    return apiError(error);
  }
}
