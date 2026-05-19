import { readSheetRows } from "@/lib/google-sheets";
import type { Role, User } from "@/lib/types";

export async function findAuthorizedUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const users = await readUsers();
  const existingUser = users.find(
    (user) => normalizeEmail(user.email) === normalizedEmail && user.isActive !== false,
  );

  if (existingUser) {
    return existingUser;
  }

  const teacherRows = await readSheetRows("Teachers");
  const teacher = teacherRows.find(
    (row) => normalizeEmail(row.email) === normalizedEmail && parseBoolean(row.active, true),
  );

  if (!teacher) {
    return null;
  }

  return {
    id: `u-${teacher.id}`,
    name: teacher.name,
    email: teacher.email,
    role: "teacher",
    teacherId: teacher.id,
    avatarUrl: teacher.avatarUrl || undefined,
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

async function readUsers() {
  const rows = await readSheetRows("Users");
  return rows.map<User>((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: normalizeRole(row.role),
    teacherId: row.teacherId || undefined,
    avatarUrl: row.avatarUrl || undefined,
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
