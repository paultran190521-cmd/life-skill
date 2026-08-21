import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { appendSheetRow, readSheetRows, updateSheetRowById, deleteSheetRowById } from "@/lib/google-sheets";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";

export async function GET() {
  const requestId = createRequestId("topics-list");
  try {
    return NextResponse.json(await readSheetRows("Topics"));
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId("topic");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_topics_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] topics.create ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const body = await request.json();
    const grade = String(body.grade || "").trim();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();

    if (!grade || !title) {
      return apiFailure(400, "Khối và tiêu đề chủ đề là bắt buộc.", undefined, requestId);
    }

    const now = new Date().toISOString();
    const topic = {
      id: createId("topic"),
      grade,
      title,
      description,
      active: body.active ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await appendSheetRow("Topics", topic);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "topic.create",
      entityType: "Topic",
      entityId: topic.id,
      route: "/api/topics",
      method: "POST",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      after: topic,
    });
    return NextResponse.json(topic);
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function PUT(request: Request) {
  const requestId = createRequestId("topic");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_topics_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] topics.update ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const body = await request.json();
    const id = String(body.id || "").trim();

    if (!id) {
      return apiFailure(400, "Thiếu id chủ đề.", undefined, requestId);
    }

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.grade !== undefined) patch.grade = String(body.grade).trim();
    if (body.title !== undefined) patch.title = String(body.title).trim();
    if (body.description !== undefined) patch.description = String(body.description).trim();
    if (body.active !== undefined) patch.active = body.active;

    await updateSheetRowById("Topics", id, patch);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "topic.update",
      entityType: "Topic",
      entityId: id,
      route: "/api/topics",
      method: "PUT",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      after: { id, ...patch },
    });
    return NextResponse.json({ id, ...patch });
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function DELETE(request: Request) {
  const requestId = createRequestId("topic");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_topics_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] topics.delete ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return apiFailure(400, "Thiếu id chủ đề.", undefined, requestId);
    }

    await deleteSheetRowById("Topics", id);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "topic.delete",
      entityType: "Topic",
      entityId: id,
      route: "/api/topics",
      method: "DELETE",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
    });
    return NextResponse.json({ id, deleted: true });
  } catch (error) {
    return apiError(error, requestId);
  }
}
