'use client'

import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'

// Shared-layout navigation: a single BottomNav mounted once at the root layout,
// sitting above the navigation stack layers so it stays visible on every primary
// module page and detail page. Hidden only on full-screen auth / system routes
// that have no tab bar. In-app stack navigation keeps the URL at '/', so those
// pushed pages fall through to the visible branch here (correct).
const HIDDEN_ROUTES = new Set([
  '/login',
  '/change-password',
  '/account-disabled',
  '/access-denied',
])

export default function GlobalBottomNav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname()
  if (pathname && HIDDEN_ROUTES.has(pathname)) return null
  return <BottomNav pendingCount={pendingCount} />
}
