import { readSheetRows } from "@/lib/google-sheets";
import { getAvatarUrl } from "@/lib/avatar";
import type { Role, User } from "@/lib/types";

export async function findAuthorizedUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const users = await readUsers();
  const existingUser = users.find(
    (user) => normalizeEmail(user.email) === normalizedEmail && user.isActive !== false,
  );

  const teacherRows = await readSheetRows("Teachers");
  const teacher = teacherRows.find(
    (row) => normalizeEmail(row.email) === normalizedEmail && parseBoolean(row.active, true),
  );

  if (existingUser) {
    if (existingUser.role === "teacher" && !existingUser.teacherId && teacher) {
      return {
        ...existingUser,
        teacherId: teacher.id,
        name: existingUser.name || teacher.name,
        avatarUrl: existingUser.avatarUrl || teacher.avatarUrl || getAvatarUrl(teacher.email, teacher.name),
      } satisfies User;
    }
    return existingUser;
  }

  if (!teacher) {
    return null;
  }

  return {
    id: `u-${teacher.id}`,
    name: teacher.name,
    email: teacher.email,
    role: "teacher",
    teacherId: teacher.id,
    avatarUrl: teacher.avatarUrl || getAvatarUrl(teacher.email, teacher.name),
    isActive: true,
  } satisfies User;
}

export async function findAuthorizedUserFromSession(userId: string, email: string) {
  const users = await readUsers();
  const user =
    users.find((item) => item.id === userId && item.isActive !== false) ??
    users.find((item) => normalizeEmail(item.email) === normalizeEmail(email) && item.isActive !== false);

  if (user) {
    return user;
  }

  return findAuthorizedUserByEmail(email);
}

export async function findAuthorizedUserFromHint(userId?: string | null, email?: string | null) {
  const users = await readUsers();
  const normalizedEmail = normalizeEmail(String(email || ""));

  if (userId) {
    const userById = users.find((item) => item.id === userId && item.isActive !== false);
    if (userById) {
      return userById;
    }
  }

  if (normalizedEmail) {
    const userByEmail = users.find(
      (item) => normalizeEmail(item.email) === normalizedEmail && item.isActive !== false,
    );
    if (userByEmail) {
      return userByEmail;
    }
    return findAuthorizedUserByEmail(normalizedEmail);
  }

  return null;
}

async function readUsers() {
  const rows = await readSheetRows("Users");
  return rows.map<User>((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: normalizeRole(row.role),
    teacherId: row.teacherId || undefined,
    avatarUrl: row.avatarUrl || getAvatarUrl(row.email, row.name),
    isActive: parseBoolean(row.isActive, true),
  }));
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeRole(role: string): Role {
  return role === "teacher" ? "teacher" : "admin";
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  return ["true", "1", "yes", "active"].includes(value.toLowerCase());
}
