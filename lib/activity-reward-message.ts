type ActivityRewardMessage = {
  teacherName?: string;
  activityTitle: string;
  activityDate: string;
  roleLabel: string;
  money: number;
  mcpPoints: number;
};

function escape(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

export function renderActivityRewardMessage(input: ActivityRewardMessage) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.activityDate)
    ? input.activityDate.split("-").reverse().join("/")
    : input.activityDate;
  const benefits = [
    input.money > 0 ? `<p><strong>Thù lao được HRM ghi nhận:</strong> ${new Intl.NumberFormat("vi-VN").format(input.money)} ₫</p>` : "",
    input.mcpPoints > 0 ? `<p><strong>MCP được HRM ghi nhận:</strong> ${new Intl.NumberFormat("vi-VN").format(input.mcpPoints)} MCP</p>` : "",
  ].filter(Boolean).join("");
  return {
    subject: `METTASOUL | Đã ghi nhận hoạt động ${input.activityTitle}`,
    html: `<!doctype html><html lang="vi"><body style="font-family:Arial,sans-serif;color:#16313a;padding:24px"><h1 style="color:#075f73">Hoạt động đã được ghi nhận</h1><p>Chào ${escape(input.teacherName || "Thầy/Cô")}, quản trị viên đã ghi nhận hoạt động của thầy/cô và HRM đã xác nhận kết quả.</p><p><strong>Hoạt động:</strong> ${escape(input.activityTitle)}<br><strong>Ngày:</strong> ${escape(date)}<br><strong>Vai trò:</strong> ${escape(input.roleLabel)}</p>${benefits}<p>Thầy/cô có thể xem lại tại mục Công việc & MCP trong ứng dụng.</p></body></html>`,
  };
}
