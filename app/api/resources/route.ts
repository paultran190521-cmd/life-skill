import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import {
  appendSheetRowWithHeaders,
  ensureSheetHeaders,
  readSheetRows,
  resourceLinkHeaders,
  toResourceLinks,
} from "@/lib/google-sheets";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";

export async function GET(request: Request) {
  const requestId = createRequestId("resources-list");
  try {
    await requireSessionUser(request, { allowHeaderFallback: false });
    await ensureSheetHeaders("ResourceLinks", resourceLinkHeaders);
    return NextResponse.json(toResourceLinks(await readSheetRows("ResourceLinks")));
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId("resource-create");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_resources_write");
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền tạo tài nguyên.", undefined, requestId);
    }

    const body = await request.json();
    const title = String(body.title || "").trim();
    const url = normalizeResourceUrl(body.url);
    if (!title || !url) {
      return apiFailure(400, "Tên và đường dẫn tài nguyên là bắt buộc.", undefined, requestId);
    }

    const now = new Date().toISOString();
    const resource = {
      id: createId("resource"),
      title,
      url,
      description: String(body.description || "").trim(),
      active: body.active !== false,
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
      createdBy: auth.user.id,
      createdAt: now,
      updatedAt: now,
    };
    await appendSheetRowWithHeaders("ResourceLinks", resourceLinkHeaders, resource);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "resource_link.create",
      entityType: "ResourceLink",
      entityId: resource.id,
      route: "/api/resources",
      method: "POST",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      after: resource,
    });
    return NextResponse.json(resource);
  } catch (error) {
    return apiError(error, requestId);
  }
}

export function normalizeResourceUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}
