import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import AnimateLayout from "./components/AnimateLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "文心管理",
  description: "文心砂锅餐厅管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className={`${geistSans.variable}`} style={{ colorScheme: 'light' }}>
      <body className="min-h-full bg-gray-50" style={{ colorScheme: 'light' }}>
        <AnimateLayout>{children}</AnimateLayout>
      </body>
    </html>
  );
}
