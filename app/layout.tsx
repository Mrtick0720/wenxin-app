import type { Metadata } from "next";
import "./globals.css";
import LayoutCapture from "./components/LayoutCapture";

export const metadata: Metadata = {
  title: "文心管理",
  description: "文心砂锅餐厅管理系统",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "文心",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ colorScheme: 'light' }}>
      <body className="min-h-full" style={{ colorScheme: 'light', background: '#f9fafb' }}>
        <LayoutCapture />
        {children}
      </body>
    </html>
  );
}
