import type { TimeSlot } from "@/lib/types";

export type TimeSlotInput = {
  id?: string;
  label?: unknown;
  start?: unknown;
  end?: unknown;
  active?: unknown;
};

/**
 * Khung giờ linh hoạt: tối thiểu 15 phút, tối đa 240 phút, bội số 5.
 * (Trước đây chỉ cho phép 45 hoặc 90 phút.)
 */
export const MIN_TIME_SLOT_MINUTES = 15;
export const MAX_TIME_SLOT_MINUTES = 240;
export const TIME_SLOT_STEP_MINUTES = 5;

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
  if (durationMinutes < MIN_TIME_SLOT_MINUTES) {
    throw new Error(`Khung giờ phải kéo dài ít nhất ${MIN_TIME_SLOT_MINUTES} phút.`);
  }
  if (durationMinutes > MAX_TIME_SLOT_MINUTES) {
    throw new Error(`Khung giờ không được dài quá ${MAX_TIME_SLOT_MINUTES} phút.`);
  }
  if (durationMinutes % TIME_SLOT_STEP_MINUTES !== 0) {
    throw new Error(`Thời lượng khung giờ phải là bội số của ${TIME_SLOT_STEP_MINUTES} phút.`);
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

export function isValidTimeSlotDuration(start: string, end: string) {
  const d = getTimeSlotDurationMinutes(start, end);
  return d >= MIN_TIME_SLOT_MINUTES && d <= MAX_TIME_SLOT_MINUTES && d % TIME_SLOT_STEP_MINUTES === 0;
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
  return label
    .trim()
    // Duration annotations are display metadata, not part of a slot's identity.
    // This lets an import such as "NSG - Tiết 1 (45p)" overwrite the former
    // "NSG - Tiết 1 (35p)" instead of creating a duplicate time slot.
    .replace(/\s*\(\s*\d+\s*(?:p|phut|phút)\s*\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
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
