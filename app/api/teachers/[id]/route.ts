import { NextResponse } from "next/server";
import { getAvatarUrl } from "@/lib/avatar";
import { apiError } from "@/lib/api";
import { deleteSheetRowById, readSheetRows, updateSheetRowById } from "@/lib/google-sheets";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const teachers = await readSheetRows("Teachers");
    const currentTeacher = teachers.find((item) => String(item.id || "").trim() === id);

    if (!currentTeacher) {
      return NextResponse.json({ error: "Không tìm thấy giáo viên." }, { status: 404 });
    }

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
      return NextResponse.json({ error: "Họ tên và Email là bắt buộc." }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
    }

    const duplicateEmail = teachers.some(
      (teacher) =>
        String(teacher.id || "").trim() !== id &&
        String(teacher.email || "")
          .trim()
          .toLowerCase() === email,
    );
    if (duplicateEmail) {
      return NextResponse.json({ error: "Email giáo viên đã tồn tại trong hệ thống." }, { status: 400 });
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

    return NextResponse.json({ id, ...patch });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const teachers = await readSheetRows("Teachers");
    const teacher = teachers.find((item) => String(item.id || "").trim() === id);
    if (!teacher) {
      return NextResponse.json({ error: "Không tìm thấy giáo viên." }, { status: 404 });
    }

    const schedules = await readSheetRows("Schedules");
    const hasLinkedSchedules = schedules.some((item) => String(item.teacherId || "").trim() === id);
    if (hasLinkedSchedules) {
      return NextResponse.json(
        {
          error: "Không thể xóa giáo viên vì đang có dữ liệu lịch dạy liên quan. Hãy tắt giáo viên thay vì xóa.",
        },
        { status: 400 },
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

    return NextResponse.json({
      id,
      deleted: true,
      deletedUsers: usersToDelete.map((user) => String(user.id || "")).filter(Boolean),
    });
  } catch (error) {
    return apiError(error);
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
