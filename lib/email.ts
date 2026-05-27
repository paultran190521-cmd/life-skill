import { createScheduleConfirmationBatchToken, createScheduleConfirmationToken } from "@/lib/schedule-confirmation";
import type { Schedule } from "@/lib/types";

type ScheduleEmailInput = {
  schedule: Schedule;
  teacher: { name?: string; email?: string };
  school?: { name?: string };
  classRoom?: { name?: string };
  lesson?: { title?: string; objective?: string };
  slot?: { label?: string; start?: string; end?: string };
};

type ScheduleDigestRow = {
  schedule: Schedule;
  school?: { name?: string };
  classRoom?: { name?: string };
  lesson?: { title?: string; objective?: string };
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
  const from = process.env.EMAIL_FROM;
  const to = input.teacher.email;

  if (!to) {
    return { sent: false, reason: "Teacher email is missing." };
  }

  const subject = buildScheduleWeekSubject(input.schedules);
  const html = renderScheduleDigestEmail(input);

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
        <p style="margin:0 0 20px;font-size:13px;color:#667985">Mỗi dòng bên dưới là một tiết dạy cần xác nhận.</p>

        <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:13px;border:2px solid #ff9500">
          <thead>
            <tr>
              <th style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:center">NGÀY</th>
              <th style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:center">KHUNG GIỜ</th>
              <th style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:center">TRƯỜNG</th>
              <th style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:center">LỚP</th>
              <th style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:center">BÀI HỌC</th>
              <th style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:left">MỤC TIÊU</th>
              <th style="padding:10px;border:1px solid #ff9500;background:#fff3df;text-align:center">XÁC NHẬN</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => {
                const slotTime = [row.slot?.start, row.slot?.end].filter(Boolean).join(" - ");
                const confirmUrl = buildConfirmUrl(row.schedule);
                return `
                  <tr>
                    <td style="padding:10px;border:1px solid #ff9500;vertical-align:middle;text-align:center">${escapeHtml(formatDate(row.schedule.date))}</td>
                    <td style="padding:10px;border:1px solid #ff9500;vertical-align:middle;text-align:center">${escapeHtml(slotTime || "Chưa cập nhật")}</td>
                    <td style="padding:10px;border:1px solid #ff9500;vertical-align:middle;text-align:center">${escapeHtml(row.school?.name || "Chưa cập nhật")}</td>
                    <td style="padding:10px;border:1px solid #ff9500;vertical-align:middle;text-align:center">${escapeHtml(row.classRoom?.name || "Chưa cập nhật")}</td>
                    <td style="padding:10px;border:1px solid #ff9500;vertical-align:middle;text-align:center">${escapeHtml(row.lesson?.title || "Chưa cập nhật")}</td>
                    <td style="padding:10px;border:1px solid #ff9500;vertical-align:top">${formatObjectives(row.lesson?.objective || "")}</td>
                    <td style="padding:10px;border:1px solid #ff9500;vertical-align:middle;text-align:center">
                      <a href="${confirmUrl}" style="display:inline-block;background:#ff9500;color:#ffffff;text-decoration:none;border-radius:10px;padding:8px 12px;font-weight:700">XÁC NHẬN</a>
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>

        <div style="text-align:center">
          <a href="${confirmAllUrl}" style="display:inline-block;background:#0b6f89;color:#ffffff;text-decoration:none;border-radius:12px;padding:12px 18px;font-weight:700;text-align:center">XÁC NHẬN TẤT CẢ (TẤT CẢ LỊCH ĐƯỢC XÁC NHẬN)</a>
        </div>
        <p style="margin:20px 0 0;font-size:12px;color:#667985">Nút này sẽ xác nhận toàn bộ lịch trong email và mở ứng dụng web ngay sau khi hoàn tất.</p>
      </div>
    </div>
  `;
}

function buildConfirmUrl(schedule: Schedule) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const token = createScheduleConfirmationToken(schedule.id, schedule.teacherId);
  const url = new URL(`/api/schedules/${schedule.id}/confirm`, baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
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
  const { weekRangeText, yearText } = computeWeekRange(schedules.map((schedule) => schedule.date));
  return `LỊCH DẠY TUẦN ${weekRangeText} NĂM ${yearText}`;
}

function buildWeekLabel(schedules: Schedule[]) {
  const { weekRangeText, yearText } = computeWeekRange(schedules.map((schedule) => schedule.date));
  return `tuần ${weekRangeText} năm ${yearText}`;
}

function computeWeekRange(dates: string[]) {
  const weekYears = dates
    .map((date) => getIsoWeekYear(new Date(`${date}T00:00:00`)))
    .filter((item) => Number.isFinite(item.week));

  if (weekYears.length === 0) {
    const fallbackYear = new Date().getFullYear();
    return { weekRangeText: "?", yearText: String(fallbackYear) };
  }

  const weeks = weekYears.map((item) => item.week);
  const years = Array.from(new Set(weekYears.map((item) => item.year))).sort((a, b) => a - b);
  const minWeek = Math.min(...weeks);
  const maxWeek = Math.max(...weeks);
  const weekRangeText = minWeek === maxWeek ? String(minWeek) : `${minWeek}-${maxWeek}`;
  const yearText = years.length === 1 ? String(years[0]) : `${years[0]}-${years[years.length - 1]}`;
  return { weekRangeText, yearText };
}

function getIsoWeekYear(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week, year: target.getUTCFullYear() };
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

