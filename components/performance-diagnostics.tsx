"use client";
import { useEffect, useState } from "react";
import { performanceSummary } from "@/lib/client-performance";

export function PerformanceDiagnostics() {
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<ReturnType<typeof performanceSummary>>([]);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return <details className="rounded-2xl border border-cyan-100 bg-white p-4" onToggle={(event) => { if (event.currentTarget.open) setRows(performanceSummary()); }}>
    <summary className="cursor-pointer font-bold">Hiệu năng trên thiết bị này</summary>
    <p className="my-3 text-xs text-[var(--muted)]">100 mẫu gần nhất trong phiên này, không gửi đi nơi khác. Menu: từ thao tác chuyển đến khung hình kế tiếp sau khi dựng xong; API: đến khi đọc xong phản hồi. Đây không phải chỉ số INP.</p>
    <button type="button" onClick={() => setRows(performanceSummary())} className="mb-3 rounded-xl border px-3 py-2 text-sm">Cập nhật số đo</button>
    <div className="overflow-x-auto"><table className="w-full text-left text-xs">
      <thead><tr><th>Tác vụ</th><th>Số mẫu</th><th>Trung vị</th><th>P95</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.name}><td className="py-2">{row.name}</td><td>{row.count}</td><td>{row.median} ms</td><td>{row.p95} ms</td></tr>)}</tbody>
    </table></div>
    {!rows.length ? <p className="text-sm">Hãy chuyển một vài menu rồi quay lại để xem số đo.</p> : null}
  </details>;
}
