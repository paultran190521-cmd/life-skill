import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { validationError } from "@/lib/app-error";
import { appendSheetRow, appendSheetRows, readSheetRows } from "@/lib/google-sheets";
import { normalizeTimeSlotInput, normalizeTimeSlotLabel, timeSlotDuplicateKey } from "@/lib/time-slots";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";

export async function GET() {
  const requestId = createRequestId("slots-list");
  try {
    return NextResponse.json(await readSheetRows("TimeSlots"));
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId("slot");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_time_slots_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] time-slots.create ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const body = await request.json();
    const now = new Date().toISOString();
    const rawSlots = Array.isArray(body?.timeSlots) ? body.timeSlots : Array.isArray(body) ? body : [body];
    const existingSlots = await readSheetRows("TimeSlots");
    const existingLabels = new Set(
      existingSlots.map((slot) => normalizeTimeSlotLabel(String(slot.label || ""))).filter(Boolean),
    );
    const existingTimes = new Set(
      existingSlots
        .map((slot) => timeSlotDuplicateKey({ start: String(slot.start || ""), end: String(slot.end || "") }))
        .filter((key) => key !== "-"),
    );

    const seenLabels = new Set<string>();
    const seenTimes = new Set<string>();
    const timeSlots: Array<Record<string, unknown>> = rawSlots.map((item: Record<string, unknown>, index: number) => {
      const normalized = normalizeTimeSlotInput(item);
      const labelKey = normalizeTimeSlotLabel(normalized.label);
      const timeKey = timeSlotDuplicateKey(normalized);

      if (existingLabels.has(labelKey) || seenLabels.has(labelKey)) {
        throw validationError(`Dòng khung giờ ${index + 1} bị trùng tên.`);
      }
      if (existingTimes.has(timeKey) || seenTimes.has(timeKey)) {
        throw validationError(`Dòng khung giờ ${index + 1} bị trùng giờ bắt đầu/kết thúc.`);
      }

      seenLabels.add(labelKey);
      seenTimes.add(timeKey);

      return {
        id: String(item.id || createId("ts")),
        ...normalized,
        createdAt: now,
        updatedAt: now,
      };
    });

    if (timeSlots.length === 1) {
      await appendSheetRow("TimeSlots", timeSlots[0]);
      await appendAuditLog({
        requestId,
        actor: auth.user,
        action: "time_slot.create",
        entityType: "TimeSlot",
        entityId: String(timeSlots[0].id),
        route: "/api/time-slots",
        method: "POST",
        authMode: permission.authMode,
        decision: permission.decision,
        reason: permission.reason,
        source: auth.source,
        after: timeSlots[0],
      });
      return NextResponse.json(timeSlots[0]);
    }

    await appendSheetRows("TimeSlots", timeSlots);
    await Promise.all(
      timeSlots.map((slot: Record<string, unknown>) =>
        appendAuditLog({
          requestId,
          actor: auth.user,
          action: "time_slot.create",
          entityType: "TimeSlot",
          entityId: String(slot.id),
          route: "/api/time-slots",
          method: "POST",
          authMode: permission.authMode,
          decision: permission.decision,
          reason: permission.reason,
          source: auth.source,
          after: slot,
        }),
      ),
    );
    return NextResponse.json({ timeSlots });
  } catch (error) {
    return apiError(error, requestId);
  }
}
