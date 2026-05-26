import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { appendSheetRow, appendSheetRows, readSheetRows } from "@/lib/google-sheets";
import { normalizeTimeSlotInput, normalizeTimeSlotLabel, timeSlotDuplicateKey } from "@/lib/time-slots";

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
    const rawSlots = Array.isArray(body?.timeSlots) ? body.timeSlots : Array.isArray(body) ? body : [body];
    const existingSlots = await readSheetRows("TimeSlots");
    const existingLabels = new Set(
      existingSlots.map((slot) => normalizeTimeSlotLabel(String(slot.label || ""))).filter(Boolean),
    );
    const existingTimes = new Set(
      existingSlots
        .map((slot) => timeSlotDuplicateKey({ start: String(slot.start || ""), end: String(slot.end || "") }))
        .filter((key) => key !== "-"),
    );

    const seenLabels = new Set<string>();
    const seenTimes = new Set<string>();
    const timeSlots = rawSlots.map((item: Record<string, unknown>, index: number) => {
      const normalized = normalizeTimeSlotInput(item);
      const labelKey = normalizeTimeSlotLabel(normalized.label);
      const timeKey = timeSlotDuplicateKey(normalized);

      if (existingLabels.has(labelKey) || seenLabels.has(labelKey)) {
        throw new Error(`Dòng khung giờ ${index + 1} bị trùng tên.`);
      }
      if (existingTimes.has(timeKey) || seenTimes.has(timeKey)) {
        throw new Error(`Dòng khung giờ ${index + 1} bị trùng giờ bắt đầu/kết thúc.`);
      }

      seenLabels.add(labelKey);
      seenTimes.add(timeKey);

      return {
        id: String(item.id || createId("ts")),
        ...normalized,
        createdAt: now,
        updatedAt: now,
      };
    });

    if (timeSlots.length === 1) {
      await appendSheetRow("TimeSlots", timeSlots[0]);
      return NextResponse.json(timeSlots[0]);
    }

    await appendSheetRows("TimeSlots", timeSlots);
    return NextResponse.json({ timeSlots });
  } catch (error) {
    return apiError(error);
  }
}
