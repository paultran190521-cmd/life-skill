import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { appendSheetRow, readSheetRows } from "@/lib/google-sheets";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";

export async function GET() {
  const requestId = createRequestId("schools-list");
  try {
    return NextResponse.json(await readSheetRows("Schools"));
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId("school");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_schools_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] schools.create ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const district = String(body.district || "").trim();
    const address = String(body.address || "").trim();
    const contactName = String(body.contactName || "").trim();
    const contactPhone = String(body.contactPhone || "").trim();

    if (!name) {
      return apiFailure(400, "Tên trường là bắt buộc.", undefined, requestId);
    }

    const now = new Date().toISOString();
    const school = {
      id: body.id || createId("s"),
      name,
      district: district || "Chưa cập nhật",
      address,
      contactName,
      contactPhone,
      createdAt: now,
      updatedAt: now,
    };

    await appendSheetRow("Schools", school);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "school.create",
      entityType: "School",
      entityId: school.id,
      route: "/api/schools",
      method: "POST",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      after: school,
    });
    return NextResponse.json(school);
  } catch (error) {
    return apiError(error, requestId);
  }
}
