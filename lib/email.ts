import { createScheduleConfirmationBatchToken, createScheduleConfirmationToken } from "@/lib/schedule-confirmation";
import { appendSheetRowWithHeaders } from "@/lib/google-sheets";
import { formatAcademicWeekLabel } from "@/lib/academic-week";
import nodemailer from "nodemailer";
import type { Schedule } from "@/lib/types";

type ScheduleEmailLesson = {
  title?: string;
  objective?: string;
  lesson1Title?: string;
  lesson1Objective?: string;
  lesson2Title?: string;
  lesson2Objective?: string;
};

type ScheduleEmailInput = {
  schedule: Schedule;
  teacher: { name?: string; email?: string };
  school?: { name?: string };
  classRoom?: { name?: string };
  lesson?: ScheduleEmailLesson;
  slot?: { label?: string; start?: string; end?: string };
};

type ScheduleDigestRow = {
  schedule: Schedule;
  school?: { name?: string };
  classRoom?: { name?: string };
  participantClassNames?: string[];
  assistantNames?: string[];
  coTeacherNames?: string[];
  lesson?: ScheduleEmailLesson;
  slot?: { label?: string; start?: string; end?: string };
};

type ScheduleDigestInput = {
  teacher: { name?: string; email?: string };
  schedules: Schedule[];
  rows: ScheduleDigestRow[];
};

type ResendResponse = {
  id?: string;
  message?: string;
  error?: string;
};

type GasResponse = {
  ok?: boolean;
  error?: string;
  requestId?: string;
  version?: string;
  echo?: {
    templateVersion?: string;
    htmlDigest?: string;
  };
};

const scheduleEmailTemplateVersion = "mettasoul-schedule-email-2026-05-28";
const expectedGasWebhookVersion = "mettasoul-gas-2026-05-28";
const mailDebugHeaders = [
  "id",
  "requestId",
  "source",
  "provider",
  "event",
  "to",
  "subject",
  "sent",
  "reason",
  "errorCode",
  "templateVersion",
  "gasVersion",
  "httpStatus",
  "scheduleIds",
  "teacherId",
  "htmlDigest",
  "inputHtmlDigest",
  "normalizedHtmlDigest",
  "htmlPreview",
  "createdAt",
];

export async function sendScheduleEmail(input: ScheduleEmailInput) {
  return sendScheduleDigestEmail({
    teacher: input.teacher,
    schedules: [input.schedule],
    rows: [
      {
        schedule: input.schedule,
        school: input.school,
        classRoom: input.classRoom,
        lesson: input.lesson,
        slot: input.slot,
      },
    ],
  });
}

export async function sendScheduleDigestEmail(input: ScheduleDigestInput) {
  const requestId = createEmailRequestId();
  const from = process.env.EMAIL_FROM;
  const to = normalizeEmailAddress(input.teacher.email);
  const scheduleIds = input.schedules.map((schedule) => schedule.id);
  const teacherId = input.schedules[0]?.teacherId || "";

  if (!to) {
    await logMailDebug({
      requestId,
      source: "next",
      provider: process.env.EMAIL_PROVIDER || "resend",
      event: "next.recipient_missing",
      sent: false,
      reason: "Teacher email is missing.",
      scheduleIds,
      teacherId,
    });
    return { sent: false, reason: "Teacher email is missing." };
  }

  if (!isValidEmailAddress(to)) {
    const reason = `Teacher email is invalid: ${to}`;
    await logMailDebug({
      requestId,
      source: "next",
      provider: process.env.EMAIL_PROVIDER || "resend",
      event: "next.recipient_invalid",
      to,
      sent: false,
      reason,
      scheduleIds,
      teacherId,
    });
    return { sent: false, reason };
  }

  const subject = buildScheduleWeekSubject(input.schedules);
  const html = renderScheduleDigestEmail(input);

  if (process.env.EMAIL_PROVIDER === "gas") {
    return sendViaGas({ to, subject, html, from, requestId, scheduleIds, teacherId });
  }

  if (process.env.EMAIL_PROVIDER === "smtp") {
    return sendViaSmtp({ to, subject, html, from, requestId, scheduleIds, teacherId });
  }

  return sendViaResend({ to, subject, html, from, requestId, scheduleIds, teacherId });
}

