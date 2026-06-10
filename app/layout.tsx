import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NavigationProvider } from "./components/NavigationStack";
import SessionHeartbeat from "./components/SessionHeartbeat";
import StaffProvider from "./components/StaffProvider";
import GlobalBottomNav from "./components/GlobalBottomNav";
import { getCurrentStaff } from "@/lib/auth/currentStaff";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function getPendingTaskCount(): Promise<number> {
  try {
    const supabase = await createServerSupabaseClient()
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('tasks')
      .select('id')
      .eq('date', today)
      .eq('status', 'pending')
    return data?.length ?? 0
  } catch {
    return 0
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

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
  other: {
    // Next.js 16 only emits the standards-track "mobile-web-app-capable";
    // iOS (especially over plain http) still keys standalone install off the
    // legacy apple- meta, so emit it explicitly.
    "apple-mobile-web-app-capable": "yes",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const staff = await getCurrentStaff()
  const pendingCount = staff ? await getPendingTaskCount() : 0

  return (
    <html lang="en" style={{ colorScheme: 'light', background: '#ffffff' }}>
      <body className="min-h-full" style={{ colorScheme: 'light', background: '#ffffff' }}>
        <StaffProvider staff={staff}>
          <SessionHeartbeat />
          <NavigationProvider>
            {children}
            {staff && <GlobalBottomNav pendingCount={pendingCount} />}
          </NavigationProvider>
        </StaffProvider>
      </body>
    </html>
  );
}
