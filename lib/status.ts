import type { ScheduleStatus } from "@/lib/types";

export const statusLabels: Record<ScheduleStatus, string> = {
  draft: "Nhap",
  sent: "Cho xac nhan",
  confirmed: "Da nhan lich",
  lesson_plan_uploaded: "Da upload giao an",
  attended: "Da diem danh",
  cancelled: "Da huy",
  reassigned: "Da chuyen lich",
};

export const statusStyles: Record<ScheduleStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  sent: "bg-amber-50 text-amber-800 border-amber-200",
  confirmed: "bg-cyan-50 text-cyan-800 border-cyan-200",
  lesson_plan_uploaded: "bg-blue-50 text-blue-800 border-blue-200",
  attended: "bg-emerald-50 text-emerald-800 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-800 border-rose-200",
  reassigned: "bg-violet-50 text-violet-800 border-violet-200",
};
