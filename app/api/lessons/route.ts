import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { appendSheetRow, appendSheetRows, readSheetRows } from "@/lib/google-sheets";
import { normalizeLessonInput } from "@/lib/lessons";
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

    const lessons = rawLessons.map((item: Record<string, unknown>, index: number) => ({
      id: typeof item.id === "string" && item.id ? item.id : createId("l"),
      ...normalizeLessonInput(item, index),
      active: item.active ?? true,
      createdAt: now,
      updatedAt: now,
    }));

    if (isBulk) {
      await appendSheetRows("Lessons", lessons);
      await Promise.all(
        lessons.map((lesson: Record<string, unknown>) =>
          appendAuditLog({
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
          }),
        ),
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
