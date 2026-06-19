'use client'

import React, { lazy, Suspense } from 'react'
import { useStaff } from '@/app/components/StaffProvider'
import type { StaffRole } from '@/lib/auth/types'
import { preloadRouteLoaders } from '@/lib/routePreload'

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

const loadPurchaseClient = () => import('@/app/purchase/PurchaseClient')
const loadBentoClient = () => import('@/app/bento/BentoClient')
const loadStaffPage = () => import('@/app/staff/page')
const loadStaffAccountsStack = () => import('@/app/staff/accounts/StaffAccountsStack')
const loadTasksPage = () => import('@/app/tasks/page')
const loadProfileStack = () => import('@/app/profile/ProfileStack')
const loadReceivablesPage = () => import('@/app/receivables/page')
const loadPayablesPage = () => import('@/app/payables/page')
const loadFinancePage = () => import('@/app/finance/page')
const loadInventoryPage = () => import('@/app/inventory/page')
const loadReportsPage = () => import('@/app/reports/page')
const loadDineInPage = () => import('@/app/dine-in/page')
const loadReservationsPage = () => import('@/app/reservations/page')
const loadComplaintsPage = () => import('@/app/complaints/page')
const loadIncidentsPage = () => import('@/app/incidents/page')
const loadAllModulesPage = () => import('@/app/all/page')
const loadSuppliersPage = () => import('@/app/suppliers/page')
const loadAssetsPage = () => import('@/app/assets/page')
const loadMarketingPage = () => import('@/app/marketing/page')

const PurchaseClient = lazy(loadPurchaseClient)
const BentoClient = lazy(loadBentoClient)
const StaffPage = lazy(loadStaffPage)
const StaffAccountsStack = lazy(loadStaffAccountsStack)
const TasksPage = lazy(loadTasksPage)
const ProfileStack = lazy(loadProfileStack)
const ReceivablesPage = lazy(loadReceivablesPage)
const PayablesPage = lazy(loadPayablesPage)
const FinancePage = lazy(loadFinancePage)
const InventoryPage = lazy(loadInventoryPage)
const ReportsPage = lazy(loadReportsPage)
const DineInPage = lazy(loadDineInPage)
const ReservationsPage = lazy(loadReservationsPage)
const ComplaintsPage = lazy(loadComplaintsPage)
const IncidentsPage = lazy(loadIncidentsPage)
const AllModulesPage = lazy(loadAllModulesPage)
const SuppliersPage = lazy(loadSuppliersPage)
const AssetsPage = lazy(loadAssetsPage)
const MarketingPage = lazy(loadMarketingPage)

function PageFallback() {
  return <div style={{ position: 'fixed', inset: 0, background: '#f9fafb' }} />
}

function PurchaseFallback() {
  return (
    <div className="flex h-dvh flex-col bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
        <div className="h-6 w-6" />
        <span className="text-base font-semibold text-gray-800">Purchase</span>
        <div className="w-6" />
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="h-32 animate-pulse rounded-2xl bg-white" />
        <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
        <div className="space-y-3 rounded-2xl bg-white p-4">
          <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    </div>
  )
}

function S({ children, fallback = <PageFallback /> }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return <Suspense fallback={fallback}>{children}</Suspense>
}

// BentoClient requires a role — read from StaffProvider context
function BentoStack() {
  const staff = useStaff()
  const role = (staff?.role ?? 'front_desk') as StaffRole
  return <BentoClient initialOrders={[]} role={role} />
}

type RouteFactory = () => React.ReactNode

const pages: Record<string, RouteFactory> = {
  '/purchase':     () => <S fallback={<PurchaseFallback />}><PurchaseClient /></S>,
  '/bento':        () => <S><BentoStack /></S>,
  '/staff':          () => <S><StaffPage /></S>,
  '/staff/accounts': () => <S><StaffAccountsStack /></S>,
  '/tasks':          () => <S><TasksPage /></S>,
  '/profile':        () => <S><ProfileStack /></S>,
  '/receivables':  () => <S><ReceivablesPage /></S>,
  '/payables':     () => <S><PayablesPage /></S>,
  '/finance':      () => <S><FinancePage /></S>,
  '/inventory':    () => <S><InventoryPage /></S>,
  '/reports':      () => <S><ReportsPage /></S>,
  '/dine-in':      () => <S><DineInPage /></S>,
  '/reservations': () => <S><ReservationsPage /></S>,
  '/complaints':   () => <S><ComplaintsPage /></S>,
  '/incidents':    () => <S><IncidentsPage /></S>,
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

/** Preload the performance-critical Purchase chunk after Home becomes interactive. */
export function preloadRoutes() {
  preloadRouteLoaders([loadPurchaseClient])
}
