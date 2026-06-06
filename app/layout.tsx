import type { Metadata } from "next";
import "./globals.css";
import { NavigationProvider } from "./components/NavigationStack";
import SessionHeartbeat from "./components/SessionHeartbeat";
import StaffProvider from "./components/StaffProvider";
import { getCurrentStaff } from "@/lib/auth/currentStaff";

export const metadata: Metadata = {
  title: "Wenxin Operations",
  description: "Wenxin restaurant operations system",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Wenxin",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const staff = await getCurrentStaff()

  return (
    <html lang="en" style={{ colorScheme: 'light' }}>
      <body className="min-h-full" style={{ colorScheme: 'light', background: '#f9fafb' }}>
        <StaffProvider staff={staff}>
          <SessionHeartbeat />
          <NavigationProvider>
            {children}
          </NavigationProvider>
        </StaffProvider>
      </body>
    </html>
  );
}
