import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { readSheetRowById, updateSheetRowById } from "@/lib/google-sheets";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";
import type { Role } from "@/lib/types";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId("user-patch");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_users_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] users.patch ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const { id } = await params;
    const before = await readSheetRowById("Users", id);
    if (!before) {
      return apiFailure(404, "Không tìm thấy người dùng.", undefined, requestId);
    }

    const body = await request.json();
    const patch: Record<string, unknown> = {
      ...body,
      updatedAt: new Date().toISOString(),
    };
    if (body.role !== undefined) {
      patch.role = normalizeRole(body.role);
    }

    await updateSheetRowById("Users", id, patch);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "user.update",
      entityType: "User",
      entityId: id,
      route: `/api/users/${id}`,
      method: "PATCH",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      before,
      after: { ...before, ...patch },
    });
    return NextResponse.json({ id, ...patch });
  } catch (error) {
    return apiError(error, requestId);
  }
}

function normalizeRole(role: unknown): Role {
  return role === "teacher" ? "teacher" : "admin";
}
