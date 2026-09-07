export type SchedulingParticipantUser = {
  teacherId?: string;
  role: string;
};

/**
 * Keeps teacher and assistant choices disjoint even when legacy Users rows point
 * to the same teacher profile. An active teacher role takes precedence over an
 * assistant role so stale duplicate rows cannot demote a teacher in scheduling.
 */
export function classifySchedulingParticipantIds(
  activeTeacherIds: string[],
  activeUsers: SchedulingParticipantUser[],
) {
  const teacherRoleIds = new Set(
    activeUsers
      .filter((user) => user.role === "teacher")
      .map((user) => String(user.teacherId || "").trim())
      .filter(Boolean),
  );
  const assistantRoleIds = new Set(
    activeUsers
      .filter((user) => user.role === "assistant")
      .map((user) => String(user.teacherId || "").trim())
      .filter(Boolean),
  );
  const assistantIds = new Set(
    activeTeacherIds.filter((teacherId) => assistantRoleIds.has(teacherId) && !teacherRoleIds.has(teacherId)),
  );
  const teacherIds = new Set(activeTeacherIds.filter((teacherId) => !assistantIds.has(teacherId)));

  return { teacherIds, assistantIds };
}
