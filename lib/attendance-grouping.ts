export type AttendanceSession = "morning" | "afternoon";

type AttendanceGroupSchedule = {
  teacherId?: unknown;
  date?: unknown;
  schoolId?: unknown;
  timeSlotId?: unknown;
};

type AttendanceGroupSlot = { id?: unknown; start?: unknown };

export function attendanceSessionForStart(value: unknown): AttendanceSession | "" {
  const match = /^(\d{2}):([0-5]\d)$/.exec(String(value || "").trim());
  if (!match) return "";
  return Number(match[1]) < 12 ? "morning" : "afternoon";
}

export function attendanceGroupKey(schedule: AttendanceGroupSchedule, slots: AttendanceGroupSlot[]) {
  const slot = slots.find((item) => String(item.id || "") === String(schedule.timeSlotId || ""));
  const session = attendanceSessionForStart(slot?.start);
  if (!session) return "";
  return [schedule.teacherId, schedule.date, schedule.schoolId, session].map((part) => String(part || "").trim()).join("|");
}
