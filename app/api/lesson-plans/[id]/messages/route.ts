import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { appendSheetRowWithHeaders, ensureSheetHeaders, lessonPlanAttachmentHeaders, lessonPlanMessageHeaders, readSheetRowById, readSheetRows } from "@/lib/google-sheets";
import { evaluatePermission, requireSessionUser } from "@/lib/route-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const requestId = createRequestId("lesson-plan-chat");
  try {
    const auth = await requireSessionUser(request);
    const { id: lessonPlanId } = await params;
    const lessonPlan = await readSheetRowById("LessonPlans", lessonPlanId);
    if (!lessonPlan) return apiFailure(404, "Không tìm thấy giáo án.", undefined, requestId);
    const permission = evaluatePermission({
      allowed: auth.user.role === "admin" || auth.user.teacherId === lessonPlan.teacherId,
      reason: "lesson_plan_chat_not_owner",
    });
    if (!permission.allowed) return apiFailure(403, "Bạn không có quyền xem trao đổi của giáo án này.", undefined, requestId);

    await Promise.all([
      ensureSheetHeaders("LessonPlanMessages", lessonPlanMessageHeaders),
      ensureSheetHeaders("LessonPlanAttachments", lessonPlanAttachmentHeaders),
    ]);
    const [messageRows, attachmentRows] = await Promise.all([
      readSheetRows("LessonPlanMessages"),
      readSheetRows("LessonPlanAttachments"),
    ]);
    const messages = messageRows
      .filter((row) => row.lessonPlanId === lessonPlanId)
      .map((row) => ({
        id: row.id, lessonPlanId: row.lessonPlanId, senderUserId: row.senderUserId, senderName: row.senderName,
        senderEmail: row.senderEmail, senderRole: row.senderRole, content: row.content || "", createdAt: row.createdAt, updatedAt: row.updatedAt || undefined,
      }))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const attachments = await Promise.all(attachmentRows
      .filter((row) => row.lessonPlanId === lessonPlanId)
      .map(async (row) => {
        const shared = row.driveFileId ? await shareChatAttachmentViaGas(row.driveFileId, requestId) : null;
        return {
        id: row.id, messageId: row.messageId, lessonPlanId: row.lessonPlanId, fileName: row.fileName, mimeType: row.mimeType,
        sizeBytes: Number(row.sizeBytes || 0), kind: row.kind, driveFileId: row.driveFileId || undefined,
        url: shared?.dataUrl || shared?.driveUrl || (row.driveFileId ? driveContentUrl(row.driveFileId) : row.url),
        width: row.width ? Number(row.width) : undefined, height: row.height ? Number(row.height) : undefined, createdAt: row.createdAt,
        };
      }));
    return NextResponse.json({ messages, attachments });
  } catch (error) {
    return apiError(error, requestId);
  }
}

function driveContentUrl(fileId: string) {
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}

async function shareChatAttachmentViaGas(fileId: string, requestId: string) {
  const webhookUrl = process.env.GAS_UPLOAD_WEBHOOK_URL || process.env.GAS_MAIL_WEBHOOK_URL;
  const secret = process.env.GAS_UPLOAD_WEBHOOK_SECRET || process.env.GAS_MAIL_WEBHOOK_SECRET;
  if (!webhookUrl || !secret) return null;
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=utf-8" },
      body: JSON.stringify({ action: "shareLessonPlanChatAttachment", secret, fileId, requestId }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);
    return response.ok && result?.ok && result.attachment?.driveUrl
      ? result.attachment as { driveUrl: string; dataUrl?: string }
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId("lesson-plan-message");
  try {
    const auth = await requireSessionUser(request);
    const { id: lessonPlanId } = await params;
    const lessonPlan = await readSheetRowById("LessonPlans", lessonPlanId);
    if (!lessonPlan) return apiFailure(404, "Không tìm thấy giáo án.", undefined, requestId);
    const permission = evaluatePermission({ allowed: auth.user.role === "admin" || auth.user.teacherId === lessonPlan.teacherId, reason: "lesson_plan_chat_not_owner" });
    if (!permission.allowed) return apiFailure(403, "Bạn không có quyền phản hồi giáo án này.", undefined, requestId);
    const body = await request.json();
    const content = String(body.content || "").trim();
    if (!content || content.length > 5_000) return apiFailure(400, "Nội dung phản hồi phải từ 1 đến 5.000 ký tự.", undefined, requestId);
    const now = new Date().toISOString();
    const message = {
      id: createId("lpm"), lessonPlanId, senderUserId: auth.user.id, senderName: auth.user.name, senderEmail: auth.user.email,
      senderRole: auth.user.role, content, createdAt: now, updatedAt: now,
    };
    await appendSheetRowWithHeaders("LessonPlanMessages", lessonPlanMessageHeaders, message);
    await appendAuditLog({ requestId, actor: auth.user, action: "lesson_plan_chat.message.create", entityType: "LessonPlan", entityId: lessonPlanId, route: `/api/lesson-plans/${lessonPlanId}/messages`, method: "POST", authMode: permission.authMode, decision: permission.decision, reason: permission.reason, source: auth.source, after: { messageId: message.id } });
    return NextResponse.json(message);
  } catch (error) {
    return apiError(error, requestId);
  }
}