async function sendViaSmtp({
  to,
  subject,
  html,
  from,
  requestId,
  scheduleIds,
  teacherId,
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  requestId: string;
  scheduleIds: string[];
  teacherId: string;
}) {
  const host = String(process.env.SMTP_HOST || "").trim();
  const user = normalizeEmailAddress(process.env.SMTP_USER);
  const pass = String(process.env.SMTP_PASS || "").replace(/\s/g, "");
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || (!process.env.SMTP_SECURE && port === 465);
  const sender = from || user;

  if (!host || !user || !pass || !sender || !Number.isInteger(port) || port < 1 || port > 65535) {
    const reason = "Missing or invalid SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, or EMAIL_FROM.";
    await logMailDebug({
      requestId, source: "next", provider: "smtp", event: "next.smtp_config_missing", to, subject, sent: false, reason, scheduleIds, teacherId,
    });
    return { sent: false, reason };
  }

  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
    const result = await transport.sendMail({ from: sender, to, subject, html });
    await logMailDebug({
      requestId, source: "next", provider: "smtp", event: "next.smtp_success", to, subject, sent: true,
      reason: result.response || "SMTP accepted schedule email.", scheduleIds, teacherId,
    });
    return { sent: true, id: result.messageId };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Cannot reach SMTP server.";
    await logMailDebug({
      requestId, source: "next", provider: "smtp", event: "next.smtp_send_error", to, subject, sent: false, reason, scheduleIds, teacherId,
    });
    return { sent: false, reason };
  }
}

async function sendViaGas({
  to,
  subject,
  html,
  from,
  requestId,
  scheduleIds,
  teacherId,
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  requestId: string;
  scheduleIds: string[];
  teacherId: string;
}) {
  const webhookUrl = process.env.GAS_MAIL_WEBHOOK_URL;
  const secret = process.env.GAS_MAIL_WEBHOOK_SECRET;

  if (!webhookUrl || !secret) {
    await logMailDebug({
      requestId,
      source: "next",
      provider: "gas",
      event: "next.config_missing",
      to,
      subject,
      sent: false,
      reason: "Missing GAS_MAIL_WEBHOOK_URL or GAS_MAIL_WEBHOOK_SECRET.",
      templateVersion: scheduleEmailTemplateVersion,
      scheduleIds,
      teacherId,
    });
    return { sent: false, reason: "Missing GAS_MAIL_WEBHOOK_URL or GAS_MAIL_WEBHOOK_SECRET." };
  }

  try {
    const htmlDigest = await createSha256Hex(html);
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "sendScheduleEmail",
        secret,
        requestId,
        templateVersion: scheduleEmailTemplateVersion,
        htmlDigest,
        to,
        subject,
        html,
        from,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as GasResponse;
    if (!response.ok || !body.ok) {
      const reason = body.error || `GAS mail webhook failed: ${response.status}`;
      await logMailDebug({
        requestId,
        source: "next",
        provider: "gas",
        event: "next.gas_response_failed",
        to,
        subject,
        sent: false,
        reason,
        errorCode: String((body as GasResponse & { errorCode?: string }).errorCode || ""),
        templateVersion: scheduleEmailTemplateVersion,
        gasVersion: body.version,
        httpStatus: response.status,
        scheduleIds,
        teacherId,
        htmlDigest,
      });
      return { sent: false, reason };
    }

    if (body.version && body.version !== expectedGasWebhookVersion) {
      const reason = `GAS webhook version mismatch (expected ${expectedGasWebhookVersion}, got ${body.version}).`;
      await logMailDebug({
        requestId,
        source: "next",
        provider: "gas",
        event: "next.gas_version_mismatch",
        to,
        subject,
        sent: false,
        reason,
        templateVersion: scheduleEmailTemplateVersion,
        gasVersion: body.version,
        httpStatus: response.status,
        scheduleIds,
        teacherId,
        htmlDigest,
      });
      return { sent: false, reason };
    }

    if (!body.echo) {
      const reason = "GAS response missing echo metadata. Please deploy the latest GAS webhook version.";
      await logMailDebug({
        requestId,
        source: "next",
        provider: "gas",
        event: "next.gas_echo_missing",
        to,
        subject,
        sent: false,
        reason,
        templateVersion: scheduleEmailTemplateVersion,
        gasVersion: body.version,
        httpStatus: response.status,
        scheduleIds,
        teacherId,
        htmlDigest,
      });
      return { sent: false, reason };
    }

    if (body.echo.templateVersion && body.echo.templateVersion !== scheduleEmailTemplateVersion) {
      const reason = `GAS templateVersion mismatch (expected ${scheduleEmailTemplateVersion}, got ${body.echo.templateVersion}).`;
      await logMailDebug({
        requestId,
        source: "next",
        provider: "gas",
        event: "next.gas_template_mismatch",
        to,
        subject,
        sent: false,
        reason,
        templateVersion: scheduleEmailTemplateVersion,
        gasVersion: body.version,
        httpStatus: response.status,
        scheduleIds,
        teacherId,
        htmlDigest,
      });
      return { sent: false, reason };
    }

    if (body.echo?.htmlDigest && body.echo.htmlDigest !== htmlDigest) {
      const reason = `GAS htmlDigest mismatch (requestId=${body.requestId || "n/a"}).`;
      await logMailDebug({
        requestId,
        source: "next",
        provider: "gas",
        event: "next.gas_digest_mismatch",
        to,
        subject,
        sent: false,
        reason,
        templateVersion: scheduleEmailTemplateVersion,
        gasVersion: body.version,
        httpStatus: response.status,
        scheduleIds,
        teacherId,
        htmlDigest,
      });
      return { sent: false, reason };
    }

    await logMailDebug({
      requestId,
      source: "next",
      provider: "gas",
      event: "next.gas_success",
      to,
      subject,
      sent: true,
      reason: "GAS accepted schedule email.",
      templateVersion: scheduleEmailTemplateVersion,
      gasVersion: body.version,
      httpStatus: response.status,
      scheduleIds,
      teacherId,
      htmlDigest,
    });
    return { sent: true, id: `gas:${body.requestId || "n/a"}` };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Cannot reach GAS mail webhook.";
    await logMailDebug({
      requestId,
      source: "next",
      provider: "gas",
      event: "next.gas_fetch_error",
      to,
      subject,
      sent: false,
      reason,
      templateVersion: scheduleEmailTemplateVersion,
      scheduleIds,
      teacherId,
    });
    return { sent: false, reason };
  }
}

