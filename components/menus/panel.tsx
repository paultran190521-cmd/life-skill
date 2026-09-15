import { ChevronRight } from "lucide-react";
import type React from "react";

export function Panel({
  title,
  action,
  collapsed = false,
  onToggleCollapse,
  className = "",
  children,
}: {
  title: string;
  action?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-white/75 bg-white/90 p-4 shadow-[0_20px_52px_rgba(18,46,68,0.09),inset_0_1px_0_rgba(255,255,255,0.9)] sm:rounded-3xl sm:p-5 ${className}`}>
      <div className={`${collapsed ? "" : "mb-4 sm:mb-5"} flex items-start justify-between gap-3`}>
        <h2 className="text-base font-black tracking-tight text-[var(--brand-dark)] sm:text-lg">{title}</h2>
        <div className="flex items-center gap-2">
          {action ? (
            <span className="max-w-[42vw] truncate rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-[var(--brand-dark)] sm:max-w-none">
              {action}
            </span>
          ) : null}
          {onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={collapsed ? "Mở rộng" : "Thu gọn"}
              aria-label={collapsed ? `Mở rộng ${title}` : `Thu gọn ${title}`}
              className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-50 to-sky-50 text-[var(--brand-dark)] shadow-sm transition hover:bg-cyan-100"
            >
              <ChevronRight size={18} className={`transition-transform ${collapsed ? "" : "rotate-90"}`} />
            </button>
          ) : null}
        </div>
      </div>
      {collapsed ? null : children}
    </section>
  );
}
