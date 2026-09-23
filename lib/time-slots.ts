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

/**
 * Normalized text used to compare school names and the school prefix stored
 * in a time-slot label. TimeSlots predate a `schoolId` column, so ownership
 * is deliberately derived from their required "School - period" label.
 */
export function normalizeTimeSlotComparableText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function schoolTimeSlotKeys(schoolName: unknown) {
  const normalized = normalizeTimeSlotComparableText(schoolName)
    .replace(/^(truong\s+)?(thpt|thcs|th)\s+/, "")
    .trim();
  const aliases: Record<string, string[]> = {
    "nguyen thi minh khai": ["ntmk"],
    "tan tuc": ["tt"],
    "phong phu": ["pp"],
    "pt nk tdtt binh chanh": ["nktdtt"],
    "chi lang": ["cl"],
    "nam sai gon": ["nsg"],
    "duong van thi": ["dvt"],
    "thu duc": ["td"],
  };
  return new Set([normalized, ...(aliases[normalized] ?? [])].filter(Boolean));
}

export function timeSlotSchoolPrefix(label: unknown) {
  const text = String(label || "");
  const dashIndex = text.indexOf(" - ");
  return dashIndex === -1 ? "" : normalizeTimeSlotComparableText(text.slice(0, dashIndex));
}

/** A slot with no school prefix is legacy/ambiguous and is never schedulable. */
export function timeSlotBelongsToSchool(slot: Pick<TimeSlot, "label">, schoolName: unknown) {
  const prefix = timeSlotSchoolPrefix(slot.label);
  if (!prefix) return false;
  const keys = schoolTimeSlotKeys(schoolName);
  return keys.has(prefix);
}

export function isDoubleTeachingTimeSlot(slot: Pick<TimeSlot, "label" | "start" | "end">) {
  const label = normalizeTimeSlotComparableText(slot.label);
  const explicitPair = /\btiet\s*\d+\s*,\s*(?:tiet\s*)?\d+\s*[sc]?\b/.test(label);
  const namedDoubleFrame = /\bkhung\s*(?:70|90|95)\s*phut\b/.test(label);
  return explicitPair || namedDoubleFrame;
}

/**
 * Returns whether an active slot can be used for a new schedule at this
 * school. Historical schedules remain readable even when a rule changes.
 */
export function isTimeSlotAllowedForSchool(
  slot: Pick<TimeSlot, "label" | "start" | "end">,
  schoolName: unknown,
) {
  if (!timeSlotBelongsToSchool(slot, schoolName)) return false;

  const school = normalizeTimeSlotComparableText(schoolName);
  const duration = getTimeSlotDurationMinutes(slot.start, slot.end);
  const isDouble = isDoubleTeachingTimeSlot(slot);
  if (school.includes("tan tuc")) return !isDouble && duration === 45;
  if (school.includes("thu duc")) {
    if (!isDouble || duration !== 90) return false;
    // The former 14:45–16:15 frame is retained for existing schedules but is
    // replaced for new assignments by the explicitly requested 14:50–16:20.
    if (normalizeTimeValue(slot.start) === "14:45" && normalizeTimeValue(slot.end) === "16:15") return false;
    return true;
  }
  return true;
}

/** The approved custom Thủ Đức 3–4C double period does not follow legacy single-slot boundaries. */
export function isConfiguredThuDucThreeFourSlot(slot: Pick<TimeSlot, "label" | "start" | "end">) {
  const label = normalizeTimeSlotComparableText(slot.label);
  return (
    /^(td|thu duc)\s*-\s*tiet\s*3\s*,\s*4c(?:\s*\(\s*90\s*(?:p|phut)\s*\))?$/.test(label) &&
    normalizeTimeValue(slot.start) === "14:50" &&
    normalizeTimeValue(slot.end) === "16:20" &&
    getTimeSlotDurationMinutes(slot.start, slot.end) === 90
  );
}

export function timeSlotsAllowedForSchool<T extends Pick<TimeSlot, "label" | "start" | "end">>(
  slots: T[],
  schoolName: unknown,
) {
  return slots.filter((slot) => isTimeSlotAllowedForSchool(slot, schoolName));
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
