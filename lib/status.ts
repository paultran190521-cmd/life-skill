import type { ScheduleStatus } from "@/lib/types";

export const statusLabels: Record<ScheduleStatus, string> = {
  draft: "Nháp",
  sent: "Chờ xác nhận",
  confirmed: "Đã nhận lịch",
  lesson_plan_uploaded: "Đã upload giáo án",
  attended: "Đã điểm danh",
  cancelled: "Đã hủy",
  reassigned: "Đã chuyển lịch",
};

export const statusStyles: Record<ScheduleStatus, string> = {
  draft: "bg-slate-100/90 text-slate-700 border-slate-200 shadow-sm",
  sent: "bg-amber-50/95 text-amber-900 border-amber-200 shadow-sm shadow-amber-900/5",
  confirmed: "bg-sky-50/95 text-sky-800 border-sky-200 shadow-sm shadow-sky-900/5",
  lesson_plan_uploaded: "bg-indigo-50/95 text-indigo-800 border-indigo-200 shadow-sm shadow-indigo-900/5",
  attended: "bg-emerald-50/95 text-emerald-800 border-emerald-200 shadow-sm shadow-emerald-900/5",
  cancelled: "bg-rose-50/95 text-rose-800 border-rose-200 shadow-sm shadow-rose-900/5",
  reassigned: "bg-violet-50/95 text-violet-800 border-violet-200 shadow-sm shadow-violet-900/5",
};
