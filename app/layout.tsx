import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NavigationProvider } from "./components/NavigationStack";
import SessionHeartbeat from "./components/SessionHeartbeat";
import StaffProvider from "./components/StaffProvider";
import GlobalBottomNav from "./components/GlobalBottomNav";
import UnregisterSW from "./components/UnregisterSW";
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

async function getPurchasePending(): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient()
    const [checklistRes, verifyRes] = await Promise.all([
      supabase.from('purchase_checklist').select('id').eq('status', 'pending').limit(1),
      supabase.from('purchase_items').select('id').eq('status', 'pending_verification').limit(1),
    ])
    return (checklistRes.data?.length ?? 0) > 0 || (verifyRes.data?.length ?? 0) > 0
  } catch {
    return false
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#C9A84C",
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
  // Transient session-verification failures (Supabase hiccup, missing/incorrect
  // env on the deployment) must not crash the entire app via the root layout.
  // Degrade to logged-out; proxy + SessionHeartbeat recover on the next request.
  const staff = await getCurrentStaff().catch(() => null)
  const pendingCount = staff ? await getPendingTaskCount() : 0
  const purchasePending = staff ? await getPurchasePending() : false

  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={{ colorScheme: 'light', background: '#ffffff' }}
    >
      <head>
        {/* Force iOS PWA to never serve stale cached app shell */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className="min-h-full" style={{ colorScheme: 'light', background: '#ffffff' }}>
        <UnregisterSW />
        <StaffProvider staff={staff}>
          <SessionHeartbeat />
          <NavigationProvider>
            {children}
            {staff && <GlobalBottomNav pendingCount={pendingCount} purchasePending={purchasePending} />}
          </NavigationProvider>
        </StaffProvider>
      </body>
    </html>
  );
}
