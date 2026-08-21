import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { validationError } from "@/lib/app-error";
import { appendSheetRow, appendSheetRows, readSheetRows } from "@/lib/google-sheets";
import { getAvatarUrl } from "@/lib/avatar";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";
import type { Role } from "@/lib/types";

type NewUserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  teacherId: string;
  avatarUrl: string;
  isActive: unknown;
  createdAt: string;
  updatedAt: string;
};

export async function GET() {
  const requestId = createRequestId("users-list");
  try {
    return NextResponse.json(await readSheetRows("Users"));
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId("user");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_users_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] users.create ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const body = await request.json();
    const now = new Date().toISOString();
    const rawUsers = Array.isArray(body?.users) ? body.users : Array.isArray(body) ? body : [body];
    const users: NewUserRow[] = rawUsers.map((item: Record<string, unknown>, index: number) => {
      const name = String(item.name || "").trim();
      const email = String(item.email || "")
        .trim()
        .toLowerCase();
      if (!name || !email) {
        throw validationError(`Dòng tài khoản ${index + 1} thiếu Họ tên hoặc Email.`);
      }

      return {
        id: String(item.id || createId("u")),
        name,
        email,
        role: normalizeRole(item.role),
        teacherId: String(item.teacherId || "").trim(),
        avatarUrl: String(item.avatarUrl || "").trim() || getAvatarUrl(email, name),
        isActive: item.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };
    });

    const existingUsers = await readSheetRows("Users");
    const existingEmails = new Set(
      existingUsers.map((item) => String(item.email || "").trim().toLowerCase()).filter(Boolean),
    );
    if (users.some((item) => existingEmails.has(item.email.toLowerCase()))) {
      return apiFailure(409, "Email người dùng đã tồn tại trong hệ thống.", undefined, requestId);
    }

    if (users.length === 1) {
      await appendSheetRow("Users", users[0]);
      await appendAuditLog({
        requestId,
        actor: auth.user,
        action: "user.create",
        entityType: "User",
        entityId: String(users[0].id),
        route: "/api/users",
        method: "POST",
        authMode: permission.authMode,
        decision: permission.decision,
        reason: permission.reason,
        source: auth.source,
        after: users[0],
      });
      return NextResponse.json(users[0]);
    }

    await appendSheetRows("Users", users);
    await Promise.all(
      users.map((user: NewUserRow) =>
        appendAuditLog({
          requestId,
          actor: auth.user,
          action: "user.create",
          entityType: "User",
          entityId: String(user.id),
          route: "/api/users",
          method: "POST",
          authMode: permission.authMode,
          decision: permission.decision,
          reason: permission.reason,
          source: auth.source,
          after: user,
        }),
      ),
    );
    return NextResponse.json({ users });
  } catch (error) {
    return apiError(error, requestId);
  }
}

function normalizeRole(role: unknown): Role {
  return role === "teacher" || role === "assistant" ? role : "admin";
}
