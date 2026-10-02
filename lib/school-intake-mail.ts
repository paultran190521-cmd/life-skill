import nodemailer from "nodemailer";
import type { IntakeBatch, IntakeSettings } from "@/lib/school-intake-storage";

export type IntakeMailEvent = "submitted" | "returned" | "approved";

const senderAddress = "lifeskill@mettasoul.vn";
const sheetUrl = "https://docs.google.com/spreadsheets/d/1UPtukz6CQoQbe9Tq1s8Zwwfj1AL01XEwa7STeZ7dedg/edit#gid=0";

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function intakeMailRecipient(event: IntakeMailEvent, settings: IntakeSettings) {
  return event === "submitted" ? settings.reviewer : event === "returned" ? settings.submitter : settings.director;
}

export function canSendIntakeMail(event: IntakeMailEvent, batch: IntakeBatch, settings: IntakeSettings, actorEmail: string) {
  return event === "submitted"
    ? batch.status === "WAITING_REVIEW" && actorEmail === settings.submitter && batch.submittedBy === actorEmail
    : event === "returned"
      ? batch.status === "RETURNED" && actorEmail === settings.reviewer && batch.approvedBy === actorEmail
      : batch.status === "SYNCED" && actorEmail === settings.reviewer && batch.approvedBy === actorEmail;
}

export function buildIntakeMail(event: IntakeMailEvent, batch: IntakeBatch, settings: IntakeSettings) {
  const to = intakeMailRecipient(event, settings);
  const title = event === "submitted" ? "Lịch trường chờ duyệt vòng 2" : event === "returned" ? "Lịch trường cần chỉnh sửa" : "Lịch trường đã chuyển vào METTASOUL";
  const badge = event === "submitted" ? "CẦN KIỂM TRA" : event === "returned" ? "ĐƯỢC TRẢ LẠI" : "ĐÃ ĐỒNG BỘ";
  const actor = event === "submitted" ? batch.submittedBy : batch.approvedBy;
  const intro = event === "submitted" ? `${actor} đã gửi lịch để bạn kiểm tra và xác nhận.` : event === "returned" ? `${actor} đã trả lại đợt lịch để bạn cập nhật.` : `${actor} đã xác nhận lịch vòng 2. Đây là email thông tin; bạn không cần duyệt thêm.`;
  const instruction = event === "submitted" ? "Chọn đúng tuần trên tab Nhập lịch, kiểm tra các dòng và bấm duyệt vòng 2." : event === "returned" ? "Sửa các dòng cần thiết trên tab Nhập lịch, sau đó gửi lại vòng 1." : "Lịch đã vào app. Giáo vụ tiếp tục chọn giáo viên và gửi lịch từ METTASOUL.";
  const action = event === "submitted" ? "Mở bảng lịch để duyệt" : event === "returned" ? "Mở bảng lịch để sửa" : "Xem lịch đã duyệt";
  const summary = [
    ["Trường", batch.school], ["Tiết", batch.count], ["Mới", batch.raw[6] || 0],
    ["Sửa", batch.raw[7] || 0], ["Trùng", batch.raw[8] || 0], ["Hủy", batch.raw[9] || 0],
  ];
  const note = event === "returned" ? batch.note : "";
  const subject = `METTASOUL · ${title}`;
  const body = [
    `METTASOUL | ${title}`, "", intro, "",
    `MỞ BẰNG TÀI KHOẢN GOOGLE: ${to}`,
    "Đây là email được cấp quyền truy cập. Nếu đăng nhập nhiều tài khoản, hãy chuyển sang email này trước khi mở liên kết.", "",
    `Tuần bắt đầu: ${batch.weekStart}`, `Mã đợt: ${batch.id}`,
    summary.map(([label, value]) => `${label}: ${value}`).join(" · "),
    ...(note ? [`Ghi chú: ${note}`] : []), instruction, `${action}: ${sheetUrl}`,
  ].join("\n");
  const cards = summary.map(([label, value], index) => `${index === 3 ? "</tr><tr>" : ""}<td style="width:33%;padding:10px;border:1px solid #dbe7ed;border-radius:10px;text-align:center;background:#f5fafb"><strong style="display:block;font-size:18px;color:#0c5269">${escapeHtml(value)}</strong><span style="font-size:12px;color:#526672">${escapeHtml(label)}</span></td>`).join("");
  const html = `<div style="padding:24px 12px;background:#edf5f7;font-family:Arial,sans-serif;color:#17394a"><div style="max-width:640px;margin:auto;background:#fff;border:1px solid #d7e9ed;border-radius:18px;overflow:hidden"><div style="background:#0b7287;padding:22px 28px;color:#fff"><strong style="letter-spacing:2px">METTASOUL</strong><div style="margin-top:5px">LỊCH DẠY HẰNG TUẦN</div></div><div style="padding:28px"><span style="padding:6px 11px;border-radius:99px;background:#e7f6ef;color:#176b4b;font-size:11px;font-weight:bold">${escapeHtml(badge)}</span><h1 style="font-size:23px;line-height:1.3;color:#123e50">${escapeHtml(title)}</h1><p style="line-height:1.7;color:#465e6c">${escapeHtml(intro)}</p><div style="padding:16px;border-radius:12px;background:#fff4d8;border:1px solid #f0d18b"><div style="font-size:11px;font-weight:bold;color:#8a5c12">TÀI KHOẢN ĐƯỢC CẤP QUYỀN</div><div style="font-size:17px;font-weight:bold;margin:6px 0">${escapeHtml(to)}</div><div style="font-size:12px">Nếu đăng nhập nhiều tài khoản Google, hãy chuyển sang email này trước khi mở bảng lịch.</div></div><p><strong>Tuần bắt đầu:</strong> ${escapeHtml(batch.weekStart)}<br><strong>Mã đợt:</strong> ${escapeHtml(batch.id)}</p><table role="presentation" style="width:100%;border-spacing:5px"><tr>${cards}</tr></table>${note ? `<p style="padding:12px;background:#fff4f0;border-left:3px solid #d9764e"><strong>Ghi chú:</strong> ${escapeHtml(note)}</p>` : ""}<p style="line-height:1.6">${escapeHtml(instruction)}</p><a href="${sheetUrl}" style="display:inline-block;background:#0b7287;color:#fff;text-decoration:none;border-radius:10px;padding:12px 20px;font-weight:bold">${escapeHtml(action)}</a><p style="font-size:11px;color:#718896;margin-top:24px">Email tự động từ quy trình nhập và duyệt lịch METTASOUL.</p></div></div></div>`;
  return { to, subject, body, html };
}

