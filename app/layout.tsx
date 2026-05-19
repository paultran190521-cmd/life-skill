import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Life Skill Scheduler",
  description: "Quan ly lich day, giao an va diem danh giao vien Life Skill.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
