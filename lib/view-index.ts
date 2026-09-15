/** Preserve Array.find semantics (first match), including legacy duplicate IDs. */
export function indexById<T extends { id: string }>(rows: readonly T[]): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) if (!result.has(row.id)) result.set(row.id, row);
  return result;
}

/** Normalize searchable fields once per source change, not once per keystroke.
 * Keep the legacy Boolean/join/lowercase semantics (no accent stripping).
 */
export function buildTextSearchIndex<T>(rows: readonly T[], fields: (row: T) => (string | undefined)[]) {
  return rows.map((row) => ({ row, text: fields(row).filter(Boolean).join(" ").toLowerCase() }));
}

export function searchTextIndex<T>(entries: readonly { row: T; text: string }[], query: string, include?: (row: T) => boolean): T[] {
  const term = query.trim().toLowerCase();
  const result: T[] = [];
  for (const entry of entries) {
    if ((!include || include(entry.row)) && (!term || entry.text.includes(term))) result.push(entry.row);
  }
  return result;
}

export function groupByKey<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const row of rows) {
    const value = key(row);
    const group = result.get(value);
    if (group) group.push(row);
    else result.set(value, [row]);
  }
  return result;
}

/** Tuple encoding avoids collisions when source IDs contain punctuation. */
export function attendanceLookupKey(scheduleId: string, teacherId: string) {
  return JSON.stringify([scheduleId, teacherId]);
}

export function legacyScheduleGroupKey(schedule: {
  date: string; schoolId: string; classId: string; lessonId: string;
  timeSlotId: string; teachingEnvironment?: string;
}) {
  return JSON.stringify([schedule.date, schedule.schoolId, schedule.classId,
    schedule.lessonId, schedule.timeSlotId, schedule.teachingEnvironment]);
}
