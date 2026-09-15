"use client";

import { useRef, useState, type ReactNode } from "react";

/** Keep large lists bounded without losing parent-owned drafts or selections. */
export function PagedList<T>({ items, children, resetKey, pageSize = 30, className = "" }: {
  items: readonly T[];
  children: (rows: readonly T[]) => ReactNode;
  resetKey: string;
  pageSize?: number;
  className?: string;
}) {
  const [selection, setSelection] = useState({ key: resetKey, page: 1 });
  const anchor = useRef<HTMLDivElement>(null);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(selection.key === resetKey ? selection.page : 1, pageCount);
  const start = (page - 1) * pageSize;

  function changePage(next: number) {
    setSelection({ key: resetKey, page: next });
    anchor.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }

  return (
    <div ref={anchor} className="scroll-mt-4">
      {pageCount > 1 ? (
        <nav aria-label="Phân trang danh sách" className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span aria-live="polite" className="font-semibold text-[var(--muted)]">
            {start + 1}–{Math.min(start + pageSize, items.length)} / {items.length}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page === 1} onClick={() => changePage(page - 1)} className="rounded-xl border border-cyan-200 bg-white px-3 py-2 font-bold">Trước</button>
            <span>Trang {page}/{pageCount}</span>
            <button type="button" disabled={page === pageCount} onClick={() => changePage(page + 1)} className="rounded-xl border border-cyan-200 bg-white px-3 py-2 font-bold">Sau</button>
          </div>
        </nav>
      ) : null}
      <div className={className}>{children(items.slice(start, start + pageSize))}</div>
    </div>
  );
}
