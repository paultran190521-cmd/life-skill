import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { readSheetRows, updateSheetRowById } from "@/lib/google-sheets";
import { normalizeTimeSlotInput, normalizeTimeSlotLabel, timeSlotDuplicateKey } from "@/lib/time-slots";
import type { TimeSlot } from "@/lib/types";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const slots = await readSheetRows("TimeSlots");
    const currentSlot = slots.find((item) => String(item.id || "").trim() === id);

    if (!currentSlot) {
      return NextResponse.json({ error: "Không tìm thấy khung giờ." }, { status: 404 });
    }

    const fallback: Partial<TimeSlot> = {
      label: String(currentSlot.label || "").trim(),
      start: String(currentSlot.start || "").trim(),
      end: String(currentSlot.end || "").trim(),
      active: parseBoolean(currentSlot.active, true),
    };

    const onlyStatusChange =
      body.active !== undefined && body.label === undefined && body.start === undefined && body.end === undefined;
    if (onlyStatusChange) {
      const patch = {
        active: parseBoolean(body.active, fallback.active ?? true),
        updatedAt: new Date().toISOString(),
      };
      await updateSheetRowById("TimeSlots", id, patch);
      return NextResponse.json({ id, ...fallback, ...patch });
    }

    const normalized = normalizeTimeSlotInput(body, fallback);
    const labelKey = normalizeTimeSlotLabel(normalized.label);
    const timeKey = timeSlotDuplicateKey(normalized);

    const duplicated = slots.some((slot) => {
      const slotId = String(slot.id || "").trim();
      if (slotId === id) {
        return false;
      }
      const sameLabel = normalizeTimeSlotLabel(String(slot.label || "")) === labelKey;
      const sameTime =
        timeSlotDuplicateKey({ start: String(slot.start || ""), end: String(slot.end || "") }) === timeKey;
      return sameLabel || sameTime;
    });

    if (duplicated) {
      return NextResponse.json({ error: "Khung giờ bị trùng tên hoặc trùng giờ bắt đầu/kết thúc." }, { status: 400 });
    }

    const patch = {
      ...normalized,
      updatedAt: new Date().toISOString(),
    };

    await updateSheetRowById("TimeSlots", id, patch);
    return NextResponse.json({ id, ...patch });
  } catch (error) {
    return apiError(error);
  }
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["false", "0", "no", "inactive", "off", "tat", "tắt"].includes(normalized)) {
    return false;
  }
  return ["true", "1", "yes", "active", "on", "bat", "bật"].includes(normalized) || fallback;
}
