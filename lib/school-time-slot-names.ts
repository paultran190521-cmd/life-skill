type Slot = { id: string; label: string; start: string; end: string; active?: boolean };

const schoolPrefixes: Record<string, string> = {
  "tân túc": "TT", tt: "TT", ntmk: "NTMK", nsg: "NSG", "tđ": "TĐ", td: "TĐ",
  tdtt: "TDTT", nktdtt: "TDTT", dvt: "DVT", "chi lăng": "CL", cl: "CL", pp: "PP",
};

function splitLabel(label: string) {
  const separator = label.indexOf(" - ");
  return separator < 0 ? null : { prefix: label.slice(0, separator), body: label.slice(separator + 3) };
}

/** Preserve slot IDs and clock ranges; change only the visible naming convention. */
export function canonicalSchoolTimeSlotLabel(slot: Slot, slots: Slot[]) {
  const parts = splitLabel(slot.label);
  if (!parts) return slot.label;
  const prefix = schoolPrefixes[parts.prefix.toLocaleLowerCase("vi")] || parts.prefix;
  const legacy = /^(Khung\s+(70|90|95)\s+phút\s+từ\s+\d{1,2}:\d{2})$/i.exec(parts.body);
  if (legacy) {
    const first = slots.find((candidate) => {
      const other = splitLabel(candidate.label);
      return other && (schoolPrefixes[other.prefix.toLocaleLowerCase("vi")] || other.prefix) === prefix &&
        candidate.start === slot.start && /^Tiết\s+\d+[SC]?\s*\(/i.test(other.body);
    });
    const firstBody = first && splitLabel(first.label)?.body;
    const period = firstBody && /^Tiết\s+(\d+)([SC])?/i.exec(firstBody);
    if (!period) return slot.label;
    const session = period[2]?.toUpperCase() || (slot.start < "12:00" ? "S" : "C");
    return `${prefix} - Tiết ${period[1]}, ${Number(period[1]) + 1}${session} (${legacy[2]}ph)`;
  }
  const explicit = /^(Cấp 2 - )?Tiết\s+(\d+)([SC])?(?:\s*,\s*(\d+)([SC])?)?\s*\(\s*(\d+)\s*(?:p|ph|phut|phút)\s*\)$/i.exec(parts.body);
  if (!explicit) return slot.label;
  const level = explicit[1] || "";
  const first = explicit[2];
  const second = explicit[4];
  const session = explicit[5]?.toUpperCase() || explicit[3]?.toUpperCase() || (slot.start < "12:00" ? "S" : "C");
  const period = second ? `${first}, ${second}${session}` : `${first}${slot.start < "12:00" ? "" : session}`;
  return `${prefix} - ${level}Tiết ${period} (${explicit[6]}${second ? "ph" : "p"})`;
}

/** Legacy paired frames remain schedulable after their descriptive labels are renamed. */
export function isNamedLegacyPairSlot(slot: Slot, slots: Slot[]) {
  const parts = splitLabel(slot.label);
  if (!parts) return false;
  const pair = /^(?:Cấp 2 - )?Tiết\s+(\d+)\s*,\s*(\d+)([SC])\s*\((90|95)ph\)$/i.exec(parts.body);
  if (!pair || Number(pair[2]) !== Number(pair[1]) + 1) return false;
  const start = Number(slot.start.slice(0, 2)) * 60 + Number(slot.start.slice(3, 5));
  const end = Number(slot.end.slice(0, 2)) * 60 + Number(slot.end.slice(3, 5));
  if (end - start !== Number(pair[4])) return false;
  const level = parts.body.startsWith("Cấp 2 - ") ? "Cấp 2 - " : "";
  return slots.some((candidate) => {
    const other = splitLabel(candidate.label);
    return other?.prefix === parts.prefix && candidate.start === slot.start &&
      new RegExp(`^${level}Tiết\\s+${pair[1]}(?:${pair[3]})?\\s*\\(`, "i").test(other.body);
  });
}
