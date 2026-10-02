import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { appendSheetRows, deleteSheetRowsByIds, ensureSheetHeaders, readSheetRowsBatch, schoolTeachingNeedHeaders, updateSheetRowsById } from "@/lib/google-sheets";
import { requireSessionUser } from "@/lib/route-auth";
import { normalizeSchoolNeedInput, planSchoolNeedDeletion, planSchoolNeedImport, schoolNeedContentChanged, schoolNeedIdentity, schoolNeedRequiresReview, schoolNeedRevision, type SchoolNeedInput } from "@/lib/school-teaching-needs";
import type { ClassRoom, School, SchoolTeachingNeed } from "@/lib/types";

const sheet = "SchoolTeachingNeeds" as const;

async function loadRows() {
  await ensureSheetHeaders(sheet, schoolTeachingNeedHeaders);
  const rows = await readSheetRowsBatch([sheet, "Schools", "Classes"] as const);
  return {
    needs: rows.SchoolTeachingNeeds as unknown as SchoolTeachingNeed[],
    schools: rows.Schools as unknown as School[],
    classes: rows.Classes as unknown as ClassRoom[],
  };
}

export async function GET(request: Request) {
  const requestId = createRequestId("school-needs-list");
  try {
    const { user } = await requireSessionUser(request, { allowHeaderFallback: false });
    if (user.role !== "admin") return apiFailure(403, "Chỉ quản trị được xem lịch gốc của trường.", undefined, requestId);
    const { needs } = await loadRows();
    const query = new URL(request.url).searchParams;
    const from = query.get("from") || "";
    const to = query.get("to") || "";
    const schoolId = query.get("schoolId") || "";
    return NextResponse.json({
      needs: needs.filter((row) => (!from || row.date >= from) && (!to || row.date <= to) && (!schoolId || row.schoolId === schoolId)),
      revision: schoolNeedRevision(needs),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error, requestId); }
}

export async function POST(request: Request) {
  const requestId = createRequestId("school-needs-import");
  try {
    const { user, source } = await requireSessionUser(request, { allowHeaderFallback: false });
    if (user.role !== "admin") return apiFailure(403, "Chỉ quản trị được nhập lịch trường.", undefined, requestId);
    const body = await request.json() as { mode?: string; rows?: SchoolNeedInput[]; revision?: string };
    if (!Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > 2000) {
      return apiFailure(400, "File cần từ 1 đến 2.000 dòng lịch.", undefined, requestId);
    }
    const { needs, schools, classes } = await loadRows();
    const revision = schoolNeedRevision(needs);
    if (body.mode === "apply" && body.revision !== revision) return apiFailure(409, "Lịch trường đã thay đổi. Hãy xem lại bản đối chiếu trước khi nhập.", undefined, requestId);
    let plan: ReturnType<typeof planSchoolNeedImport>;
    try {
      const normalized = body.rows.map((row, index) => {
        try { return normalizeSchoolNeedInput(row, schools, classes); }
        catch (error) { throw new Error(`Dòng ${index + 2}: ${error instanceof Error ? error.message : "Dữ liệu không hợp lệ."}`); }
      });
      plan = planSchoolNeedImport(normalized, needs);
    } catch (error) {
      return apiFailure(400, error instanceof Error ? error.message : "File lịch không hợp lệ.", undefined, requestId);
    }
    const summary = {
      newCount: plan.filter((item) => item.action === "NEW").length,
      changedCount: plan.filter((item) => item.action === "CHANGED").length,
      duplicateCount: plan.filter((item) => item.action === "SAME").length,
      reviewCount: plan.filter((item) => item.action === "CHANGED" && item.target && schoolNeedRequiresReview(item.target, item.row)).length,
    };
    if (body.mode !== "apply") return NextResponse.json({ revision, summary, rows: plan.map((item) => ({ action: item.action, before: item.target, after: item.row })) });

    const now = new Date().toISOString();
    const editorName = user.name?.trim() || user.email || user.id;
    const newRows: SchoolTeachingNeed[] = plan.filter((item) => item.action === "NEW").map((item) => ({
      ...item.row, id: createId("need"), scheduleId: "", status: "OPEN", createdAt: now, updatedAt: now,
    }));
    const updates = plan.filter((item) => item.action === "CHANGED" && item.target).map((item) => ({
      id: item.target!.id,
      patch: { ...item.row, id: item.target!.id, status: schoolNeedRequiresReview(item.target!, item.row) ? "REVIEW" : item.target!.scheduleId ? "ASSIGNED" : "OPEN", updatedAt: now, lastEditedAt: now, lastEditedBy: editorName },
    }));
    if (newRows.length) await appendSheetRows(sheet, newRows);
    if (updates.length) await updateSheetRowsById(sheet, updates);
    await appendAuditLog({ requestId, actor: user, action: "school_need.import", entityType: "SchoolTeachingNeed", entityId: "batch", route: "/api/school-teaching-needs", method: "POST", authMode: "enforce", decision: "allow", reason: "admin", source, after: summary });
    return NextResponse.json({ summary, needs: [...needs.filter((row) => !updates.some((update) => update.id === row.id)), ...updates.map((update) => ({ ...needs.find((row) => row.id === update.id)!, ...update.patch })), ...newRows] });
  } catch (error) { return apiError(error, requestId); }
}

export async function PATCH(request: Request) {
  const requestId = createRequestId("school-need-update");
  try {
    const { user, source } = await requireSessionUser(request, { allowHeaderFallback: false });
    if (user.role !== "admin") return apiFailure(403, "Chỉ quản trị được sửa lịch trường.", undefined, requestId);
    const body = await request.json() as SchoolNeedInput;
    const { needs, schools, classes } = await loadRows();
    const current = needs.find((row) => row.id === body.id);
    if (!current) return apiFailure(404, "Không tìm thấy dòng lịch trường.", undefined, requestId);
    let next: ReturnType<typeof normalizeSchoolNeedInput>;
    try { next = normalizeSchoolNeedInput({ ...current, ...body, school: body.school ?? current.schoolId, className: body.className ?? current.classId, environment: body.environment ?? current.teachingEnvironment }, schools, classes); }
    catch (error) { return apiFailure(400, error instanceof Error ? error.message : "Dòng lịch không hợp lệ.", undefined, requestId); }
    if (needs.some((row) => row.id !== current.id && schoolNeedIdentity(row) === schoolNeedIdentity(next))) return apiFailure(409, "Dòng đã có trong lịch trường.", undefined, requestId);
    if (!schoolNeedContentChanged(current, next)) return NextResponse.json({ need: current, unchanged: true });
    const now = new Date().toISOString();
    const patch = { ...next, id: current.id, status: schoolNeedRequiresReview(current, next) ? "REVIEW" : current.scheduleId ? "ASSIGNED" : "OPEN", updatedAt: now, lastEditedAt: now, lastEditedBy: user.name?.trim() || user.email || user.id };
    await updateSheetRowsById(sheet, [{ id: current.id, patch }]);
    await appendAuditLog({ requestId, actor: user, action: "school_need.update", entityType: "SchoolTeachingNeed", entityId: current.id, route: "/api/school-teaching-needs", method: "PATCH", authMode: "enforce", decision: "allow", reason: "admin", source, before: current, after: patch });
    return NextResponse.json({ need: { ...current, ...patch } });
  } catch (error) { return apiError(error, requestId); }
}

export async function DELETE(request: Request) {
  const requestId = createRequestId("school-need-delete");
  try {
    const { user, source } = await requireSessionUser(request, { allowHeaderFallback: false });
    if (user.role !== "admin") return apiFailure(403, "Chỉ quản trị được xóa dòng lịch trường.", undefined, requestId);
    const body = await request.json() as { id?: string; ids?: unknown; expectedRows?: unknown };
    const { needs } = await loadRows();
    const plan = planSchoolNeedDeletion(needs, body.ids ?? (body.id ? [body.id] : []), body.expectedRows);
    if (!plan.ok) return apiFailure(plan.status, plan.error, undefined, requestId);
    const scheduleRows = await readSheetRowsBatch(["Schedules"] as const);
    const selectedIds = new Set(plan.ids);
    if (scheduleRows.Schedules.some((row) => selectedIds.has(String(row.schoolNeedId || "")) && row.status !== "cancelled")) {
      return apiFailure(409, "Có tiết đã tạo lịch dạy. Hãy xử lý lịch đã gửi trước khi xóa nguồn.", undefined, requestId);
    }
    await deleteSheetRowsByIds(sheet, plan.ids, { requireAll: true });
    await appendAuditLog({ requestId, actor: user, action: plan.ids.length > 1 ? "school_need.delete_batch" : "school_need.delete", entityType: "SchoolTeachingNeed", entityId: plan.ids.length > 1 ? "batch" : plan.ids[0], route: "/api/school-teaching-needs", method: "DELETE", authMode: "enforce", decision: "allow", reason: "admin", source, before: { rows: plan.rows.map((row) => ({ id: row.id, date: row.date, schoolId: row.schoolId, classId: row.classId, start: row.start, end: row.end })) } });
    return NextResponse.json({ deletedId: plan.ids[0], deletedIds: plan.ids, deletedCount: plan.ids.length });
  } catch (error) { return apiError(error, requestId); }
}
