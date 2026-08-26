import { createScheduleConfirmationBatchToken, createScheduleConfirmationToken } from "@/lib/schedule-confirmation";
import { appendSheetRowWithHeaders } from "@/lib/google-sheets";
import { formatAcademicWeekLabel } from "@/lib/academic-week";
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

  return sendViaResend({ to, subject, html, from, requestId, scheduleIds, teacherId });
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
  return `
    <div style="font-family:Arial,sans-serif;background:#f6fafb;padding:24px;color:#16313a">
      <div style="max-width:920px;margin:0 auto;background:#ffffff;border:1px solid #dce8eb;border-radius:16px;padding:24px">
        <p style="margin:0 0 12px;font-size:14px;color:#1992b0;font-weight:700;text-align:center;text-transform:uppercase">HỆ THỐNG THÔNG BÁO LỊCH DẠY KỸ NĂNG SỐNG | HỌC VIỆN METTASOUL</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0b6f89;text-align:center;text-transform:uppercase">BẠN CÓ LỊCH DẠY MỚI</h1>
        <p style="margin:0 0 8px;font-size:15px">Chào ${escapeHtml(input.teacher.name || "Thầy/Cô")}, giáo vụ vừa giao lịch dạy cho ${escapeHtml(weekText)}.</p>
        <p style="margin:0 0 20px;font-size:13px;color:#667985">Kiểm tra lịch bên dưới, sau đó dùng nút xác nhận tất cả ở cuối email.</p>

        <!-- ${scheduleEmailTemplateVersion} -->
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 20px;font-size:13px;border:2px solid #ff9500">
          <colgroup>
            <col style="width:8%">
            <col style="width:9%">
            <col style="width:13%">
            <col style="width:13%">
            <col style="width:12%">
            <col style="width:17%">
            <col style="width:18%">
            <col style="width:10%">
          </colgroup>
          <thead>
            <tr>
              <th style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:center">NGÀY</th>
              <th style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:center">KHUNG GIỜ</th>
              <th style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:center">TRƯỜNG</th>
              <th style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:center">LỚP/PHẠM VI</th>
              <th style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:center">TÊN BÀI</th>
              <th colspan="2" style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:center">TÊN TIẾT VÀ MỤC TIÊU</th>
              <th style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:left">THÔNG TIN BUỔI DẠY</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => {
                const slotTime = [row.slot?.start, row.slot?.end].filter(Boolean).join(" - ");
                return `
                  <tr style="border-top:3px solid #ff9500">
                    <td style="padding:10px;border:1px solid #ff9500;vertical-align:middle;text-align:center;word-break:break-word;overflow-wrap:anywhere">${escapeHtml(formatDate(row.schedule.date))}</td>
                    <td style="padding:10px;border:1px solid #ff9500;vertical-align:middle;text-align:center;white-space:normal;word-break:break-word;overflow-wrap:anywhere">${escapeHtml(slotTime || "Chưa cập nhật")}</td>
                    <td style="padding:10px;border:1px solid #ff9500;vertical-align:middle;text-align:center">${escapeHtml(row.school?.name || "Chưa cập nhật")}</td>
                    <td style="padding:10px;border:1px solid #ff9500;vertical-align:middle;text-align:center">${escapeHtml(formatParticipantClasses(row))}</td>
                    <td style="padding:10px;border:1px solid #ff9500;vertical-align:middle;text-align:center">${escapeHtml(normalizeKnownLessonTitle(row.lesson?.title))}</td>
                    <td colspan="2" style="padding:0;border:1px solid #ff9500;vertical-align:top">${renderScheduledPeriodMatrix(row.lesson, row.schedule)}</td>
                    <td style="padding:10px;border:1px solid #ff9500;vertical-align:middle;line-height:1.55">${renderScheduleLogistics(row)}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>

        <div style="text-align:center">
          <a href="${confirmAllUrl}" style="display:inline-block;background:#0b6f89;color:#ffffff;text-decoration:none;border-radius:12px;padding:12px 18px;font-weight:700;text-align:center">XÁC NHẬN TẤT CẢ LỊCH CỦA TÔI</a>
        </div>
        <p style="margin:20px 0 0;font-size:12px;color:#667985">Nút này sẽ xác nhận tất cả lịch đang chờ xác nhận của bạn, ghi nhận vào hệ thống và mở ứng dụng web ngay sau khi hoàn tất.</p>
      </div>
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

