import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { validationError } from "@/lib/app-error";
import { appendSheetRow, appendSheetRows, readSheetRows } from "@/lib/google-sheets";
import { getAvatarUrl } from "@/lib/avatar";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";

type NewTeacherRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string;
  specialty: string;
  active: unknown;
  createdAt: string;
  updatedAt: string;
};

export async function GET() {
  const requestId = createRequestId("teachers-list");
  try {
    return NextResponse.json(await readSheetRows("Teachers"));
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId("teacher");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_teachers_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] teachers.create ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const body = await request.json();
    const now = new Date().toISOString();
    const rawTeachers = Array.isArray(body?.teachers) ? body.teachers : Array.isArray(body) ? body : [body];
    const teachers: NewTeacherRow[] = rawTeachers.map((item: Record<string, unknown>, index: number) => {
      const name = String(item.name || "").trim();
      const email = String(item.email || "")
        .trim()
        .toLowerCase();
      if (!name || !email) {
        throw validationError(`Dòng giáo viên ${index + 1} thiếu Họ tên hoặc Email.`);
      }

      return {
        id: String(item.id || createId("t")),
        name,
        email,
        phone: String(item.phone || "").trim() || "Chưa cập nhật",
        avatarUrl: String(item.avatarUrl || "").trim() || getAvatarUrl(email, name),
        specialty: String(item.specialty || "").trim() || "Kỹ năng sống",
        active: item.active ?? true,
        createdAt: now,
        updatedAt: now,
      };
    });

    if (teachers.length === 1) {
      await appendSheetRow("Teachers", teachers[0]);
      await appendAuditLog({
        requestId,
        actor: auth.user,
        action: "teacher.create",
        entityType: "Teacher",
        entityId: String(teachers[0].id),
        route: "/api/teachers",
        method: "POST",
        authMode: permission.authMode,
        decision: permission.decision,
        reason: permission.reason,
        source: auth.source,
        after: teachers[0],
      });
      return NextResponse.json(teachers[0]);
    }

    await appendSheetRows("Teachers", teachers);
    await Promise.all(
      teachers.map((teacher: NewTeacherRow) =>
        appendAuditLog({
          requestId,
          actor: auth.user,
          action: "teacher.create",
          entityType: "Teacher",
          entityId: String(teacher.id),
          route: "/api/teachers",
          method: "POST",
          authMode: permission.authMode,
          decision: permission.decision,
          reason: permission.reason,
          source: auth.source,
          after: teacher,
        }),
      ),
    );
    return NextResponse.json({ teachers });
  } catch (error) {
    return apiError(error, requestId);
  }
}
