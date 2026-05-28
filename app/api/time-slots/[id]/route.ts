import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { readSheetRowById, readSheetRows, updateSheetRowById } from "@/lib/google-sheets";
import { normalizeTimeSlotInput, normalizeTimeSlotLabel, timeSlotDuplicateKey } from "@/lib/time-slots";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";
import type { TimeSlot } from "@/lib/types";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId("slot-patch");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_time_slots_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] time-slots.patch ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const { id } = await params;
    const slots = await readSheetRows("TimeSlots");
    const currentSlot = slots.find((item) => String(item.id || "").trim() === id);
    if (!currentSlot) {
      return apiFailure(404, "Không tìm thấy khung giờ.", undefined, requestId);
    }
    const before = await readSheetRowById("TimeSlots", id);

    const body = (await request.json()) as Record<string, unknown>;
    const fallback: Partial<TimeSlot> = {
      label: String(currentSlot.label || "").trim(),
      start: String(currentSlot.start || "").trim(),
      end: String(currentSlot.end || "").trim(),
      active: parseBoolean(currentSlot.active, true),
    };

    const onlyStatusChange =
      body.active !== undefined && body.label === undefined && body.start === undefined && body.end === undefined;
    if (onlyStatusChange) {
      const patch = {
        active: parseBoolean(body.active, fallback.active ?? true),
        updatedAt: new Date().toISOString(),
      };
      await updateSheetRowById("TimeSlots", id, patch);
      await appendAuditLog({
        requestId,
        actor: auth.user,
        action: "time_slot.update",
        entityType: "TimeSlot",
        entityId: id,
        route: `/api/time-slots/${id}`,
        method: "PATCH",
        authMode: permission.authMode,
        decision: permission.decision,
        reason: permission.reason,
        source: auth.source,
        before: before || {},
        after: { ...(before || {}), ...patch },
      });
      return NextResponse.json({ id, ...fallback, ...patch });
    }

    const normalized = normalizeTimeSlotInput(body, fallback);
    const labelKey = normalizeTimeSlotLabel(normalized.label);
    const timeKey = timeSlotDuplicateKey(normalized);

    const duplicated = slots.some((slot) => {
      const slotId = String(slot.id || "").trim();
      if (slotId === id) {
        return false;
      }
      const sameLabel = normalizeTimeSlotLabel(String(slot.label || "")) === labelKey;
      const sameTime =
        timeSlotDuplicateKey({ start: String(slot.start || ""), end: String(slot.end || "") }) === timeKey;
      return sameLabel || sameTime;
    });

    if (duplicated) {
      return apiFailure(400, "Khung giờ bị trùng tên hoặc trùng giờ bắt đầu/kết thúc.", undefined, requestId);
    }

    const patch = {
      ...normalized,
      updatedAt: new Date().toISOString(),
    };

    await updateSheetRowById("TimeSlots", id, patch);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "time_slot.update",
      entityType: "TimeSlot",
      entityId: id,
      route: `/api/time-slots/${id}`,
      method: "PATCH",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      before: before || {},
      after: { ...(before || {}), ...patch },
    });
    return NextResponse.json({ id, ...patch });
  } catch (error) {
    return apiError(error, requestId);
  }
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["false", "0", "no", "inactive", "off", "tat", "tắt"].includes(normalized)) {
    return false;
  }
  return ["true", "1", "yes", "active", "on", "bat", "bật"].includes(normalized) || fallback;
}
