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
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = input.teacher.email;

  if (!apiKey || !from) {
    return { sent: false, reason: "Missing RESEND_API_KEY or EMAIL_FROM." };
  }
  if (!to) {
    return { sent: false, reason: "Teacher email is missing." };
  }

  const confirmUrl = buildConfirmUrl(input.schedule);
  const subject = `Lich day ${formatDate(input.schedule.date)} - ${input.classRoom?.name || "Life Skill"}`;
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
        html: renderScheduleEmail(input, confirmUrl),
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
  const lessonTitle = input.lesson?.title || "Bai hoc Life Skill";
  const objective = input.lesson?.objective || "Vui long xem chi tiet tren he thong.";

  return `
    <div style="font-family:Arial,sans-serif;background:#f6fafb;padding:24px;color:#16313a">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dce8eb;border-radius:16px;padding:24px">
        <p style="margin:0 0 12px;font-size:14px;color:#1992b0;font-weight:700">Life Skill Scheduler</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0b6f89">Ban co lich day moi</h1>
        <p style="margin:0 0 20px;font-size:15px">Chao ${escapeHtml(input.teacher.name || "thay/co")}, giao vu vua giao mot tiet day moi cho ban.</p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:14px">
          ${row("Ngay", formatDate(schedule.date))}
          ${row("Khung gio", `${input.slot?.label || ""}${slotTime ? ` (${slotTime})` : ""}`)}
          ${row("Truong", input.school?.name || "")}
          ${row("Lop", input.classRoom?.name || "")}
          ${row("Bai hoc", lessonTitle)}
          ${row("Muc tieu", objective)}
        </table>
        <a href="${confirmUrl}" style="display:inline-block;background:#ff9500;color:#ffffff;text-decoration:none;border-radius:12px;padding:12px 18px;font-weight:700">Xac nhan lich day</a>
        <p style="margin:20px 0 0;font-size:12px;color:#667985">Neu nut khong mo duoc, hay dang nhap he thong va xac nhan trong muc Lich cua toi.</p>
      </div>
    </div>
  `;
}

function row(label: string, value: string) {
  return `
    <tr>
      <td style="width:120px;padding:10px;border-top:1px solid #edf3f5;color:#667985;font-weight:700">${label}</td>
      <td style="padding:10px;border-top:1px solid #edf3f5;color:#16313a">${escapeHtml(value || "Chua cap nhat")}</td>
    </tr>
  `;
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
