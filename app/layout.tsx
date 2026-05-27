import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HỌC VIỆN METTASOUL",
  description: "Quản lý lịch dạy, giáo án và điểm danh giáo viên HỌC VIỆN METTASOUL.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