function renderScheduleLogistics(row: ScheduleDigestRow) {
  const assistants = row.assistantNames?.filter(Boolean) ?? [];
  const coTeachers = row.coTeacherNames?.filter(Boolean) ?? [];
  const assistantText = assistants.length > 0 ? `Có - ${assistants.join(", ")}` : "Không có";
  const coTeacherLine = coTeachers.length > 0
    ? `<div><strong>Thầy/Cô sẽ dạy cùng:</strong> ${escapeHtml(coTeachers.join(", "))}</div>`
    : "";
  return `${coTeacherLine}<div style="margin-top:${coTeacherLine ? "8px" : "0"}"><strong>Trợ giảng:</strong> ${escapeHtml(assistantText)}</div>`;
}

function buildConfirmUrl(schedule: Schedule) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const token = createScheduleConfirmationToken(schedule.id, schedule.teacherId);
  const url = new URL(`/api/schedules/${schedule.id}/confirm`, baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
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

function formatObjectives(rawObjective: string) {
  const normalized = String(rawObjective || "").trim();
  if (!normalized) {
    return "<div>- Mục tiêu 1: Chưa cập nhật.</div>";
  }

  const matches = [...normalized.matchAll(/mục tiêu\s*(\d+)\s*:/gi)];
  if (matches.length === 0) {
    return `<div>- Mục tiêu 1: ${escapeHtml(normalized)}</div>`;
  }

  const lines: string[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const start = current.index ?? 0;
    const end = next?.index ?? normalized.length;
    const block = normalized.slice(start, end).trim();
    const label = `Mục tiêu ${current[1]}:`;
    const content = block.replace(/mục tiêu\s*\d+\s*:/i, "").trim();
    lines.push(`<div>- ${escapeHtml(label)} ${escapeHtml(content)}</div>`);
  }

  return lines.join("");
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

function formatScheduledLessonTitle(lesson: ScheduleEmailLesson | undefined, schedule: Schedule) {
  const titles = scheduledPeriods(schedule).map((period) => {
    const number = period === "lesson1" ? "Tiết 1" : "Tiết 2";
    const title = period === "lesson1" ? lesson?.lesson1Title : lesson?.lesson2Title;
    return `${number}: ${title?.trim() || lesson?.title?.trim() || "Chưa cập nhật"}`;
  });
  return titles.join(" · ");
}

function formatScheduledLessonObjectives(lesson: ScheduleEmailLesson | undefined, schedule: Schedule) {
  const objectives = scheduledPeriods(schedule)
    .map((period) => (period === "lesson1" ? lesson?.lesson1Objective : lesson?.lesson2Objective)?.trim())
    .filter(Boolean);
  return objectives.join("\n") || lesson?.objective || "";
}

function renderScheduledPeriodMatrix(lesson: ScheduleEmailLesson | undefined, schedule: Schedule) {
  return scheduledPeriods(schedule)
    .map((period, index) => {
      const number = period === "lesson1" ? "Tiết 1" : "Tiết 2";
      const title = period === "lesson1" ? lesson?.lesson1Title : lesson?.lesson2Title;
      const objective = period === "lesson1" ? lesson?.lesson1Objective : lesson?.lesson2Objective;
      const divider = index > 0 ? "border-top:2px solid #149ac2;" : "";
      return `<tr>
        <td style="width:46%;padding:12px 10px;${divider}font-weight:800;color:#e67e00;text-align:center;vertical-align:middle">${escapeHtml(`${number}: ${title?.trim() || lesson?.title?.trim() || "Chưa cập nhật"}`)}</td>
        <td style="padding:12px 10px;${divider}border-left:1px solid #149ac2;vertical-align:top">${formatObjectives(objective?.trim() || lesson?.objective || "")}</td>
      </tr>`;
    })
    .join("")
    .replace(/^/, '<table role="presentation" style="width:100%;border-collapse:collapse;table-layout:fixed">')
    .concat("</table>");
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
