import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { readSheetRowsBatch } from "@/lib/google-sheets";
import { canSendIntakeMail, intakeSmtpConfigured, sendIntakeMail, sendIntakeTestMail, type IntakeMailEvent } from "@/lib/school-intake-mail";
import { parseIntakeBatch, readIntakeSettings, readIntakeTab, writeIntakeRanges } from "@/lib/school-intake-storage";

export const runtime = "nodejs";

type NotifyBody = { event?: IntakeMailEvent | "test"; batchId?: string };

async function verifiedActor(request: Request) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") || "");
  if (!match) return "";
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${match[1]}` }, cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return "";
  const profile = await response.json() as { email?: string; email_verified?: boolean };
  return profile.email_verified ? String(profile.email || "").trim().toLowerCase() : "";
}

export async function POST(request: Request) {
  const requestId = createRequestId("school-intake-notify");
  try {
    const settings = await readIntakeSettings();
    const actorEmail = await verifiedActor(request);
    if (!actorEmail || ![settings.submitter, settings.reviewer].includes(actorEmail)) return apiFailure(401, "Tài khoản Google chưa được phép gửi thông báo lịch.", undefined, requestId);
    const body = await request.json() as NotifyBody;
    if (body.event === "test") {
      if (!intakeSmtpConfigured()) return apiFailure(503, "Chưa cấu hình SMTP của lifeskill@mettasoul.vn trên hệ thống.", undefined, requestId);
      let delivered: Awaited<ReturnType<typeof sendIntakeTestMail>>;
      try { delivered = await sendIntakeTestMail(actorEmail); }
      catch { return apiFailure(502, "SMTP chưa gửi được email kiểm tra. Hãy kiểm tra tài khoản và mật khẩu ứng dụng.", undefined, requestId); }
      await appendAuditLog({ requestId, actor: { id: `school-intake:${actorEmail}`, email: actorEmail }, action: "school_intake.mail_test", entityType: "SchoolIntakeNotification", entityId: requestId, route: "/api/school-intake/notify", method: "POST", authMode: "enforce", decision: "allow", source: "email-token", after: delivered });
      return NextResponse.json({ sent: true, to: actorEmail });
    }
    if (!body.event || !["submitted", "returned", "approved"].includes(body.event) || !/^[a-zA-Z0-9_-]{12,100}$/.test(body.batchId || "")) {
      return apiFailure(400, "Loại thông báo hoặc mã đợt không hợp lệ.", undefined, requestId);
    }
    const event = body.event;
    const batches = await readIntakeTab("Đợt duyệt", "R", 1000);
    const batchIndex = batches.findIndex((row, index) => index > 0 && row[0] === body.batchId);
    if (batchIndex < 0) return apiFailure(404, "Không tìm thấy đợt lịch.", undefined, requestId);
    const batch = parseIntakeBatch(batches[batchIndex], batchIndex + 1);
    if (!canSendIntakeMail(event, batch, settings, actorEmail)) return apiFailure(409, "Trạng thái đợt lịch hoặc vai trò không khớp thông báo này.", undefined, requestId);

    const eventId = `${batch.id}:${event}`;
    const audit = await readSheetRowsBatch(["AuditLogs"] as const);
    const events = audit.AuditLogs.filter((row) => row.entityType === "SchoolIntakeNotification" && row.entityId === eventId);
    const last = events.at(-1)?.action || "";
    if (last === "school_intake.mail_sent" || (event === "approved" && Boolean(batch.raw[16]))) {
      if (event === "approved" && !batch.raw[16]) await writeIntakeRanges([{ range: `'Đợt duyệt'!Q${batch.number}`, values: [[new Date().toISOString()]] }]);
      return NextResponse.json({ sent: true, alreadySent: true });
    }
    if (last === "school_intake.mail_attempt") return apiFailure(409, "Lần gửi trước chưa rõ kết quả; cần kiểm tra nhật ký trước khi thử lại để tránh gửi trùng.", undefined, requestId);
    if (!intakeSmtpConfigured()) return apiFailure(503, "Chưa cấu hình SMTP của lifeskill@mettasoul.vn trên hệ thống.", undefined, requestId);
    const actor = { id: `school-intake:${actorEmail}`, email: actorEmail };
    const auditBase = { actor, entityType: "SchoolIntakeNotification", entityId: eventId, route: "/api/school-intake/notify", method: "POST", authMode: "enforce" as const, decision: "allow" as const, source: "email-token" as const };
    await appendAuditLog({ ...auditBase, requestId, action: "school_intake.mail_attempt", after: { event, recipientRole: event === "submitted" ? "reviewer" : event === "returned" ? "submitter" : "director" } });
    let delivered: Awaited<ReturnType<typeof sendIntakeMail>>;
    try {
      delivered = await sendIntakeMail(event, batch, settings);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code).slice(0, 40) : "SMTP_ERROR";
      await appendAuditLog({ ...auditBase, requestId, action: "school_intake.mail_failed", after: { event, code } });
      return apiFailure(502, "SMTP chưa gửi được email từ lifeskill@mettasoul.vn. Kiểm tra cấu hình hoặc dùng lệnh gửi lại sau.", undefined, requestId);
    }
    await appendAuditLog({ ...auditBase, requestId, action: "school_intake.mail_sent", after: { event, recipient: delivered.to, messageId: delivered.messageId } });
    if (event === "approved" && !batch.raw[16]) await writeIntakeRanges([{ range: `'Đợt duyệt'!Q${batch.number}`, values: [[new Date().toISOString()]] }]);
    return NextResponse.json({ sent: true, to: delivered.to });
  } catch (error) { return apiError(error, requestId); }
}
