import { NextResponse } from "next/server";
import { getAvatarUrl } from "@/lib/avatar";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { deleteSheetRowById, readSheetRowById, readSheetRows, updateSheetRowById } from "@/lib/google-sheets";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId("teacher-patch");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_teachers_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] teachers.patch ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const { id } = await params;
    const teachers = await readSheetRows("Teachers");
    const currentTeacher = teachers.find((item) => String(item.id || "").trim() === id);

    if (!currentTeacher) {
      return apiFailure(404, "Không tìm thấy giáo viên.", undefined, requestId);
    }
    const before = await readSheetRowById("Teachers", id);

    const body = (await request.json()) as Record<string, unknown>;
    const name = body.name !== undefined ? String(body.name || "").trim() : String(currentTeacher.name || "").trim();
    const email =
      body.email !== undefined
        ? String(body.email || "")
            .trim()
            .toLowerCase()
        : String(currentTeacher.email || "")
            .trim()
            .toLowerCase();
    const phone = body.phone !== undefined ? String(body.phone || "").trim() : String(currentTeacher.phone || "").trim();
    const specialty =
      body.specialty !== undefined ? String(body.specialty || "").trim() : String(currentTeacher.specialty || "").trim();
    const active = body.active !== undefined ? parseBoolean(body.active, true) : parseBoolean(currentTeacher.active, true);
    const avatarUrl =
      String(currentTeacher.avatarUrl || "").trim() || getAvatarUrl(email || String(currentTeacher.email || ""), name);

    if (!name || !email) {
      return apiFailure(400, "Họ tên và Email là bắt buộc.", undefined, requestId);
    }
    if (!isValidEmail(email)) {
      return apiFailure(400, "Email không hợp lệ.", undefined, requestId);
    }

    const duplicateEmail = teachers.some(
      (teacher) =>
        String(teacher.id || "").trim() !== id &&
        String(teacher.email || "")
          .trim()
          .toLowerCase() === email,
    );
    if (duplicateEmail) {
      return apiFailure(409, "Email giáo viên đã tồn tại trong hệ thống.", undefined, requestId);
    }

    const now = new Date().toISOString();
    const patch = {
      name,
      email,
      phone: phone || "Chưa cập nhật",
      specialty: specialty || "Kỹ năng sống",
      active,
      avatarUrl,
      updatedAt: now,
    };

    await updateSheetRowById("Teachers", id, patch);
    await syncLinkedUser(id, patch, now);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "teacher.update",
      entityType: "Teacher",
      entityId: id,
      route: `/api/teachers/${id}`,
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

export async function DELETE(request: Request, { params }: Params) {
  const requestId = createRequestId("teacher-delete");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_teachers_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] teachers.delete ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const { id } = await params;
    const teachers = await readSheetRows("Teachers");
    const teacher = teachers.find((item) => String(item.id || "").trim() === id);
    if (!teacher) {
      return apiFailure(404, "Không tìm thấy giáo viên.", undefined, requestId);
    }

    const schedules = await readSheetRows("Schedules");
    const hasLinkedSchedules = schedules.some((item) => String(item.teacherId || "").trim() === id);
    if (hasLinkedSchedules) {
      return apiFailure(
        400,
        "Không thể xóa giáo viên vì đang có dữ liệu lịch dạy liên quan. Hãy tắt giáo viên thay vì xóa.",
        undefined,
        requestId,
      );
    }

    await deleteSheetRowById("Teachers", id);
    const linkedUsers = await readSheetRows("Users");
    const usersToDelete = linkedUsers.filter((user) => String(user.teacherId || "").trim() === id);
    for (const user of usersToDelete) {
      if (user.id) {
        await deleteSheetRowById("Users", String(user.id));
      }
    }

    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "teacher.delete",
      entityType: "Teacher",
      entityId: id,
      route: `/api/teachers/${id}`,
      method: "DELETE",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      before: teacher,
    });
    return NextResponse.json({
      id,
      deleted: true,
      deletedUsers: usersToDelete.map((user) => String(user.id || "")).filter(Boolean),
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}

async function syncLinkedUser(
  teacherId: string,
  patch: {
    name: string;
    email: string;
    active: boolean;
    avatarUrl: string;
  },
  now: string,
) {
  const users = await readSheetRows("Users");
  const linkedUser = users.find((user) => String(user.teacherId || "").trim() === teacherId);
  if (!linkedUser?.id) {
    return;
  }

  await updateSheetRowById("Users", String(linkedUser.id), {
    name: patch.name,
    email: patch.email,
    isActive: patch.active,
    avatarUrl: patch.avatarUrl,
    updatedAt: now,
  });
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  return ["true", "1", "yes", "active", "on"].includes(normalized);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
