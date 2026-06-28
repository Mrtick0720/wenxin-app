'use client'

import React, { lazy, Suspense } from 'react'
import { useStaff } from '@/app/components/StaffProvider'
import type { StaffRole } from '@/lib/auth/types'
import { FullPageSpinner } from '@/app/components/Spinner'

// Client-side stack page registry.
//
// IMPORTANT: this module imports ONLY client-safe page modules. Server
// Components that pull in `server-only` (e.g. /attendance, /checklist,
// which import lib/auth/currentStaff) are intentionally NOT registered here, so
// they never enter the client bundle. Those routes navigate by URL via the
// `getPageElement() === null` fallback in NavLink / BottomNav.
//
// Pure route metadata (path/label/section/key) lives in ./stackRoutes, which
// imports no page modules at all.

// Exported so HomeRefresh can pass them to preloadStaggered() without this
// module needing to know about the preload schedule.
export const loadPurchaseClient = () => import('@/app/purchase/PurchaseClient')
export const loadBentoClient = () => import('@/app/bento/BentoClient')
export const loadInventoryPage = () => import('@/app/inventory/page')
export const loadStaffPage = () => import('@/app/staff/page')

const loadStaffAccountsStack = () => import('@/app/staff/accounts/StaffAccountsStack')
const loadTasksPage = () => import('@/app/tasks/page')
const loadProfileStack = () => import('@/app/profile/ProfileStack')
const loadReceivablesPage = () => import('@/app/receivables/page')
const loadPayablesPage = () => import('@/app/payables/page')
const loadFinancePage = () => import('@/app/finance/page')
const loadReportsPage = () => import('@/app/reports/page')
const loadDineInPage = () => import('@/app/dine-in/page')
const loadReservationsPage = () => import('@/app/reservations/page')
const loadComplaintsPage = () => import('@/app/complaints/page')
const loadIncidentsPage = () => import('@/app/incidents/page')
const loadAllModulesPage = () => import('@/app/all/page')
const loadSuppliersPage = () => import('@/app/suppliers/page')
const loadAssetsPage = () => import('@/app/assets/page')
const loadMarketingPage = () => import('@/app/marketing/page')
const loadKitchenTasksPage = () => import('@/app/kitchen-tasks/page')
const loadCustomersClient = () => import('@/app/bento/customers/CustomersClient')
export const loadCashierClient = () => import('@/app/cashier/CashierClient')

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
const KitchenTasksPage = lazy(loadKitchenTasksPage)
const CustomersClientPage = lazy(loadCustomersClient)
const CashierClientPage = lazy(loadCashierClient)

function PageFallback() {
  return <FullPageSpinner />
}

function PurchaseFallback() {
  return <FullPageSpinner />
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

type RouteFactory = (query: URLSearchParams) => React.ReactNode

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
  '/reservations': (q) => <S><ReservationsPage initialDate={q.get('date') ?? undefined} /></S>,
  '/complaints':   () => <S><ComplaintsPage /></S>,
  '/incidents':    () => <S><IncidentsPage /></S>,
  '/all':          () => <S><AllModulesPage /></S>,
  '/suppliers':    () => <S><SuppliersPage /></S>,
  '/assets':       () => <S><AssetsPage /></S>,
  '/marketing':    () => <S><MarketingPage /></S>,
  '/kitchen-tasks': () => <S><KitchenTasksPage /></S>,
  '/bento/customers': () => <S><CustomersClientPage /></S>,
  '/cashier':         () => <S><CashierClientPage /></S>,
}

/**
 * Returns a renderable element for a client-safe route, or null when the route
 * is not client-renderable (e.g. a Server Component page). Callers should fall
 * back to normal URL navigation when this returns null.
 */
export function getPageElement(href: string): React.ReactNode | null {
  // Split the optional query string so routes are matched by pathname while the
  // params (e.g. ?date=YYYY-MM-DD) are forwarded to the page factory. Stack
  // navigation never changes window.location, so the query can only reach the
  // page this way — it cannot be recovered via useSearchParams().
  const qIndex = href.indexOf('?')
  const pathname = qIndex === -1 ? href : href.slice(0, qIndex)
  const query = new URLSearchParams(qIndex === -1 ? '' : href.slice(qIndex + 1))
  const factory = pages[pathname]
  return factory ? factory(query) : null
}

