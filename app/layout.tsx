import type { Metadata } from "next";
import "./globals.css";
import LayoutCapture from "./components/LayoutCapture";

export const metadata: Metadata = {
  title: "Wenxin Management",
  description: "Wenxin restaurant management system",
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
