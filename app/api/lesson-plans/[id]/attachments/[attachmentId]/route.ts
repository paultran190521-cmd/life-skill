import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { readSheetRowsBatch } from "@/lib/google-sheets";
import { requireSessionUser } from "@/lib/route-auth";
import { isExpiredChatImage } from "@/lib/chat-retention";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const requestId = createRequestId("chat-image");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    const { id, attachmentId } = await params;
    const rows = await readSheetRowsBatch(["LessonPlans", "LessonPlanAttachments"] as const);
    const plan = rows.LessonPlans.find((row) => row.id === id);
    if (!plan) return apiFailure(404, "Không tìm thấy giáo án.", undefined, requestId);
    if (auth.user.role !== "admin" && auth.user.teacherId !== plan.teacherId) return apiFailure(403, "Bạn không có quyền xem ảnh này.", undefined, requestId);
    const attachment = rows.LessonPlanAttachments.find((row) => row.id === attachmentId && row.lessonPlanId === id);
    if (!attachment?.driveFileId || attachment.kind !== "image") return apiFailure(404, "Không tìm thấy ảnh.", undefined, requestId);
    if (isExpiredChatImage(attachment)) return apiFailure(410, "Ảnh đã hết thời hạn lưu 5 tháng.", undefined, requestId);
    const url = process.env.GAS_UPLOAD_WEBHOOK_URL || process.env.GAS_MAIL_WEBHOOK_URL;
    const secret = process.env.GAS_UPLOAD_WEBHOOK_SECRET || process.env.GAS_MAIL_WEBHOOK_SECRET;
    if (!url || !secret) throw new Error("Missing chat image webhook configuration");
    const result = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "shareLessonPlanChatAttachment", secret, fileId: attachment.driveFileId, requestId }),
      signal: AbortSignal.timeout(25_000), cache: "no-store",
    });
    const payload = await result.json();
    const data = payload?.attachment?.dataUrl;
    const match = typeof data === "string" ? /^data:(image\/(?:png|jpeg|webp|gif|avif|bmp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(data) : null;
    if (!result.ok || !payload?.ok || !match) return apiFailure(502, "Không tải được ảnh. Vui lòng thử lại.", undefined, requestId);
    const bytes = Buffer.from(match[2], "base64");
    return new Response(bytes, { headers: {
      "Content-Type": match[1], "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return apiError(error, requestId); }
}
