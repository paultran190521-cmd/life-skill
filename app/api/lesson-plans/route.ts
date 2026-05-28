import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { validationError } from "@/lib/app-error";
import { appendSheetRowWithHeaders, ensureSheetHeaders, readSheetRowById, updateSheetRowById } from "@/lib/google-sheets";
import { evaluatePermission, requireSessionUser } from "@/lib/route-auth";

export const runtime = "nodejs";

const lessonPlanHeaders = [
  "id",
  "scheduleId",
  "teacherId",
  "fileName",
  "driveFileId",
  "driveUrl",
  "source",
  "uploadedAt",
  "createdAt",
  "updatedAt",
];

export async function POST(request: Request) {
  const requestId = createRequestId("lesson-plan");
  try {
    const auth = await requireSessionUser(request);
    const body = await request.json();
    const scheduleId = String(body.scheduleId || "").trim();
    const teacherId = String(body.teacherId || "").trim();
    const fileName = String(body.fileName || "").trim();
    const driveFileId = String(body.driveFileId || "").trim();
    const driveUrl = normalizeExternalUrl(body.driveUrl);
    const source = String(body.source || "").trim() === "external_link" ? "external_link" : "upload";

    if (!scheduleId || !teacherId) {
      return apiFailure(400, "Thiếu scheduleId hoặc teacherId.", undefined, requestId);
    }
    const schedule = await readSheetRowById("Schedules", scheduleId);
    if (!schedule) {
      return apiFailure(404, "Không tìm thấy lịch dạy.", undefined, requestId);
    }
    const permission = evaluatePermission({
      allowed: auth.user.role === "admin" || auth.user.teacherId === schedule.teacherId,
      reason: "teacher_must_own_schedule_lesson_plan",
    });
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] lesson-plans.create ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thao tác giáo án của lịch này.", undefined, requestId);
    }
    if (teacherId !== String(schedule.teacherId || "").trim()) {
      return apiFailure(400, "Giáo viên không khớp với lịch dạy đã chọn.", undefined, requestId);
    }
    if (!fileName || !driveUrl) {
      return apiFailure(400, "Thiếu tên giáo án hoặc liên kết giáo án.", undefined, requestId);
    }
    if (source === "upload" && !driveFileId) {
      return apiFailure(400, "Thiếu thông tin tệp Google Drive.", undefined, requestId);
    }

    const now = new Date().toISOString();
    const lessonPlan = {
      id: createId("lp"),
      scheduleId,
      teacherId,
      fileName,
      driveFileId: source === "external_link" ? "" : driveFileId,
      driveUrl,
      source,
      uploadedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await ensureSheetHeaders("LessonPlans", lessonPlanHeaders);
    await appendSheetRowWithHeaders("LessonPlans", lessonPlanHeaders, lessonPlan);
    if (schedule.status !== "attended") {
      await updateSheetRowById("Schedules", scheduleId, { status: "lesson_plan_uploaded", updatedAt: now });
    }
    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: "lesson_plan.create",
      entityType: "LessonPlan",
      entityId: lessonPlan.id,
      route: "/api/lesson-plans",
      method: "POST",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      after: lessonPlan,
    });
    return NextResponse.json(lessonPlan);
  } catch (error) {
    return apiError(error, requestId);
  }
}

function normalizeExternalUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw validationError("Liên kết giáo án không hợp lệ.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw validationError("Liên kết giáo án phải bắt đầu bằng http hoặc https.");
  }

  return url.toString();
}