async function sendViaResend({
  to,
  subject,
  html,
  from,
  requestId,
  scheduleIds,
  teacherId,
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  requestId: string;
  scheduleIds: string[];
  teacherId: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || !from) {
    await logMailDebug({
      requestId,
      source: "next",
      provider: "resend",
      event: "next.resend_config_missing",
      to,
      subject,
      sent: false,
      reason: "Missing RESEND_API_KEY or EMAIL_FROM.",
      scheduleIds,
      teacherId,
    });
    return { sent: false, reason: "Missing RESEND_API_KEY or EMAIL_FROM." };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as ResendResponse;
    if (!response.ok) {
      const reason = body.message || body.error || `Resend failed: ${response.status}`;
      await logMailDebug({
        requestId,
        source: "next",
        provider: "resend",
        event: "next.resend_response_failed",
        to,
        subject,
        sent: false,
        reason,
        httpStatus: response.status,
        scheduleIds,
        teacherId,
      });
      return { sent: false, reason };
    }

    await logMailDebug({
      requestId,
      source: "next",
      provider: "resend",
      event: "next.resend_success",
      to,
      subject,
      sent: true,
      reason: body.id || "Resend accepted schedule email.",
      httpStatus: response.status,
      scheduleIds,
      teacherId,
    });
    return { sent: true, id: body.id };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Cannot reach Resend.";
    await logMailDebug({
      requestId,
      source: "next",
      provider: "resend",
      event: "next.resend_fetch_error",
      to,
      subject,
      sent: false,
      reason,
      scheduleIds,
      teacherId,
    });
    return { sent: false, reason };
  }
}

