import type { ActivityAssignment, ActivityOccurrence, TeachingWorkLog } from "./types";

export function summarizeConfirmedWork(
  workLogs: TeachingWorkLog[],
  occurrences: ActivityOccurrence[],
  assignments: ActivityAssignment[],
) {
  const topicLogs = workLogs.filter((row) => row.activityTypeCode && row.status === "CONFIRMED");
  const occurrenceById = new Map(occurrences.map((row) => [row.id, row]));
  const seenWorkLogIds = new Set(topicLogs.map((row) => row.hrmWorkLogId).filter((id): id is string => Boolean(id)));
  const seenAssignmentIds = new Set<string>();
  const activityRows = assignments.flatMap((assignment) => {
    if (assignment.status !== "APPROVED" || assignment.integrationStatus !== "CONFIRMED" || seenAssignmentIds.has(assignment.id)) return [];
    const occurrence = occurrenceById.get(assignment.activityId);
    if (!occurrence || occurrence.status === "CANCELLED" || (assignment.hrmWorkLogId && seenWorkLogIds.has(assignment.hrmWorkLogId))) return [];
    seenAssignmentIds.add(assignment.id);
    if (assignment.hrmWorkLogId) seenWorkLogIds.add(assignment.hrmWorkLogId);
    return [{ assignment, occurrence }];
  });
  return {
    topicLogs,
    activityRows,
    count: topicLogs.length + activityRows.length,
    money: topicLogs.reduce((total, row) => total + (row.money || 0), 0)
      + activityRows.reduce((total, row) => total + (row.assignment.cashAmount || 0), 0),
    mcpPoints: topicLogs.reduce((total, row) => total + (row.mcpPoints || 0), 0)
      + activityRows.reduce((total, row) => total + (row.assignment.mcpPoints || 0), 0),
  };
}
