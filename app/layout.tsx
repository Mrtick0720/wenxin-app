import type { Metadata } from "next";
import "./globals.css";
import AnimateLayout from "./components/AnimateLayout";

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
      <body className="min-h-full bg-gray-50" style={{ colorScheme: 'light' }}>
        <AnimateLayout>{children}</AnimateLayout>
      </body>
    </html>
  );
}
