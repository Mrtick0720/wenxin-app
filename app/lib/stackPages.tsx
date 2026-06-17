'use client'

import React, { lazy, Suspense } from 'react'
import { useStaff } from '@/app/components/StaffProvider'
import type { StaffRole } from '@/lib/auth/types'

// Client-side stack page registry.
//
// IMPORTANT: this module imports ONLY client-safe page modules. Server
// Components that pull in `server-only` (e.g. /cashier, /attendance, /checklist,
// which import lib/auth/currentStaff) are intentionally NOT registered here, so
// they never enter the client bundle. Those routes navigate by URL via the
// `getPageElement() === null` fallback in NavLink / BottomNav.
//
// Pure route metadata (path/label/section/key) lives in ./stackRoutes, which
// imports no page modules at all.

const PurchaseClient   = lazy(() => import('@/app/purchase/PurchaseClient'))
const BentoClient      = lazy(() => import('@/app/bento/BentoClient'))
const StaffPage        = lazy(() => import('@/app/staff/page'))
const FinancePage      = lazy(() => import('@/app/finance/page'))
const InventoryPage    = lazy(() => import('@/app/inventory/page'))
const ReportsPage      = lazy(() => import('@/app/reports/page'))
const DineInPage       = lazy(() => import('@/app/dine-in/page'))
const ReservationsPage = lazy(() => import('@/app/reservations/page'))
const ComplaintsPage   = lazy(() => import('@/app/complaints/page'))
const IncidentsPage    = lazy(() => import('@/app/incidents/page'))
const TasksPage        = lazy(() => import('@/app/tasks/page'))
const AllModulesPage   = lazy(() => import('@/app/all/page'))
const SuppliersPage    = lazy(() => import('@/app/suppliers/page'))
const AssetsPage       = lazy(() => import('@/app/assets/page'))
const MarketingPage    = lazy(() => import('@/app/marketing/page'))

function PageFallback() {
  return <div style={{ position: 'fixed', inset: 0, background: '#f9fafb' }} />
}

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}

// BentoClient requires a role — read from StaffProvider context
function BentoStack() {
  const staff = useStaff()
  const role = (staff?.role ?? 'front_desk') as StaffRole
  return <BentoClient initialOrders={[]} role={role} />
}

type RouteFactory = () => React.ReactNode

const pages: Record<string, RouteFactory> = {
  '/purchase':     () => <S><PurchaseClient /></S>,
  '/bento':        () => <S><BentoStack /></S>,
  '/staff':        () => <S><StaffPage /></S>,
  '/finance':      () => <S><FinancePage /></S>,
  '/inventory':    () => <S><InventoryPage /></S>,
  '/reports':      () => <S><ReportsPage /></S>,
  '/dine-in':      () => <S><DineInPage /></S>,
  '/reservations': () => <S><ReservationsPage /></S>,
  '/complaints':   () => <S><ComplaintsPage /></S>,
  '/incidents':    () => <S><IncidentsPage /></S>,
  '/tasks':        () => <S><TasksPage /></S>,
  '/all':          () => <S><AllModulesPage /></S>,
  '/suppliers':    () => <S><SuppliersPage /></S>,
  '/assets':       () => <S><AssetsPage /></S>,
  '/marketing':    () => <S><MarketingPage /></S>,
}

/**
 * Returns a renderable element for a client-safe route, or null when the route
 * is not client-renderable (e.g. a Server Component page). Callers should fall
 * back to normal URL navigation when this returns null.
 */
export function getPageElement(href: string): React.ReactNode | null {
  const factory = pages[href]
  return factory ? factory() : null
}

/** Preload all client-safe lazy page chunks so the first stack navigation has zero code-loading delay. */
export function preloadRoutes() {
  // `.preload()` is a runtime method React attaches to lazy components
  // but does not expose in the TS types. Cast to access it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (c: any) => c.preload?.()
  p(PurchaseClient)
  p(BentoClient)
  p(StaffPage)
  p(FinancePage)
  p(InventoryPage)
  p(ReportsPage)
  p(DineInPage)
  p(ReservationsPage)
  p(ComplaintsPage)
  p(IncidentsPage)
  p(TasksPage)
  p(AllModulesPage)
  p(SuppliersPage)
  p(AssetsPage)
  p(MarketingPage)
}
