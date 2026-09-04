import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { validationError } from "@/lib/app-error";
import { appendSheetRow, appendSheetRows, clearSheetData, readSheetRows, updateSheetRowById } from "@/lib/google-sheets";
import { normalizeTimeSlotInput, normalizeTimeSlotLabel } from "@/lib/time-slots";
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
    const overwrite = body?.overwrite === true;
    const rawSlots = Array.isArray(body?.timeSlots) ? body.timeSlots : Array.isArray(body) ? body : [body];
    const existingSlots = await readSheetRows("TimeSlots");

    // Build lookup maps for existing slots
    const existingByLabel = new Map<string, Record<string, unknown>>();
    for (const slot of existingSlots) {
      const key = normalizeTimeSlotLabel(String(slot.label || ""));
      if (key) existingByLabel.set(key, slot);
    }
    const seenLabels = new Set<string>();
    const toInsert: Array<Record<string, unknown>> = [];
    const toUpdate: Array<{ existingId: string; patch: Record<string, unknown> }> = [];

    for (let index = 0; index < rawSlots.length; index++) {
      const item = rawSlots[index] as Record<string, unknown>;
      const normalized = normalizeTimeSlotInput(item);
      const labelKey = normalizeTimeSlotLabel(normalized.label);

      // Within-file duplicate label check (always reject)
      // NOTE: only check labels — different schools can share the same start/end times
      if (seenLabels.has(labelKey)) {
        throw validationError(`Dòng khung giờ ${index + 1} bị trùng tên trong file.`);
      }

      const existingSlot = existingByLabel.get(labelKey);

      if (existingSlot) {
        if (!overwrite) {
          throw validationError(`Dòng khung giờ ${index + 1} bị trùng tên.`);
        }
        // Overwrite mode: update existing slot
        toUpdate.push({
          existingId: String(existingSlot.id),
          patch: {
            ...normalized,
            updatedAt: now,
          },
        });
      } else {
        // New slot
        toInsert.push({
          id: String(item.id || createId("ts")),
          ...normalized,
          createdAt: now,
          updatedAt: now,
        });
      }

      seenLabels.add(labelKey);
    }

    // Perform updates for existing slots
    const updatedSlots: Array<Record<string, unknown>> = [];
    for (const { existingId, patch } of toUpdate) {
      await updateSheetRowById("TimeSlots", existingId, patch);
      updatedSlots.push({ id: existingId, ...patch });
      await appendAuditLog({
        requestId,
        actor: auth.user,
        action: "time_slot.update",
        entityType: "TimeSlot",
        entityId: existingId,
        route: "/api/time-slots",
        method: "POST",
        authMode: permission.authMode,
        decision: permission.decision,
        reason: permission.reason,
        source: auth.source,
        after: patch,
      });
    }

    // Perform inserts for new slots
    if (toInsert.length === 1) {
      await appendSheetRow("TimeSlots", toInsert[0]);
    } else if (toInsert.length > 1) {
      await appendSheetRows("TimeSlots", toInsert);
    }
    for (const slot of toInsert) {
      await appendAuditLog({
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
      });
    }

    return NextResponse.json({
      timeSlots: [...updatedSlots, ...toInsert],
      inserted: toInsert.length,
      updated: updatedSlots.length,
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function DELETE(request: Request) {
  const requestId = createRequestId("slot-clear");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_time_slots_write");
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const deletedCount = await clearSheetData("TimeSlots");
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "time_slot.clear_all",
      entityType: "TimeSlot",
      entityId: "*",
      route: "/api/time-slots",
      method: "DELETE",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      after: { deletedCount },
    });
    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    return apiError(error, requestId);
  }
}
