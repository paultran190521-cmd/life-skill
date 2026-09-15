import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { ensureSheetHeaders, readSheetRowById, scheduleHeaders, updateSheetRowById } from "@/lib/google-sheets";
import { evaluatePermission, requireSessionUser } from "@/lib/route-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId("schedule-assistant-confirm");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    const { id } = await params;
    await ensureSheetHeaders("Schedules", scheduleHeaders);
    const schedule = await readSheetRowById("Schedules", id);
    if (!schedule) return apiFailure(404, "Không tìm thấy lịch.", undefined, requestId);

    const assistantId = String(auth.user.teacherId || "").trim();
    const assignedAssistantIds = parseIds(schedule.assistantIds);
    const permission = evaluatePermission({
      allowed: auth.user.role === "assistant" && Boolean(assistantId) && assignedAssistantIds.includes(assistantId),
      reason: "assistant_must_be_assigned_to_schedule",
    });
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không được phân công trợ giảng cho lịch này.", undefined, requestId);
    }
    if (schedule.status === "cancelled") {
      return apiFailure(400, "Không thể xác nhận lịch đã hủy.", undefined, requestId);
    }

    const assistantConfirmedIds = Array.from(new Set([...parseIds(schedule.assistantConfirmedIds), assistantId]));
    const now = new Date().toISOString();
    await updateSheetRowById("Schedules", id, { assistantConfirmedIds: assistantConfirmedIds.join(","), updatedAt: now });
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "schedule.assistant_confirm",
      entityType: "Schedule",
      entityId: id,
      route: `/api/schedules/${id}/assistant-confirm`,
      method: "POST",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      before: { assistantConfirmedIds: schedule.assistantConfirmedIds || "" },
      after: { assistantConfirmedIds: assistantConfirmedIds.join(",") },
    });

    return NextResponse.json({ id, assistantConfirmedIds: assistantConfirmedIds.join(","), updatedAt: now });
  } catch (error) {
    return apiError(error, requestId);
  }
}

function parseIds(value: unknown) {
  return String(value || "").split(",").map((id) => id.trim()).filter(Boolean);
}
