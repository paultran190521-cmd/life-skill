"use client";

import { useEffect } from "react";

/**
 * Error Boundary cap cao nhat - bat ca loi xay ra trong RootLayout, noi ma
 * app/error.tsx khong voi toi duoc. File nay phai tu render <html> va <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[mettasoul] Loi toan cuc:", error);
  }, [error]);

  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg,#fffbeb 0%,#ffffff 50%,#ecfeff 100%)",
          fontFamily: "Quicksand, system-ui, -apple-system, Segoe UI, sans-serif",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: "100%",
            background: "rgba(255,255,255,0.92)",
            border: "1px solid #cffafe",
            borderRadius: 24,
            padding: 32,
            textAlign: "center",
            boxShadow: "0 20px 40px rgba(11,111,137,0.08)",
          }}
        >
          <div style={{ fontSize: 34, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ color: "#0b6f89", fontSize: 20, fontWeight: 800, margin: 0 }}>
            METTASOUL gặp sự cố
          </h1>
          <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.6, marginTop: 12 }}>
            Ứng dụng không khởi tạo được giao diện. Dữ liệu trên Google Sheet vẫn an toàn.
            Vui lòng tải lại trang.
          </p>
          {error.digest ? (
            <p style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace", marginTop: 16 }}>
              Mã lỗi: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              background: "#1992b0",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "10px 22px",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Thử lại
          </button>
        </div>
      </body>
    </html>
  );
}