function renderScheduleDigestEmail(input: ScheduleDigestInput) {
  const rows = [...input.rows].sort((a, b) => {
    const dateDiff = a.schedule.date.localeCompare(b.schedule.date);
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return `${a.slot?.start || ""}-${a.slot?.end || ""}`.localeCompare(`${b.slot?.start || ""}-${b.slot?.end || ""}`);
  });

  const weekText = buildWeekLabel(input.schedules);
  const confirmAllUrl = buildConfirmAllUrl(rows.map((row) => row.schedule));
  const appUrl = buildAppUrl();
  return `
    <!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light only">
        <style>
          :root { color-scheme: light only; }
          body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
          table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
          .desktop-schedule-table { display:table; }
          .desktop-email-actions { display:block; }
          .mobile-schedule-cards, .mobile-email-actions { display:none; max-height:0; overflow:hidden; mso-hide:all; }
          @media only screen and (max-width:600px) {
            .email-page { padding:10px !important; }
            .email-shell { padding:18px 14px !important; border-radius:12px !important; }
            .email-title { font-size:22px !important; }
            .desktop-schedule-table, .desktop-email-actions { display:none !important; max-height:0 !important; overflow:hidden !important; }
            .mobile-schedule-cards, .mobile-email-actions { display:block !important; max-height:none !important; overflow:visible !important; }
            .schedule-card { margin-bottom:14px !important; }
            .schedule-card-body { padding:16px 14px !important; }
            .email-button { display:block !important; box-sizing:border-box !important; width:100% !important; margin:0 0 10px !important; }
          }
        </style>
      </head>
      <body style="margin:0;padding:0;background:#f3f8fa;color:#16313a;font-family:Arial,sans-serif">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f3f8fa" style="width:100%;border-collapse:collapse;background:#f3f8fa">
          <tr>
            <td class="email-page" align="center" style="padding:24px 12px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:920px;border-collapse:separate;background:#ffffff;border:1px solid #d6e7eb;border-radius:16px">
                <tr>
                  <td class="email-shell" style="padding:28px 24px;color:#16313a">
                    <p style="margin:0 0 10px;font-size:12px;line-height:1.5;color:#147f99;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:.3px">HỆ THỐNG THÔNG BÁO LỊCH DẠY KỸ NĂNG SỐNG | HỌC VIỆN METTASOUL</p>
                    <h1 class="email-title" style="margin:0 0 18px;font-size:26px;line-height:1.25;color:#075f73;text-align:center;text-transform:uppercase">BẠN CÓ LỊCH DẠY MỚI</h1>
                    <p style="margin:0 0 10px;font-size:16px;line-height:1.55;color:#16313a">Chào <strong>${escapeHtml(input.teacher.name || "Thầy/Cô")}</strong>, giáo vụ vừa giao lịch dạy cho ${escapeHtml(weekText)}.</p>
                    <p style="margin:0 0 8px;font-size:14px;line-height:1.55;color:#526b77">Thầy/Cô có thể xác nhận ngay trên từng thẻ lịch, hoặc xác nhận toàn bộ ở cuối email.</p>
                    <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#526b77">Xem đầy đủ thông tin tại <a href="${appUrl}" style="color:#075f73;font-weight:700;text-decoration:underline">ứng dụng METTASOUL</a>.</p>

                    <!-- ${scheduleEmailTemplateVersion} -->
                    ${renderDesktopScheduleTable(rows)}
                    <div class="mobile-schedule-cards">
                      ${renderMobileScheduleCards(rows)}
                    </div>
                    <div class="desktop-email-actions" style="margin-top:22px;text-align:center">
                      <a href="${confirmAllUrl}" style="display:inline-block;margin:0 4px 8px;background:#08788e;color:#ffffff;text-decoration:none;border-radius:12px;padding:12px 18px;font-size:14px;font-weight:700;text-align:center">XÁC NHẬN TẤT CẢ</a>
                      <a href="${appUrl}" style="display:inline-block;margin:0 4px 8px;background:#e7f6fa;color:#075f73;text-decoration:none;border:1px solid #08788e;border-radius:12px;padding:12px 18px;font-size:14px;font-weight:700;text-align:center">TRUY CẬP APP</a>
                    </div>
                    <div class="mobile-email-actions" style="margin-top:22px">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse">
                        <tr>
                          <td align="center" bgcolor="#08788e" style="background:#08788e;border-radius:12px">
                            <a class="email-button" href="${confirmAllUrl}" style="display:block;padding:15px 18px;color:#ffffff;text-decoration:none;font-size:16px;line-height:1.3;font-weight:700;text-align:center;border-radius:12px">XÁC NHẬN TẤT CẢ</a>
                          </td>
                        </tr>
                      </table>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:10px;border-collapse:collapse">
                        <tr>
                          <td align="center" bgcolor="#e7f6fa" style="background:#e7f6fa;border:1px solid #08788e;border-radius:12px">
                            <a class="email-button" href="${appUrl}" style="display:block;padding:14px 18px;color:#075f73;text-decoration:none;font-size:15px;line-height:1.3;font-weight:700;text-align:center;border-radius:12px">TRUY CẬP ỨNG DỤNG</a>
                          </td>
                        </tr>
                      </table>
                    </div>
                    <p style="margin:16px 0 0;font-size:12px;line-height:1.55;color:#526b77;text-align:center">“Xác nhận tiết này” chỉ cập nhật lịch tương ứng. “Xác nhận tất cả” áp dụng cho toàn bộ lịch đang chờ xác nhận trong email này.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function renderDesktopScheduleTable(rows: ScheduleDigestRow[]) {
  return `
    <table class="desktop-schedule-table" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 20px;font-size:13px;border:2px solid #ff9500">
      <colgroup>
        <col style="width:15%">
        <col style="width:21%">
        <col style="width:20%">
        <col style="width:27%">
        <col style="width:17%">
      </colgroup>
      <thead>
        <tr>
          <th style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:center">NGÀY &amp; GIỜ</th>
          <th style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:center">TRƯỜNG / LỚP</th>
          <th style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:center">BÀI HỌC</th>
          <th style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:center">TIẾT DẠY</th>
          <th style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:center">XÁC NHẬN</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => {
          const slotTime = [row.slot?.start, row.slot?.end].filter(Boolean).join(" - ");
          return `
            <tr style="border-top:3px solid #ff9500">
              <td style="padding:10px;border:1px solid #ff9500;vertical-align:middle;text-align:center;line-height:1.5">${escapeHtml(formatDate(row.schedule.date))}<br><span style="color:#667985">${escapeHtml(slotTime || "Chưa cập nhật")}</span></td>
              <td style="padding:10px;border:1px solid #ff9500;vertical-align:middle;text-align:center;line-height:1.5"><strong>${escapeHtml(row.school?.name || "Chưa cập nhật")}</strong><br>${escapeHtml(formatParticipantClasses(row))}</td>
              <td style="padding:10px;border:1px solid #ff9500;vertical-align:middle;text-align:center">${escapeHtml(normalizeKnownLessonTitle(row.lesson?.title))}</td>
              <td style="padding:10px;border:1px solid #ff9500;vertical-align:middle;line-height:1.6">${renderScheduledPeriodTitles(row.lesson, row.schedule)}</td>
              <td style="padding:10px;border:1px solid #ff9500;vertical-align:middle;text-align:center"><a href="${buildConfirmUrl(row.schedule)}" style="display:inline-block;background:#08788e;color:#ffffff;text-decoration:none;border-radius:8px;padding:9px 10px;font-size:12px;font-weight:700">XÁC NHẬN TIẾT NÀY</a></td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderMobileScheduleCards(rows: ScheduleDigestRow[]) {
  return rows.map((row) => {
    const slotTime = [row.slot?.start, row.slot?.end].filter(Boolean).join(" - ");
    return `
      <table class="schedule-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;margin:0 0 16px;border-collapse:separate;background:#ffffff;border:1px solid #b9dce4;border-radius:14px;overflow:hidden">
        <tr>
          <td bgcolor="#e8f7fa" style="padding:13px 14px;background:#e8f7fa;border-bottom:1px solid #b9dce4;color:#075f73">
            <div style="font-size:17px;line-height:1.35;font-weight:700;word-break:normal;overflow-wrap:break-word">${escapeHtml(formatDate(row.schedule.date))}</div>
            <div style="margin-top:3px;font-size:14px;line-height:1.4;color:#385965;word-break:normal;overflow-wrap:break-word">${escapeHtml(slotTime || "Chưa cập nhật")}</div>
          </td>
        </tr>
        <tr>
          <td class="schedule-card-body" style="padding:18px 16px;color:#16313a">
            ${renderScheduleEmailField("Trường / Lớp", `<strong>${escapeHtml(row.school?.name || "Chưa cập nhật")}</strong><br>${escapeHtml(formatParticipantClasses(row))}`)}
            ${renderScheduleEmailField("Bài học", escapeHtml(normalizeKnownLessonTitle(row.lesson?.title)))}
            ${renderScheduleEmailField("Tiết dạy", renderScheduledPeriodTitles(row.lesson, row.schedule), true)}
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse">
              <tr>
                <td align="center" bgcolor="#08788e" style="background:#08788e;border-radius:10px">
                  <a class="email-button" href="${buildConfirmUrl(row.schedule)}" style="display:block;padding:13px 16px;color:#ffffff;text-decoration:none;font-size:15px;line-height:1.3;font-weight:700;text-align:center;border-radius:10px">XÁC NHẬN TIẾT NÀY</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  }).join("");
}

