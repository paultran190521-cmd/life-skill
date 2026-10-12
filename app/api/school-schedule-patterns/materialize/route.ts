import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { appendSheetRows, ensureSheetHeaders, readSheetRowsBatch, schoolSchedulePatternHeaders, schoolTeachingNeedHeaders, updateSheetRowsById } from "@/lib/google-sheets";
import { requireSessionUser } from "@/lib/route-auth";
import { mondayDateKey, planPatternMaterialization } from "@/lib/school-schedule-patterns";
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
    const plan = planPatternMaterialization(patterns, needs, schoolId, weekStart);
    if (plan.conflicts.length) return apiFailure(409, "Lịch nền mới trùng với lịch đã có trong tuần. Hãy xử lý các dòng trùng trước khi tải lại.", undefined, requestId);
    const now = new Date().toISOString();
    const editorName = user.name?.trim() || user.email || user.id;
    const newRows: SchoolTeachingNeed[] = plan.creates.map((row) => ({ ...row, id: createId("need"), status: "OPEN", createdAt: now, updatedAt: now, lastEditedAt: now, lastEditedBy: editorName }));
    const updates = plan.updates.map(({ target, row, status }) => ({ id: target.id, patch: { ...row, id: target.id, status, updatedAt: now, lastEditedAt: now, lastEditedBy: editorName } }));
    const retirements = plan.retirements.map(({ target, status }) => ({ id: target.id, patch: { status, sourceStatus: "Trường hủy tiết", updatedAt: now, lastEditedAt: now, lastEditedBy: editorName } }));
    if (newRows.length) await appendSheetRows("SchoolTeachingNeeds", newRows);
    if (updates.length || retirements.length) await updateSheetRowsById("SchoolTeachingNeeds", [...updates, ...retirements]);
    if (newRows.length || updates.length || retirements.length) await appendAuditLog({ requestId, actor: user, action: "school_schedule_pattern.materialize_week", entityType: "SchoolTeachingNeed", entityId: `${schoolId}:${weekStart}`, route: "/api/school-schedule-patterns/materialize", method: "POST", authMode: "enforce", decision: "allow", reason: "admin", source, after: { candidateCount: plan.candidateCount, createdCount: newRows.length, updatedCount: updates.length, retiredCount: retirements.length, skippedCount: plan.skippedCount } });
    const updatedById = new Map([...updates, ...retirements].map((item) => [item.id, item.patch]));
    const weekEnd = new Date(`${weekStart}T00:00:00Z`);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    const weekEndKey = weekEnd.toISOString().slice(0, 10);
    const weekNeeds = [...needs.map((row) => ({ ...row, ...(updatedById.get(row.id) || {}) })), ...newRows]
      .filter((row) => row.schoolId === schoolId && row.date >= weekStart && row.date <= weekEndKey);
    return NextResponse.json({ weekStart, candidateCount: plan.candidateCount, createdCount: newRows.length, updatedCount: updates.length, retiredCount: retirements.length, skippedCount: plan.skippedCount, reviewCount: [...updates, ...retirements].filter((item) => item.patch.status === "REVIEW").length, needs: weekNeeds });
  } catch (error) { return apiError(error, requestId); }
}
