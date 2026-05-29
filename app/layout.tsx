import type { Metadata } from "next";
import "./globals.css";

const appTitle = "METTASOUL - Education with love";
const appDescription = "Ứng dụng quản lý lịch dạy, giáo án và điểm danh cho đội ngũ giáo viên METTASOUL.";

export const metadata: Metadata = {
  metadataBase: new URL("https://life-skill.vercel.app"),
  applicationName: "METTASOUL",
  title: appTitle,
  description: appDescription,
  keywords: ["METTASOUL", "lịch dạy", "giáo án", "điểm danh", "kỹ năng sống"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: appTitle,
    description: appDescription,
    url: "/",
    siteName: "METTASOUL",
    locale: "vi_VN",
    type: "website",
    images: [
      {
        url: "/mettasoul-cover.png",
        width: 1200,
        height: 630,
        alt: "METTASOUL - Education with love",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: appTitle,
    description: appDescription,
    images: ["/mettasoul-cover.png"],
  },
  icons: {
    icon: "/mettasoul-logo.png",
    apple: "/mettasoul-logo.png",
  },
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
