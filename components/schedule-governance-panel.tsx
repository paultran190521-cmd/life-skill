"use client";
import { useEffect, useState } from "react";
import type { ClassRoom, School, Schedule, Teacher, TeachingWorkLog, TimeSlot } from "@/lib/types";
import type { CancellationReport } from "@/lib/schedule-cancellation-reports";
import { topicReportActivity } from "@/lib/topic-report-policy";

async function request<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(url, body ? { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error((typeof data.error === "string" ? data.error : data.error?.message) || data.message || "Không thể xử lý yêu cầu.");
  return data;
}

export function ScheduleGovernancePanel({ schedules, teachers, schools, classes, timeSlots }: { schedules: Schedule[]; teachers: Teacher[]; schools: School[]; classes: ClassRoom[]; timeSlots: TimeSlot[] }) {
  const [reports, setReports] = useState<CancellationReport[]>([]);
  const [logs, setLogs] = useState<TeachingWorkLog[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let disposed = false;
    let running = false;
    const refresh = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        const [cancellations, payroll] = await Promise.all([request<{ reports: CancellationReport[] }>("/api/schedule-cancellations"), request<{ workLogs: TeachingWorkLog[] }>("/api/teaching-work-logs")]);
        if (!disposed) { setReports(cancellations.reports); setLogs(payroll.workLogs); }
        // Retry approvals whose HRM result is uncertain without another admin click.
        for (const log of payroll.workLogs.filter((row) => row.activityTypeCode && row.approvedBy && row.status === "PENDING")) {
          const result = await request<{ workLog: TeachingWorkLog }>("/api/teaching-work-logs", { scheduleId: log.scheduleId, teacherId: log.teacherId, intent: "approve" });
          if (!disposed) setLogs((items) => [result.workLog, ...items.filter((row) => row.id !== result.workLog.id)]);
        }
      } catch (failure) { if (!disposed) setError(failure instanceof Error ? failure.message : "Không tải được dữ liệu"); }
      finally { running = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);
  const describe = (scheduleId: string, teacherId: string) => {
    const schedule = schedules.find((row) => row.id === scheduleId);
    const slot = timeSlots.find((row) => row.id === schedule?.timeSlotId);
    return [teachers.find((row) => row.id === teacherId)?.name || teacherId, schedule?.date || "Lịch đã xóa", schools.find((row) => row.id === schedule?.schoolId)?.name, classes.find((row) => row.id === schedule?.classId)?.name, slot ? `${slot.start}–${slot.end}` : ""].filter(Boolean).join(" · ");
  };
  const stamp = (value: string) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : value;
  return <section className="space-y-4 rounded-3xl border border-cyan-200 bg-white p-5">
    <h2 className="text-lg font-bold text-cyan-950">Duyệt hoàn thành chuyên đề</h2>
    {error ? <p role="alert" className="text-rose-700">{error}</p> : null}
    {logs.filter((row) => row.activityTypeCode && ["COMPLETED", "PENDING", "FAILED"].includes(row.status) && !reports.some((report) => report.scheduleId === row.scheduleId && report.teacherId === row.teacherId && report.status !== "REJECTED")).map((log) => <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cyan-50 p-3">
      <div><p className="font-bold">{describe(log.scheduleId, log.teacherId)}</p><p>{topicReportActivity(log.activityTypeCode)?.name} · {log.roleCode === "ASSISTANT" ? "Trợ giảng" : "Giáo viên chính"}</p>{log.evidenceUrl ? <a href={log.evidenceUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">Minh chứng</a> : null}</div>
      <button disabled={busy || log.status === "PENDING"} className="rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-40" onClick={async () => {
        setBusy(true); setError("");
        try { const result = await request<{ workLog: TeachingWorkLog }>("/api/teaching-work-logs", { scheduleId: log.scheduleId, teacherId: log.teacherId, intent: "approve" }); setLogs((items) => [result.workLog, ...items.filter((row) => row.id !== result.workLog.id)]); }
        catch (failure) { setError(failure instanceof Error ? failure.message : "Duyệt thất bại"); }
        finally { setBusy(false); }
      }}>{log.status === "PENDING" ? "Đang đối chiếu" : "Duyệt hoàn thành"}</button>
    </div>)}
    <h2 className="text-lg font-bold text-cyan-950">Báo cáo tiết bị hủy</h2>
    <input aria-label="Lọc báo cáo tiết bị hủy" placeholder="Tìm giáo viên, ngày hoặc lý do..." value={filter} onChange={(event) => setFilter(event.target.value)} className="w-full rounded-xl border p-3" />
    {reports.filter((row) => `${describe(row.scheduleId, row.teacherId)} ${row.reason}`.toLocaleLowerCase("vi").includes(filter.toLocaleLowerCase("vi"))).map((report) => <div key={report.id} className="rounded-xl border border-rose-100 p-3">
      <p className="font-bold">{describe(report.scheduleId, report.teacherId)}</p><p className="whitespace-pre-wrap">{report.reason}</p><p className="text-sm text-slate-600">Điểm danh: {stamp(report.attendanceAt)} · Báo hủy: {stamp(report.reportedAt)}</p>
      <p>{report.status === "REVIEWED" ? "Admin đã ghi nhận" : report.status === "CONFIRMED" ? "Đã hủy · Chờ admin xem" : report.status === "REJECTED" ? "HRM đã có công · Cần admin xử lý" : "Đang đối chiếu HRM"}</p>
      {report.status === "CONFIRMED" ? <button disabled={busy} className="mt-2 rounded-xl border px-3 py-2" onClick={async () => {
        setBusy(true);
        try { const result = await request<{ report: CancellationReport }>("/api/schedule-cancellations", { id: report.id }, "PATCH"); setReports((items) => items.map((row) => row.id === report.id ? result.report : row)); }
        catch (failure) { setError(failure instanceof Error ? failure.message : "Không ghi nhận được"); }
        finally { setBusy(false); }
      }}>Đã xem và ghi nhận</button> : null}
    </div>)}
    {!reports.length ? <p className="text-slate-600">Chưa có báo cáo hủy.</p> : null}
  </section>;
}
