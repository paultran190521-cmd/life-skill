import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { appNeedDiffersFromEffective, findIntakeLink, intakeLinkRevision, isIntakeRowDirty, mirrorAppNeedToIntake, needFields } from "@/lib/school-intake-bidirectional";
import { ensureSheetHeaders, readSheetRowsBatch, schoolTeachingNeedHeaders } from "@/lib/google-sheets";
import { requireSessionUser } from "@/lib/route-auth";
import type { ClassRoom, School, SchoolTeachingNeed } from "@/lib/types";

async function loadNeed(id: string) {
  await ensureSheetHeaders("SchoolTeachingNeeds", schoolTeachingNeedHeaders);
  const data = await readSheetRowsBatch(["SchoolTeachingNeeds", "Schools", "Classes"] as const);
  return {
    need: (data.SchoolTeachingNeeds as unknown as SchoolTeachingNeed[]).find((row) => row.id === id),
    schools: data.Schools as unknown as School[],
    classes: data.Classes as unknown as ClassRoom[],
  };
}

export async function GET(request: Request) {
  const requestId = createRequestId("school-need-intake-preview");
  try {
    const { user } = await requireSessionUser(request, { allowHeaderFallback: false });
    if (user.role !== "admin") return apiFailure(403, "Chỉ quản trị được đối chiếu lịch trường.", undefined, requestId);
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!id) return apiFailure(400, "Thiếu mã lịch cần đối chiếu.", undefined, requestId);
    const { need, schools, classes } = await loadNeed(id);
    if (!need) return apiFailure(404, "Không tìm thấy lịch trong app.", undefined, requestId);
    const link = await findIntakeLink(id);
    return NextResponse.json({
      app: needFields(need, schools, classes), appUpdatedAt: need.updatedAt || "",
      sheet: link?.input.slice(1, 12) || null,
      effective: link?.effective.slice(1, 12) || null,
      sheetStatus: link?.input[16] || "Chưa có trên Sheet",
      conflict: Boolean(link && (isIntakeRowDirty(link.input, link.effective) || appNeedDiffersFromEffective(need, link.effective, schools, classes))),
      revision: intakeLinkRevision(link),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error, requestId); }
}

export async function POST(request: Request) {
  const requestId = createRequestId("school-need-intake-resolve");
  try {
    const { user, source } = await requireSessionUser(request, { allowHeaderFallback: false });
    if (user.role !== "admin") return apiFailure(403, "Chỉ quản trị được đối chiếu lịch trường.", undefined, requestId);
    const body = await request.json() as { id?: string; action?: string; appUpdatedAt?: string; revision?: string };
    if (!body.id || body.action !== "keepApp" || !body.revision) return apiFailure(400, "Thiếu thông tin đối chiếu.", undefined, requestId);
    const { need, schools, classes } = await loadNeed(body.id);
    if (!need) return apiFailure(404, "Không tìm thấy lịch trong app.", undefined, requestId);
    const link = await findIntakeLink(body.id);
    if (body.appUpdatedAt !== (need.updatedAt || "") || body.revision !== intakeLinkRevision(link)) return apiFailure(409, "Lịch đã thay đổi từ lúc xem đối chiếu. Hãy mở lại bản mới.", undefined, requestId);
    if (["Chờ duyệt vòng 2", "Chờ Nguyễn Phương duyệt"].includes(link?.input[16] || "")) return apiFailure(409, "Đợt lịch đang chờ vòng 2. Cần duyệt hoặc trả lại đợt này trước khi chọn bản app.", undefined, requestId);
    const mirrored = await mirrorAppNeedToIntake(need, need, user.name?.trim() || user.email || user.id, schools, classes, link, true);
    await appendAuditLog({ requestId, actor: user, action: "school_need.resolve_intake_keep_app", entityType: "SchoolTeachingNeed", entityId: need.id, route: "/api/school-teaching-needs/intake-sync", method: "POST", authMode: "enforce", decision: "allow", reason: "admin", source,
      before: { sheet: link?.input || null, effective: link?.effective || null }, after: { app: need, mirrored } });
    return NextResponse.json({ synced: true, rowId: mirrored.rowId });
  } catch (error) { return apiError(error, requestId); }
}
