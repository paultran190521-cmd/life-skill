import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { ensureSheetHeaders, readSheetRowsBatch, scheduleHeaders, toSchedules, updateSheetRowById } from "@/lib/google-sheets";
import { canReuseLessonPlan } from "@/lib/lesson-plan-reuse";
import { evaluatePermission, requireSessionUser } from "@/lib/route-auth";
import type { LessonPlan } from "@/lib/types";

export async function POST(request: Request) {
  const requestId = createRequestId("lesson-plan-reuse");
  try {
    const auth = await requireSessionUser(request);
    const body = await request.json();
    const scheduleId = String(body.scheduleId || "").trim();
    const sourcePlanId = String(body.sourcePlanId || "").trim();
    if (!scheduleId || !sourcePlanId) return apiFailure(400, "Thiếu lịch hoặc kế hoạch đã gửi.", undefined, requestId);

    const rows = await readSheetRowsBatch(["Schedules", "LessonPlans"] as const);
    const schedules = toSchedules(rows.Schedules);
    const target = schedules.find((item) => item.id === scheduleId);
    if (!target) return apiFailure(404, "Không tìm thấy lịch dạy.", undefined, requestId);
    const permission = evaluatePermission({
      allowed: auth.user.role === "admin" || (auth.user.role === "teacher" && auth.user.teacherId === target.teacherId),
      reason: "teacher_must_own_schedule_lesson_plan_reuse",
    });
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền xác nhận kế hoạch cho lịch này.", undefined, requestId);
    }
    const planRow = rows.LessonPlans.find((item) => item.id === sourcePlanId);
    const source = planRow && schedules.find((item) => item.id === planRow.scheduleId);
    const plan = planRow as LessonPlan | undefined;
    if (!plan || !source || !canReuseLessonPlan(target, source, plan)) {
      return apiFailure(409, "Kế hoạch trước đó không cùng giáo viên, bài, tiết hoặc không được gửi trước lịch này.", undefined, requestId);
    }
    if (rows.LessonPlans.some((item) => item.scheduleId === target.id)) {
      return apiFailure(409, "Lịch này đã có kế hoạch giảng dạy.", undefined, requestId);
    }
    if (target.reusedLessonPlanId === sourcePlanId) return NextResponse.json({ scheduleId, reusedLessonPlanId: sourcePlanId });

    await ensureSheetHeaders("Schedules", scheduleHeaders);
    await updateSheetRowById("Schedules", scheduleId, { reusedLessonPlanId: sourcePlanId, updatedAt: new Date().toISOString() });
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "lesson_plan.reuse",
      entityType: "Schedule",
      entityId: scheduleId,
      route: "/api/lesson-plans/reuse",
      method: "POST",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      before: { reusedLessonPlanId: target.reusedLessonPlanId || "" },
      after: { reusedLessonPlanId: sourcePlanId },
    });
    return NextResponse.json({ scheduleId, reusedLessonPlanId: sourcePlanId });
  } catch (error) {
    return apiError(error, requestId);
  }
}
