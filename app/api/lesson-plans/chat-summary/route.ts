import { NextResponse } from "next/server";
import { apiError, createRequestId } from "@/lib/api";
import { ensureSheetHeaders, lessonPlanMessageHeaders, readSheetRows } from "@/lib/google-sheets";
import { requireSessionUser } from "@/lib/route-auth";

export async function GET(request: Request) {
  const requestId = createRequestId("lesson-plan-chat-summary");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    await ensureSheetHeaders("LessonPlanMessages", lessonPlanMessageHeaders);
    const [plans, messages] = await Promise.all([readSheetRows("LessonPlans"), readSheetRows("LessonPlanMessages")]);
    const visiblePlanIds = new Set(auth.user.role === "admin" ? plans.map((plan) => plan.id) : plans.filter((plan) => plan.teacherId === auth.user.teacherId).map((plan) => plan.id));
    const readIds = new Set(String(auth.user.readNotificationIds || "").split(",").map((id) => id.trim()).filter(Boolean));
    const byPlan: Record<string, { total: number; unread: number; latestAt: string }> = {};
    for (const message of messages) {
      if (!visiblePlanIds.has(message.lessonPlanId)) continue;
      const current = byPlan[message.lessonPlanId] || { total: 0, unread: 0, latestAt: "" };
      current.total += 1;
      if (message.senderUserId !== auth.user.id && !readIds.has(message.id)) current.unread += 1;
      if (message.createdAt > current.latestAt) current.latestAt = message.createdAt;
      byPlan[message.lessonPlanId] = current;
    }
    return NextResponse.json({ byPlan });
  } catch (error) {
    return apiError(error, requestId);
  }
}
