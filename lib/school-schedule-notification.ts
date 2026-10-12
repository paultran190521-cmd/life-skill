import { sendOperationalEmail } from "@/lib/email";

type SchoolScheduleChange = {
  action: "IMPORT" | "EDIT" | "MATERIALIZE";
  actorName: string;
  schoolName: string;
  weekStart?: string;
  newCount: number;
  changedCount: number;
  reviewCount?: number;
  fileName?: string;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Nguyen Phuong's address is deployment-owned: never hard-code a personal address in source. */
export async function notifySchoolScheduleChange(input: SchoolScheduleChange) {
  const recipient = String(process.env.SCHOOL_SCHEDULE_CHANGE_NOTIFY_EMAIL || "").trim();
  const label = input.action === "EDIT" ? "đã sửa lịch" : input.action === "MATERIALIZE" ? "đã tạo lịch tuần từ lịch học kỳ" : "đã nhập bản cập nhật lịch";
  const scope = input.weekStart ? `Tuần bắt đầu: ${input.weekStart}` : "Lịch nền học kỳ";
  const subject = `METTASOUL | ${input.schoolName} ${label}`;
  const html = `<!doctype html><html lang="vi"><body style="font-family:Arial,sans-serif;color:#16313a;padding:24px"><h2 style="color:#075f73">${escapeHtml(subject)}</h2><p><strong>${escapeHtml(input.actorName)}</strong> ${escapeHtml(label)}.</p><p><strong>Trường:</strong> ${escapeHtml(input.schoolName)}<br><strong>Phạm vi:</strong> ${escapeHtml(scope)}<br><strong>Mới:</strong> ${input.newCount} · <strong>Sửa:</strong> ${input.changedCount}${typeof input.reviewCount === "number" ? ` · <strong>Cần đối chiếu lịch đã giao:</strong> ${input.reviewCount}` : ""}${input.fileName ? `<br><strong>File:</strong> ${escapeHtml(input.fileName)}` : ""}</p><p>Mở CRM/METTASOUL để xem lịch sử thay đổi và xử lý các lịch đã giao nếu có.</p></body></html>`;
  return sendOperationalEmail({ to: recipient, subject, html, event: "school_schedule_change" });
}
