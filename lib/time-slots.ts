import type { TimeSlot } from "@/lib/types";

export type TimeSlotInput = {
  id?: string;
  label?: unknown;
  start?: unknown;
  end?: unknown;
  active?: unknown;
};

export const allowedTimeSlotDurations = [45, 90] as const;

export function normalizeTimeSlotInput(input: TimeSlotInput, fallback?: Partial<TimeSlot>) {
  const label = input.label !== undefined ? String(input.label || "").trim() : fallback?.label ?? "";
  const start = input.start !== undefined ? normalizeTimeValue(input.start) : fallback?.start ?? "";
  const end = input.end !== undefined ? normalizeTimeValue(input.end) : fallback?.end ?? "";
  const active = input.active !== undefined ? parseBoolean(input.active, true) : fallback?.active ?? true;
  const durationMinutes = getTimeSlotDurationMinutes(start, end);

  if (!label) {
    throw new Error("Tên khung giờ là bắt buộc.");
  }
  if (!start || !end) {
    throw new Error("Giờ bắt đầu và giờ kết thúc là bắt buộc.");
  }
  if (durationMinutes <= 0) {
    throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");
  }
  if (!allowedTimeSlotDurations.includes(durationMinutes as (typeof allowedTimeSlotDurations)[number])) {
    throw new Error("Khung giờ chỉ được kéo dài 45 phút hoặc 90 phút.");
  }

  return {
    label,
    start,
    end,
    active,
  };
}

export function getTimeSlotDurationMinutes(start: string, end: string) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null) {
    return 0;
  }
  return endMinutes - startMinutes;
}

export function isStandardTimeSlotDuration(start: string, end: string) {
  return allowedTimeSlotDurations.includes(
    getTimeSlotDurationMinutes(start, end) as (typeof allowedTimeSlotDurations)[number],
  );
}

export function normalizeTimeValue(value: unknown) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) {
    return "";
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === "PM" && hours < 12) {
    hours += 12;
  }
  if (meridiem === "AM" && hours === 12) {
    hours = 0;
  }

  if (hours > 23 || minutes > 59) {
    return "";
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function timeSlotDuplicateKey(slot: Pick<TimeSlot, "start" | "end">) {
  return `${slot.start}-${slot.end}`;
}

export function normalizeTimeSlotLabel(label: string) {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

export function timeToMinutes(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["false", "0", "no", "inactive", "off", "tat", "tắt", "xoa", "xóa"].includes(normalized)) {
    return false;
  }
  return ["true", "1", "yes", "active", "on", "bat", "bật"].includes(normalized) || fallback;
}