function renderScheduleEmailField(label: string, valueHtml: string, isLast = false) {
  return `
    <div style="${isLast ? "margin:0 0 16px" : "margin:0 0 14px;padding:0 0 14px;border-bottom:1px solid #e1edf0"};word-break:normal;overflow-wrap:break-word">
      <div style="margin:0 0 5px;font-size:11px;line-height:1.3;color:#5b7480;font-weight:700;text-transform:uppercase;letter-spacing:.4px">${escapeHtml(label)}</div>
      <div style="font-size:15px;line-height:1.55;color:#16313a">${valueHtml}</div>
    </div>
  `;
}

function formatParticipantClasses(row: ScheduleDigestRow) {
  const names = row.participantClassNames?.filter(Boolean) ?? [];
  if (names.length <= 1) {
    return names[0] || row.classRoom?.name || "Chưa cập nhật";
  }
  return names.join(", ");
}

function buildConfirmUrl(schedule: Schedule) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const token = createScheduleConfirmationToken(schedule.id, schedule.teacherId);
  const url = new URL(`/api/schedules/${schedule.id}/confirm`, baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

function buildAppUrl() {
  return new URL("/", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").toString();
}

function createEmailRequestId() {
  return `mail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildConfirmAllUrl(schedules: Schedule[]) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const teacherId = schedules[0]?.teacherId || "";
  const scheduleIds = schedules.map((schedule) => schedule.id);
  const token = createScheduleConfirmationBatchToken(scheduleIds, teacherId);
  const url = new URL("/api/schedules/confirm-all", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

function buildScheduleWeekSubject(schedules: Schedule[]) {
  return `LỊCH DẠY ${buildWeekLabel(schedules).toUpperCase()}`;
}

function buildWeekLabel(schedules: Schedule[]) {
  return formatAcademicWeekLabel(schedules.map((schedule) => schedule.date));
}

function normalizeKnownLessonTitle(value: string | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "Chưa cập nhật";
  }

  const comparable = normalizeComparableText(normalized);
  if (comparable.includes("thau cam") && comparable.includes("trac an")) {
    return "Thấu cảm và trắc ẩn";
  }

  return normalized;
}

function scheduledPeriods(schedule: Schedule) {
  const periods = String(schedule.lessonPeriods || "lesson1")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is "lesson1" | "lesson2" => value === "lesson1" || value === "lesson2");
  return periods.length > 0 ? Array.from(new Set(periods)) : ["lesson1"];
}

function renderScheduledPeriodTitles(lesson: ScheduleEmailLesson | undefined, schedule: Schedule) {
  return scheduledPeriods(schedule)
    .map((period) => {
      const number = period === "lesson1" ? "Tiết 1" : "Tiết 2";
      const title = period === "lesson1" ? lesson?.lesson1Title : lesson?.lesson2Title;
      return `<div style="margin:0 0 6px"><strong>${escapeHtml(number)}:</strong> ${escapeHtml(title?.trim() || lesson?.title?.trim() || "Chưa cập nhật")}</div>`;
    })
    .join("");
}

function normalizeComparableText(value: string) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function createSha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeEmailAddress(value: string | undefined) {
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function logMailDebug(row: {
  requestId: string;
  source: string;
  provider: string;
  event: string;
  to?: string;
  subject?: string;
  sent: boolean;
  reason?: string;
  errorCode?: string;
  templateVersion?: string;
  gasVersion?: string;
  httpStatus?: number;
  scheduleIds?: string[];
  teacherId?: string;
  htmlDigest?: string;
  inputHtmlDigest?: string;
  normalizedHtmlDigest?: string;
  htmlPreview?: string;
}) {
  try {
    await appendSheetRowWithHeaders("MailDebug", mailDebugHeaders, {
      id: `md-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      requestId: row.requestId,
      source: row.source,
      provider: row.provider,
      event: row.event,
      to: row.to || "",
      subject: row.subject || "",
      sent: row.sent,
      reason: row.reason || "",
      errorCode: row.errorCode || "",
      templateVersion: row.templateVersion || "",
      gasVersion: row.gasVersion || "",
      httpStatus: row.httpStatus || "",
      scheduleIds: (row.scheduleIds || []).join(","),
      teacherId: row.teacherId || "",
      htmlDigest: row.htmlDigest || "",
      inputHtmlDigest: row.inputHtmlDigest || "",
      normalizedHtmlDigest: row.normalizedHtmlDigest || "",
      htmlPreview: row.htmlPreview || "",
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[mail-debug-log-failed]", error);
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
