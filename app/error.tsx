"use client";

import { useEffect } from "react";

/**
 * Error Boundary cap route.
 *
 * Truoc day ung dung khong co error boundary nao, nen bat ky exception nao trong
 * luc render (vi du mot o du lieu Google Sheet sai dinh dang ngay) cung lam sap
 * toan bo cay React va nguoi dung chi thay trang loi trang/den cua Next.js.
 * Man hinh nay giu lai giao dien METTASOUL va cho phep thu lai ngay tai cho.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[mettasoul] Loi giao dien:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-white to-cyan-50 p-6">
      <div className="w-full max-w-lg rounded-3xl border border-cyan-100 bg-white/90 p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-3xl">
          ⚠️
        </div>

        <h1 className="text-xl font-black text-[#0b6f89]">Đã xảy ra lỗi khi hiển thị trang</h1>

        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
          Ứng dụng gặp sự cố khi dựng giao diện. Dữ liệu của bạn trên Google Sheet
          vẫn an toàn. Hãy thử tải lại; nếu vẫn lỗi, báo cho quản trị viên kèm mã bên dưới.
        </p>

        {error.digest ? (
          <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">
            Mã lỗi: {error.digest}
          </p>
        ) : null}

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-[#1992b0] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#0b6f89]"
          >
            Thử lại
          </button>
          <a
            href="/"
            className="rounded-xl border border-cyan-200 bg-white px-5 py-2.5 text-sm font-black text-[#0b6f89] transition hover:bg-cyan-50"
          >
            Về trang chủ
          </a>
        </div>
      </div>
    </div>
  );
}
