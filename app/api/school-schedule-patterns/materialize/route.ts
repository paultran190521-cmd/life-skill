import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { appendSheetRows, ensureSheetHeaders, readSheetRowsBatch, schoolSchedulePatternHeaders, schoolTeachingNeedHeaders } from "@/lib/google-sheets";
import { requireSessionUser } from "@/lib/route-auth";
import { materializePatternNeed, mondayDateKey } from "@/lib/school-schedule-patterns";
import { schoolNeedIdentity } from "@/lib/school-teaching-needs";
import type { SchoolSchedulePattern, SchoolTeachingNeed } from "@/lib/types";

export async function POST(request: Request) {
  const requestId = createRequestId("school-schedule-pattern-materialize");
  try {
    const { user, source } = await requireSessionUser(request, { allowHeaderFallback: false });
    if (user.role !== "admin") return apiFailure(403, "Chỉ quản trị được tạo lịch tuần từ lịch nền.", undefined, requestId);
    const body = await request.json() as { schoolId?: string; weekStart?: string };
    const schoolId = String(body.schoolId || "").trim();
    let weekStart = "";
    try { weekStart = mondayDateKey(String(body.weekStart || "")); } catch (error) { return apiFailure(400, error instanceof Error ? error.message : "Tuần không hợp lệ.", undefined, requestId); }
    if (!schoolId) return apiFailure(400, "Hãy chọn trường trước khi tạo lịch tuần.", undefined, requestId);
    await Promise.all([ensureSheetHeaders("SchoolSchedulePatterns", schoolSchedulePatternHeaders), ensureSheetHeaders("SchoolTeachingNeeds", schoolTeachingNeedHeaders)]);
    const rows = await readSheetRowsBatch(["SchoolSchedulePatterns", "SchoolTeachingNeeds"] as const);
    const patterns = rows.SchoolSchedulePatterns as unknown as SchoolSchedulePattern[];
    const needs = rows.SchoolTeachingNeeds as unknown as SchoolTeachingNeed[];
    const candidates = patterns.filter((pattern) => pattern.status === "ACTIVE" && pattern.schoolId === schoolId).map((pattern) => ({ pattern, row: materializePatternNeed(pattern, weekStart) })).filter((item): item is { pattern: SchoolSchedulePattern; row: NonNullable<ReturnType<typeof materializePatternNeed>> } => Boolean(item.row));
    const existingByPatternDate = new Set(needs.map((need) => `${need.patternId || ""}|${need.date}`));
    const existingByIdentity = new Set(needs.map((need) => schoolNeedIdentity(need)));
    const now = new Date().toISOString();
    const newRows: SchoolTeachingNeed[] = candidates.filter(({ pattern, row }) => !existingByPatternDate.has(`${pattern.id}|${row.date}`) && !existingByIdentity.has(schoolNeedIdentity(row))).map(({ row }) => ({ ...row, id: createId("need"), status: "OPEN", createdAt: now, updatedAt: now, lastEditedAt: now, lastEditedBy: user.name?.trim() || user.email || user.id }));
    if (newRows.length) await appendSheetRows("SchoolTeachingNeeds", newRows);
    await appendAuditLog({ requestId, actor: user, action: "school_schedule_pattern.materialize_week", entityType: "SchoolTeachingNeed", entityId: `${schoolId}:${weekStart}`, route: "/api/school-schedule-patterns/materialize", method: "POST", authMode: "enforce", decision: "allow", reason: "admin", source, after: { candidateCount: candidates.length, createdCount: newRows.length } });
    return NextResponse.json({ weekStart, candidateCount: candidates.length, createdCount: newRows.length, needs: newRows });
  } catch (error) { return apiError(error, requestId); }
}