export function intakeSmtpConfigured() {
  return Boolean(String(process.env.SCHOOL_INTAKE_SMTP_PASS || "").trim());
}

export async function sendIntakeMail(event: IntakeMailEvent, batch: IntakeBatch, settings: IntakeSettings) {
  const password = String(process.env.SCHOOL_INTAKE_SMTP_PASS || "").replace(/\s/g, "");
  if (!password) throw new Error("Chưa cấu hình mật khẩu ứng dụng SMTP cho email duyệt lịch.");
  const host = String(process.env.SCHOOL_INTAKE_SMTP_HOST || "smtp.gmail.com").trim();
  const port = Number(process.env.SCHOOL_INTAKE_SMTP_PORT || 465);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Cấu hình SMTP duyệt lịch không hợp lệ.");
  const message = buildIntakeMail(event, batch, settings);
  const transport = nodemailer.createTransport({
    host, port, secure: port === 465, auth: { user: senderAddress, pass: password },
    connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000,
  });
  const result = await transport.sendMail({
    from: `"METTASOUL Giáo vụ" <${senderAddress}>`,
    to: message.to, subject: message.subject, text: message.body, html: message.html,
    messageId: `<school-intake-${event}-${batch.id}@mettasoul.vn>`,
  });
  return { to: message.to, messageId: result.messageId };
}
