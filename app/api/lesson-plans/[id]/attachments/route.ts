import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { appendSheetRowWithHeaders, lessonPlanAttachmentHeaders, lessonPlanMessageHeaders, readSheetRowById } from "@/lib/google-sheets";
import { evaluatePermission, requireSessionUser } from "@/lib/route-auth";

type Params = { params: Promise<{ id: string }> };
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId("lesson-plan-attachment");
  try {
    const auth = await requireSessionUser(request);
    const { id: lessonPlanId } = await params;
    const lessonPlan = await readSheetRowById("LessonPlans", lessonPlanId);
    if (!lessonPlan) return apiFailure(404, "Không tìm thấy giáo án.", undefined, requestId);
    const permission = evaluatePermission({ allowed: auth.user.role === "admin" || auth.user.teacherId === lessonPlan.teacherId, reason: "lesson_plan_chat_not_owner" });
    if (!permission.allowed) return apiFailure(403, "Bạn không có quyền gửi tệp cho giáo án này.", undefined, requestId);
    const body = await request.json();
    const fileName = String(body.fileName || "").trim().slice(0, 180);
    const mimeType = String(body.mimeType || "application/octet-stream").trim();
    const fileData = String(body.fileData || "").trim();
    if (!fileName || !fileData) return apiFailure(400, "Thiếu tệp đính kèm.", undefined, requestId);
    const bytes = Buffer.from(fileData, "base64");
    if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) return apiFailure(413, "Tệp vượt quá 10 MB. Hãy tải lên Google Drive rồi gửi link.", undefined, requestId);
    if (!isSafeMimeType(mimeType, fileName)) return apiFailure(400, "Định dạng tệp không được hỗ trợ.", undefined, requestId);

    const now = new Date().toISOString();
    const message = { id: createId("lpm"), lessonPlanId, senderUserId: auth.user.id, senderName: auth.user.name, senderEmail: auth.user.email, senderRole: auth.user.role, content: String(body.content || "").trim().slice(0, 5_000), createdAt: now, updatedAt: now };
    const uploaded = await uploadChatAttachmentViaGas({ lessonPlanId, fileName, mimeType, fileData, fileSize: bytes.byteLength, requestId });
    const attachment = {
      id: createId("lpa"), messageId: message.id, lessonPlanId, fileName, mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes, kind: mimeType.startsWith("image/") ? "image" : "file",
      driveFileId: uploaded.driveFileId,
      url: uploaded.driveUrl,
      width: Number(body.width) || "", height: Number(body.height) || "", createdAt: now,
    };
    await Promise.all([
      appendSheetRowWithHeaders("LessonPlanMessages", lessonPlanMessageHeaders, message),
      appendSheetRowWithHeaders("LessonPlanAttachments", lessonPlanAttachmentHeaders, attachment),
    ]);
    await appendAuditLog({ requestId, actor: auth.user, action: "lesson_plan_chat.attachment.create", entityType: "LessonPlan", entityId: lessonPlanId, route: `/api/lesson-plans/${lessonPlanId}/attachments`, method: "POST", authMode: permission.authMode, decision: permission.decision, reason: permission.reason, source: auth.source, after: { messageId: message.id, attachmentId: attachment.id, sizeBytes: uploaded.sizeBytes } });
    return NextResponse.json({ message, attachment: { ...attachment, url: attachment.kind === "image" ? `/api/lesson-plans/${encodeURIComponent(lessonPlanId)}/attachments/${encodeURIComponent(attachment.id)}` : attachment.url } });
  } catch (error) {
    return apiError(error, requestId);
  }
}

async function uploadChatAttachmentViaGas(input: { lessonPlanId: string; fileName: string; mimeType: string; fileData: string; fileSize: number; requestId: string }) {
  const webhookUrl = process.env.GAS_UPLOAD_WEBHOOK_URL || process.env.GAS_MAIL_WEBHOOK_URL;
  const secret = process.env.GAS_UPLOAD_WEBHOOK_SECRET || process.env.GAS_MAIL_WEBHOOK_SECRET;
  if (!webhookUrl || !secret) throw new Error("Thiếu cấu hình GAS upload cho tệp chat.");
  const response = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json;charset=utf-8" }, body: JSON.stringify({ action: "uploadLessonPlanChatAttachment", secret, ...input }) });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok || !result.attachment?.driveFileId) {
    throw new Error(result?.error || `Không thể lưu tệp chat vào Drive. HTTP ${response.status}.`);
  }
  return result.attachment as { driveFileId: string; driveUrl: string; sizeBytes: number; mimeType: string };
}

function isSafeMimeType(mimeType: string, fileName: string) {
  if (mimeType.startsWith("image/")) return true;
  const allowed = ["application/pdf", "text/plain", "text/csv", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
  return allowed.includes(mimeType) || /\.(pdf|txt|csv|docx?|pptx?|xlsx?)$/i.test(fileName);
}
