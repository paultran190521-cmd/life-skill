import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { appendSheetRows, ensureSheetHeaders, readSheetRowsBatch, schoolSchedulePatternHeaders, updateSheetRowsById } from "@/lib/google-sheets";
import { requireSessionUser } from "@/lib/route-auth";
import { normalizeSchoolSchedulePattern, planSchoolSchedulePatternImport, schoolScheduleImportChecksum, schoolSchedulePatternIdentity, type SchoolSchedulePatternInput } from "@/lib/school-schedule-patterns";
import type { ClassRoom, School, SchoolSchedulePattern } from "@/lib/types";

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
    const body = await request.json() as { mode?: "preview" | "apply"; rows?: SchoolSchedulePatternInput[]; revision?: string };
    if (!Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > 2_000) return apiFailure(400, "File cần từ 1 đến 2.000 dòng lịch nền.", undefined, requestId);
    await ensureSheetHeaders(sheet, schoolSchedulePatternHeaders);
    const rows = await readSheetRowsBatch([sheet, "Schools", "Classes"] as const);
    const existing = rows[sheet] as unknown as SchoolSchedulePattern[];
    const schools = rows.Schools as unknown as School[];
    const classes = rows.Classes as unknown as ClassRoom[];
    let normalized;
    try { normalized = body.rows.map((row, index) => { try { return normalizeSchoolSchedulePattern(row, schools, classes); } catch (error) { throw new Error(`Dòng ${index + 2}: ${error instanceof Error ? error.message : "không hợp lệ."}`); } }); }
    catch (error) { return apiFailure(400, error instanceof Error ? error.message : "File không hợp lệ.", undefined, requestId); }
    let plan;
    try { plan = planSchoolSchedulePatternImport(normalized, existing); }
    catch (error) { return apiFailure(400, error instanceof Error ? error.message : "Không thể đối chiếu file.", undefined, requestId); }
    const revision = schoolScheduleImportChecksum(existing.filter((row) => row.status === "ACTIVE").map((row) => [row.id, row.updatedAt, row.version, schoolSchedulePatternIdentity(row)]).sort());
    const summary = { newCount: plan.filter((item) => item.action === "NEW").length, changedCount: plan.filter((item) => item.action === "CHANGED").length, duplicateCount: plan.filter((item) => item.action === "SAME").length };
    if (body.mode !== "apply") return NextResponse.json({ revision, summary, rows: plan.map((item) => ({ action: item.action, before: item.target, after: item.row })) });
    if (body.revision !== revision) return apiFailure(409, "Lịch nền đã thay đổi. Hãy đối chiếu lại file trước khi nhập.", undefined, requestId);
    const now = new Date().toISOString();
    const editorName = user.name?.trim() || user.email || user.id;
    const newRows: SchoolSchedulePattern[] = plan.filter((item) => item.action === "NEW").map((item) => ({ ...item.row, id: createId("semester"), status: "ACTIVE", version: 1, createdAt: now, updatedAt: now, lastEditedAt: now, lastEditedBy: editorName }));
    const updates = plan.filter((item) => item.action === "CHANGED" && item.target).map((item) => ({ id: item.target!.id, patch: { ...item.row, id: item.target!.id, status: "ACTIVE" as const, version: Number(item.target!.version || 0) + 1, updatedAt: now, lastEditedAt: now, lastEditedBy: editorName } }));
    if (newRows.length) await appendSheetRows(sheet, newRows);
    if (updates.length) await updateSheetRowsById(sheet, updates);
    await appendAuditLog({ requestId, actor: user, action: "school_schedule_pattern.import", entityType: "SchoolSchedulePattern", entityId: "batch", route: "/api/school-schedule-patterns", method: "POST", authMode: "enforce", decision: "allow", reason: "admin", source, after: { ...summary, checksum: schoolScheduleImportChecksum(normalized) } });
    return NextResponse.json({ summary, patterns: [...newRows, ...updates.map((item) => ({ ...item.patch, id: item.id }))] });
  } catch (error) { return apiError(error, requestId); }
}
