import { availabilityTimeRangeKey, isTeacherAvailableForSlot } from "./teacher-availability";
import type { Schedule, SchoolTeachingNeed, TeacherAvailability, TimeSlot } from "./types";

type Draft = { schoolNeedIds?: string[]; teacherIds: string[]; timeSlotId: string };
type Unit = { needs: SchoolTeachingNeed[]; date: string; start: string; end: string; slot: TimeSlot };
type Booking = { teacherId: string; date: string; start: string; end: string };

export type SchoolWeekStaffing = {
  periodCount: number;
  coveredPeriods: number;
  pendingPeriods: number;
  requiredAssignments: number;
  coverableAssignments: number;
  missingAssignments: number;
  mergeablePairs: number;
  registeredTeachers: number;
  reviewCount: number;
  uncertain: boolean;
  firstGap?: { date: string; start: string; end: string; classIds: string[] };
};

const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) =>
  a.start < b.end && b.start < a.end;

/** One teacher covers one assignment at a time. A valid double period is one assignment. */
export function assessSchoolWeekStaffing(input: {
  needs: SchoolTeachingNeed[];
  drafts: Draft[];
  teachers: Array<{ id: string }>;
  availability: TeacherAvailability[];
  schedules: Schedule[];
  slots: TimeSlot[];
  canMerge: (first: SchoolTeachingNeed, second: SchoolTeachingNeed) => TimeSlot | null;
}): SchoolWeekStaffing {
  const { needs, drafts, teachers, availability, schedules, slots, canMerge } = input;
  const active = needs.filter((need) => need.status !== "CANCELLED");
  const byId = new Map(active.map((need) => [need.id, need]));
  const selected = new Set(drafts.filter((draft) => draft.teacherIds.length > 0).flatMap((draft) => draft.schoolNeedIds || []));
  const pending = active.filter((need) => need.status === "OPEN" && !need.scheduleId && !selected.has(need.id));
  const pendingIds = new Set(pending.map((need) => need.id));
  const used = new Set<string>();
  const units: Unit[] = [];
  let mergeablePairs = 0;
  const unitFor = (parts: SchoolTeachingNeed[], preferred?: TimeSlot | null): Unit => {
    const start = parts.map((need) => need.start).sort()[0];
    const end = parts.map((need) => need.end).sort().at(-1)!;
    const slot = preferred || slots.find((item) => item.active !== false && item.start === start && item.end === end) ||
      { id: availabilityTimeRangeKey({ start, end }), label: start + "–" + end, start, end };
    return { needs: parts, date: parts[0].date, start, end, slot };
  };
  for (const draft of drafts) {
    const parts = (draft.schoolNeedIds || []).map((id) => byId.get(id))
      .filter((need): need is SchoolTeachingNeed => Boolean(need && pendingIds.has(need.id) && !used.has(need.id)));
    if (parts.length !== 2 || parts.length !== draft.schoolNeedIds?.length) continue;
    parts.sort((a, b) => a.start.localeCompare(b.start));
    const slot = canMerge(parts[0], parts[1]);
    if (!slot) continue;
    units.push(unitFor(parts, slot));
    parts.forEach((need) => used.add(need.id));
    mergeablePairs++;
  }
  const remaining = pending.slice().sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.classId.localeCompare(b.classId));
  for (const need of remaining) {
    if (used.has(need.id)) continue;
    const partner = remaining.find((other) => {
      if (used.has(other.id) || other.id === need.id) return false;
      const mergeSlot = canMerge(need, other);
      return Boolean(mergeSlot && teachers.some((teacher) => isTeacherAvailableForSlot(availability, teacher.id, need.date, mergeSlot)));
    });
    const slot = partner ? canMerge(need, partner) : null;
    const parts = partner && slot ? [need, partner] : [need];
    units.push(unitFor(parts, slot));
    parts.forEach((part) => used.add(part.id));
    if (partner && slot) mergeablePairs++;
  }

  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const bookings: Booking[] = schedules.filter((schedule) => schedule.status !== "draft" && schedule.status !== "cancelled")
    .flatMap((schedule) => {
      const slot = slotById.get(schedule.timeSlotId);
      return slot ? [{ teacherId: schedule.teacherId, date: schedule.date, start: slot.start, end: slot.end }] : [];
    });
  for (const draft of drafts.filter((item) => item.teacherIds.length > 0)) {
    const parts = (draft.schoolNeedIds || []).map((id) => byId.get(id)).filter((need): need is SchoolTeachingNeed => Boolean(need));
    if (!parts.length) continue;
    const slot = slotById.get(draft.timeSlotId);
    const start = slot?.start || parts.map((need) => need.start).sort()[0];
    const end = slot?.end || parts.map((need) => need.end).sort().at(-1)!;
    for (const teacherId of draft.teacherIds) bookings.push({ teacherId, date: parts[0].date, start, end });
  }
  const eligibleIds = new Set(teachers.map((teacher) => teacher.id));
  const weekDates = new Set(active.map((need) => need.date));
  const registeredTeachers = new Set(availability.filter((entry) =>
    entry.status === "available" && eligibleIds.has(entry.teacherId) && weekDates.has(entry.date)).map((entry) => entry.teacherId)).size;
  const candidates = units.map((unit) => teachers.filter((teacher) =>
    isTeacherAvailableForSlot(availability, teacher.id, unit.date, unit.slot) &&
    !bookings.some((booking) => booking.teacherId === teacher.id && booking.date === unit.date && overlaps(booking, unit)),
  ).map((teacher) => teacher.id));

  let coverableAssignments = 0;
  let uncertain = false;
  let firstGap: SchoolWeekStaffing["firstGap"];
  const dates = new Map<string, number[]>();
  units.forEach((unit, index) => dates.set(unit.date, [...(dates.get(unit.date) || []), index]));
  for (const indices of dates.values()) {
    const order = indices.sort((a, b) => candidates[a].length - candidates[b].length || units[a].start.localeCompare(units[b].start));
    const chosen = new Map<string, number[]>();
    const covered = new Set<number>();
    let best = 0;
    let bestSet = new Set<number>();
    let nodes = 0;
    const search = (position: number) => {
      if (best === order.length || covered.size + order.length - position <= best) return;
      if (++nodes > 100_000) { uncertain = true; return; }
      if (position === order.length) {
        if (covered.size > best) { best = covered.size; bestSet = new Set(covered); }
        return;
      }
      const index = order[position];
      for (const teacherId of candidates[index]) {
        const prior = chosen.get(teacherId) || [];
        if (prior.some((other) => overlaps(units[index], units[other]))) continue;
        chosen.set(teacherId, [...prior, index]);
        covered.add(index);
        search(position + 1);
        covered.delete(index);
        if (prior.length) chosen.set(teacherId, prior); else chosen.delete(teacherId);
        if (best === order.length || uncertain) return;
      }
      search(position + 1);
    };
    search(0);
    coverableAssignments += best;
    if (!firstGap && best < order.length) {
      const gap = units[order.find((index) => !bestSet.has(index))!];
      firstGap = { date: gap.date, start: gap.start, end: gap.end, classIds: [...new Set(gap.needs.map((need) => need.classId))] };
    }
  }
  return {
    periodCount: active.length,
    coveredPeriods: active.filter((need) => need.status === "ASSIGNED" && Boolean(need.scheduleId) || selected.has(need.id)).length,
    pendingPeriods: pending.length,
    requiredAssignments: units.length,
    coverableAssignments,
    missingAssignments: units.length - coverableAssignments,
    mergeablePairs,
    registeredTeachers,
    reviewCount: active.filter((need) => need.status === "REVIEW").length,
    uncertain,
    firstGap,
  };
}
