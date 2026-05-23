import { createScheduleConfirmationToken } from "@/lib/schedule-confirmation";
import type { Schedule } from "@/lib/types";

type ScheduleEmailInput = {
  schedule: Schedule;
  teacher: { name?: string; email?: string };
  school?: { name?: string };
  classRoom?: { name?: string };
  lesson?: { title?: string; objective?: string };
  slot?: { label?: string; start?: string; end?: string };
};

type ResendResponse = {
  id?: string;
  message?: string;
  error?: string;
};

export async function sendScheduleEmail(input: ScheduleEmailInput) {
  const from = process.env.EMAIL_FROM;
  const to = input.teacher.email;

  if (!to) {
    return { sent: false, reason: "Teacher email is missing." };
  }

  const confirmUrl = buildConfirmUrl(input.schedule);
  const subject = `Lịch dạy ${formatDate(input.schedule.date)} - ${input.classRoom?.name || "Life Skill"}`;
  const html = renderScheduleEmail(input, confirmUrl);

  if (process.env.EMAIL_PROVIDER === "gas") {
    return sendViaGas({ to, subject, html, from });
  }

  return sendViaResend({ to, subject, html, from });
}

async function sendViaGas({
  to,
  subject,
  html,
  from,
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}) {
  const webhookUrl = process.env.GAS_MAIL_WEBHOOK_URL;
  const secret = process.env.GAS_MAIL_WEBHOOK_SECRET;

  if (!webhookUrl || !secret) {
    return { sent: false, reason: "Missing GAS_MAIL_WEBHOOK_URL or GAS_MAIL_WEBHOOK_SECRET." };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        secret,
        to,
        subject,
        html,
        from,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!response.ok || !body.ok) {
      return { sent: false, reason: body.error || `GAS mail webhook failed: ${response.status}` };
    }

    return { sent: true, id: "gas" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Cannot reach GAS mail webhook.";
    return { sent: false, reason };
  }
}

async function sendViaResend({
  to,
  subject,
  html,
  from,
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || !from) {
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
      return { sent: false, reason: body.message || body.error || `Resend failed: ${response.status}` };
    }

    return { sent: true, id: body.id };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Cannot reach Resend.";
    return { sent: false, reason };
  }
}

function buildConfirmUrl(schedule: Schedule) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const token = createScheduleConfirmationToken(schedule.id, schedule.teacherId);
  const url = new URL(`/api/schedules/${schedule.id}/confirm`, baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

function renderScheduleEmail(input: ScheduleEmailInput, confirmUrl: string) {
  const schedule = input.schedule;
  const slotTime = [input.slot?.start, input.slot?.end].filter(Boolean).join(" - ");
  const lessonTitle = input.lesson?.title || "Bài học Life Skill";
  const objective = input.lesson?.objective || "Vui lòng xem chi tiết trên hệ thống.";
  const objectivesHtml = formatObjectives(objective);

  return `
    <div style="font-family:Arial,sans-serif;background:#f6fafb;padding:24px;color:#16313a">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dce8eb;border-radius:16px;padding:24px">
        <p style="margin:0 0 12px;font-size:14px;color:#1992b0;font-weight:700;text-align:center">HỆ THỐNG THÔNG BÁO LỊCH DẠY KỸ NĂNG SỐNG METTASOUL</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0b6f89;text-align:center">Bạn có lịch dạy mới</h1>
        <p style="margin:0 0 20px;font-size:15px">Chào ${escapeHtml(input.teacher.name || "Thầy/Cô")}, giáo vụ vừa giao một tiết dạy mới cho bạn.</p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:14px">
          ${row("Ngày", formatDate(schedule.date))}
          ${row("Khung giờ", `${input.slot?.label || ""}${slotTime ? ` (${slotTime})` : ""}`)}
          ${row("Trường", input.school?.name || "")}
          ${row("Lớp", input.classRoom?.name || "")}
          ${row("Bài học", lessonTitle)}
          ${row("Mục tiêu", objectivesHtml, true)}
        </table>
        <div style="text-align:center">
          <a href="${confirmUrl}" style="display:inline-block;background:#ff9500;color:#ffffff;text-decoration:none;border-radius:12px;padding:12px 18px;font-weight:700;text-align:center">Xác nhận lịch dạy</a>
        </div>
        <p style="margin:20px 0 0;font-size:12px;color:#667985">Nếu nút không mở được, hãy đăng nhập hệ thống và xác nhận trong mục Lịch của tôi.</p>
      </div>
    </div>
  `;
}

function row(label: string, value: string, allowHtml = false) {
  const renderedValue = allowHtml ? value : escapeHtml(value || "Chưa cập nhật");
  return `
    <tr>
      <td style="width:120px;padding:10px;border-top:1px solid #edf3f5;color:#667985;font-weight:700">${label}</td>
      <td style="padding:10px;border-top:1px solid #edf3f5;color:#16313a">${renderedValue}</td>
    </tr>
  `;
}

function formatObjectives(rawObjective: string) {
  const normalized = String(rawObjective || "").trim();
  if (!normalized) {
    return "- Mục tiêu 1: Chưa cập nhật.";
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
