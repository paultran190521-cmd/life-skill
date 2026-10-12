import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { appendSheetRows, ensureSheetHeaders, readSheetRowsBatch, schoolSchedulePatternHeaders, schoolTeachingNeedHeaders, updateSheetRowsById } from "@/lib/google-sheets";
import { requireSessionUser } from "@/lib/route-auth";
import { findSchoolSchedulePatternImportConflicts, normalizeSchoolSchedulePattern, planPatternMaterializationRange, planSchoolSchedulePatternBatchSnapshot, planSchoolSchedulePatternImport, planSchoolSchedulePatternSnapshot, schoolScheduleImportChecksum, schoolSchedulePatternIdentity, type SchoolSchedulePatternInput } from "@/lib/school-schedule-patterns";
import { fixedBaselineSchoolLabels, type FixedBaselineScope } from "@/lib/school-schedule-baseline-upload";
import type { ClassRoom, School, SchoolSchedulePattern, SchoolTeachingNeed } from "@/lib/types";

const sheet = "SchoolSchedulePatterns" as const;

export async function GET(request: Request) {
  const requestId = createRequestId("school-schedule-patterns-list");
  try {
    await requireSessionUser(request, { allowHeaderFallback: false });
    await ensureSheetHeaders(sheet, schoolSchedulePatternHeaders);
    const schoolId = new URL(request.url).searchParams.get("schoolId") || "";
    const rows = await readSheetRowsBatch([sheet] as const);
    const patterns = rows[sheet] as unknown as SchoolSchedulePattern[];
    return NextResponse.json({ patterns: patterns.filter((row) => row.status === "ACTIVE" && (!schoolId || row.schoolId === schoolId)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error, requestId); }
}

export async function POST(request: Request) {
  const requestId = createRequestId("school-schedule-patterns-import");
  try {
    const { user, source } = await requireSessionUser(request, { allowHeaderFallback: false });
    if (user.role !== "admin") return apiFailure(403, "Chỉ quản trị được nhập lịch nền học kỳ.", undefined, requestId);
    const body = await request.json() as { mode?: "preview" | "apply"; rows?: SchoolSchedulePatternInput[]; revision?: string; source?: { schoolId?: string; effectiveFrom?: string; effectiveTo?: string; fullSnapshot?: boolean; scopes?: FixedBaselineScope[]; materializeAllWeeks?: boolean } };
    if (!Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > 2_000) return apiFailure(400, "File cần từ 1 đến 2.000 dòng lịch nền.", undefined, requestId);
    const bulk = body.source?.materializeAllWeeks === true;
    if (bulk && (!body.source?.fullSnapshot || !Array.isArray(body.source.scopes) || ![1, fixedBaselineSchoolLabels.length].includes(body.source.scopes.length))) return apiFailure(400, "Phạm vi lịch nền cần một trường hoặc đúng bốn trường cố định.", undefined, requestId);
    await Promise.all([ensureSheetHeaders(sheet, schoolSchedulePatternHeaders), ...(bulk ? [ensureSheetHeaders("SchoolTeachingNeeds", schoolTeachingNeedHeaders)] : [])]);
    const rows = await readSheetRowsBatch([sheet, "Schools", "Classes", ...(bulk ? ["SchoolTeachingNeeds" as const] : [])] as const);
    const existing = rows[sheet] as unknown as SchoolSchedulePattern[];
    const schools = rows.Schools as unknown as School[];
    const classes = rows.Classes as unknown as ClassRoom[];
    const needs = bulk ? rows.SchoolTeachingNeeds as unknown as SchoolTeachingNeed[] : [];
    const scopes = bulk ? body.source!.scopes! : [];
    if (bulk) {
      const comparable = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
      const names = scopes.map((scope) => schools.find((school) => school.id === scope.schoolId)?.name || "");
      if (scopes.length === fixedBaselineSchoolLabels.length && fixedBaselineSchoolLabels.some((label) => names.filter((name) => comparable(name).includes(comparable(label))).length !== 1)) return apiFailure(400, "File lịch nền bốn trường không đúng phạm vi đã xác nhận.", undefined, requestId);
      if (scopes.some((scope) => (Date.parse(`${scope.effectiveTo}T00:00:00Z`) - Date.parse(`${scope.effectiveFrom}T00:00:00Z`)) / 86400000 > 120)) return apiFailure(400, "Mỗi lần nhập lịch nền tối đa 120 ngày.", undefined, requestId);
    }
    let normalized;
    try { normalized = body.rows.map((row, index) => { try { return normalizeSchoolSchedulePattern(row, schools, classes); } catch (error) { throw new Error(`Dòng ${index + 2}: ${error instanceof Error ? error.message : "không hợp lệ."}`); } }); }
    catch (error) { return apiFailure(400, error instanceof Error ? error.message : "File không hợp lệ.", undefined, requestId); }
    let plan: ReturnType<typeof planSchoolSchedulePatternImport>;
    let superseded: SchoolSchedulePattern[] = [];
    try {
      if (bulk) {
        const snapshot = planSchoolSchedulePatternBatchSnapshot(normalized, existing, scopes);
        plan = snapshot.rows;
        superseded = snapshot.superseded;
      } else if (body.source?.fullSnapshot) {
        const snapshot = planSchoolSchedulePatternSnapshot(normalized, existing, String(body.source.schoolId || ""), String(body.source.effectiveFrom || ""), String(body.source.effectiveTo || ""));
        plan = snapshot.rows;
        superseded = snapshot.superseded;
      } else plan = planSchoolSchedulePatternImport(normalized, existing);
    }
    catch (error) { return apiFailure(400, error instanceof Error ? error.message : "Không thể đối chiếu file.", undefined, requestId); }
    const conflicts = findSchoolSchedulePatternImportConflicts(plan, existing, superseded);
    if (conflicts.length) return apiFailure(409, "Lịch nền mới chồng giờ với quy tắc đang có cho cùng lớp và thứ dạy. Hãy sửa các tiết trùng rồi đối chiếu lại.", undefined, requestId);
    const revision = schoolScheduleImportChecksum({
      patterns: existing.filter((row) => row.status === "ACTIVE").map((row) => [row.id, row.updatedAt, row.version, schoolSchedulePatternIdentity(row)]).sort(),
      needs: bulk ? needs.filter((row) => scopes.some((scope) => row.schoolId === scope.schoolId && row.date >= scope.effectiveFrom && row.date <= scope.effectiveTo)).map((row) => [row.id, row.updatedAt, row.status, row.sourceKind, row.patternId, row.sourceVersion]).sort() : [],
    });
    const summary = { newCount: plan.filter((item) => item.action === "NEW").length, changedCount: plan.filter((item) => item.action === "CHANGED").length, duplicateCount: plan.filter((item) => item.action === "SAME").length, supersededCount: superseded.length, generatedCount: 0, updatedNeedCount: 0, retiredNeedCount: 0, reviewCount: 0, overriddenWeekCount: 0, weekCount: 0 };
    if (body.mode === "apply" && body.revision !== revision) return apiFailure(409, "Lịch nền đã thay đổi. Hãy đối chiếu lại file trước khi nhập.", undefined, requestId);
    const now = new Date().toISOString();
    const editorName = user.name?.trim() || user.email || user.id;
    const newRows: SchoolSchedulePattern[] = plan.filter((item) => item.action === "NEW").map((item) => ({ ...item.row, id: createId("semester"), status: "ACTIVE", version: 1, createdAt: now, updatedAt: now, lastEditedAt: now, lastEditedBy: editorName }));
    const updates = plan.filter((item) => item.action === "CHANGED" && item.target).map((item) => ({ id: item.target!.id, patch: { ...item.row, id: item.target!.id, status: "ACTIVE" as const, version: Number(item.target!.version || 0) + 1, updatedAt: now, lastEditedAt: now, lastEditedBy: editorName } }));
    const retirements = superseded.map((pattern) => ({ id: pattern.id, patch: { status: "SUPERSEDED" as const, version: Number(pattern.version || 0) + 1, updatedAt: now, lastEditedAt: now, lastEditedBy: editorName } }));
    const patternPatches = new Map([...updates, ...retirements].map((item) => [item.id, item.patch]));
    const projectedPatterns = [...existing.map((pattern) => ({ ...pattern, ...(patternPatches.get(pattern.id) || {}) })), ...newRows];
    const materialization = bulk ? planPatternMaterializationRange(projectedPatterns, needs, scopes) : null;
    if (materialization?.conflicts.length) return apiFailure(409, `Lịch nền trùng với ${materialization.conflicts.length} tiết đang có. Hãy xử lý các tiết trùng và đối chiếu lại.`, undefined, requestId);
    if (materialization) {
      summary.generatedCount = materialization.creates.length;
      summary.updatedNeedCount = materialization.updates.length;
      summary.retiredNeedCount = materialization.retirements.length;
      summary.reviewCount = [...materialization.updates, ...materialization.retirements].filter((item) => item.status === "REVIEW").length;
      summary.overriddenWeekCount = materialization.overriddenWeekCount;
      summary.weekCount = materialization.weekCount;
    }
    if (body.mode !== "apply") return NextResponse.json({ revision, summary, rows: [...plan.map((item) => ({ action: item.action, before: item.target, after: item.row })), ...superseded.map((before) => ({ action: "SUPERSEDED" as const, before }))] });
    if (!summary.newCount && !summary.changedCount && !summary.supersededCount && !summary.generatedCount && !summary.updatedNeedCount && !summary.retiredNeedCount) return NextResponse.json({ summary, unchanged: true, patterns: [] });
    if (newRows.length) await appendSheetRows(sheet, newRows);
    if (updates.length || retirements.length) await updateSheetRowsById(sheet, [...updates, ...retirements]);
    if (materialization) {
      const newNeeds: SchoolTeachingNeed[] = materialization.creates.map((row) => ({ ...row, id: createId("need"), status: "OPEN", createdAt: now, updatedAt: now, lastEditedAt: now, lastEditedBy: editorName }));
      const needUpdates = materialization.updates.map(({ target, row, status }) => ({ id: target.id, patch: { ...row, id: target.id, status, updatedAt: now, lastEditedAt: now, lastEditedBy: editorName } }));
      const needRetirements = materialization.retirements.map(({ target, status }) => ({ id: target.id, patch: { status, sourceStatus: "Trường hủy tiết", updatedAt: now, lastEditedAt: now, lastEditedBy: editorName } }));
      if (newNeeds.length) await appendSheetRows("SchoolTeachingNeeds", newNeeds);
      if (needUpdates.length || needRetirements.length) await updateSheetRowsById("SchoolTeachingNeeds", [...needUpdates, ...needRetirements]);
    }
    await appendAuditLog({ requestId, actor: user, action: "school_schedule_pattern.import", entityType: "SchoolSchedulePattern", entityId: "batch", route: "/api/school-schedule-patterns", method: "POST", authMode: "enforce", decision: "allow", reason: "admin", source, after: { ...summary, checksum: schoolScheduleImportChecksum(normalized) } });
    return NextResponse.json({ summary, patterns: [...newRows, ...updates.map((item) => ({ ...item.patch, id: item.id }))] });
  } catch (error) { return apiError(error, requestId); }
}
