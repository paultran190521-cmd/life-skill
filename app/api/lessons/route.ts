import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog, appendAuditLogs } from "@/lib/audit";
import { conflictError } from "@/lib/app-error";
import {
  appendSheetRow,
  appendSheetRows,
  ensureSheetHeaders,
  lessonHeaders,
  readSheetRows,
} from "@/lib/google-sheets";
import { lessonDuplicateKey, normalizeLessonInput } from "@/lib/lessons";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";

export async function GET() {
  const requestId = createRequestId("lessons-list");
  try {
    return NextResponse.json(await readSheetRows("Lessons"));
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId("lesson");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_lessons_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] lessons.create ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const body = await request.json();
    const isBulk = Array.isArray(body?.lessons) || Array.isArray(body);
    const rawLessons = Array.isArray(body?.lessons) ? body.lessons : Array.isArray(body) ? body : [body];
    const now = new Date().toISOString();

    // Các Sheet cũ không có các cột tiết 1/tiết 2. Đồng bộ header ngay trước
    // khi ghi để import không phụ thuộc vào việc người dùng đã mở trang chủ.
    await ensureSheetHeaders("Lessons", lessonHeaders);
    const existingLessons = await readSheetRows("Lessons");
    const existingByKey = new Map(
      existingLessons
        .filter((lesson) => String(lesson.active || "true").trim().toLowerCase() !== "false")
        .map((lesson) => [lessonDuplicateKey(lesson), lesson]),
    );
    const incomingByKey = new Map<string, number>();
    const lessons = rawLessons.map((item: Record<string, unknown>, index: number) => {
      const lesson = {
        id: typeof item.id === "string" && item.id ? item.id : createId("l"),
        ...normalizeLessonInput(item, index),
        active: item.active ?? true,
        createdAt: now,
        updatedAt: now,
      };
      const duplicateKey = lessonDuplicateKey(lesson);
      const existing = existingByKey.get(duplicateKey);
      if (existing) {
        throw conflictError(`Dòng ${index + 1} bị trùng với bài đã lưu: “${existing.title || lesson.title}”.`);
      }
      const duplicateRow = incomingByKey.get(duplicateKey);
      if (duplicateRow !== undefined) {
        throw conflictError(`Dòng ${index + 1} bị trùng hoàn toàn với dòng ${duplicateRow + 1} trong lần lưu này.`);
      }
      incomingByKey.set(duplicateKey, index);
      return lesson;
    });

    if (isBulk) {
      await appendSheetRows("Lessons", lessons);
      // Ghi audit theo lô thay vì mở một request Google Sheets cho từng bài.
      // Một lượt import 45 bài trước đây tạo 45 ghi đồng thời và dễ chạm quota.
      await appendAuditLogs(
        lessons.map((lesson: Record<string, unknown>) => ({
            requestId,
            actor: auth.user,
            action: "lesson.create",
            entityType: "Lesson",
            entityId: String(lesson.id),
            route: "/api/lessons",
            method: "POST",
            authMode: permission.authMode,
            decision: permission.decision,
            reason: permission.reason,
            source: auth.source,
            after: lesson,
          })),
      );
      return NextResponse.json({ lessons });
    }

    await appendSheetRow("Lessons", lessons[0]);
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "lesson.create",
      entityType: "Lesson",
      entityId: String((lessons[0] as Record<string, unknown>).id),
      route: "/api/lessons",
      method: "POST",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      after: lessons[0] as Record<string, unknown>,
    });
    return NextResponse.json(lessons[0]);
  } catch (error) {
    return apiError(error, requestId);
  }
}
