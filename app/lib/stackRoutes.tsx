'use client'

import React, { lazy, Suspense } from 'react'
import { todayLocalStr } from '@/lib/dateUtils'

const PurchaseClient  = lazy(() => import('@/app/purchase/PurchaseClient'))
const BentoClient     = lazy(() => import('@/app/bento/BentoClient'))
const StaffPage       = lazy(() => import('@/app/staff/page'))
const FinancePage     = lazy(() => import('@/app/finance/page'))
const InventoryPage   = lazy(() => import('@/app/inventory/page'))
const ReportsPage     = lazy(() => import('@/app/reports/page'))
const DineInPage      = lazy(() => import('@/app/dine-in/page'))
const ReservationsPage = lazy(() => import('@/app/reservations/page'))
const ComplaintsPage  = lazy(() => import('@/app/complaints/page'))
const TasksPage       = lazy(() => import('@/app/tasks/page'))
const IncidentsPage   = lazy(() => import('@/app/incidents/page'))

// Blank screen while bundle loads — matches page background
function PageFallback() {
  return <div style={{ position: 'fixed', inset: 0, background: '#f9fafb' }} />
}

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}

type RouteFactory = () => React.ReactNode

export const routes: Record<string, RouteFactory> = {
  '/purchase':     () => <S><PurchaseClient   initialItems={[]} initialDate={todayLocalStr()} /></S>,
  '/bento':        () => <S><BentoClient      initialOrders={[]} /></S>,
  '/staff':        () => <S><StaffPage /></S>,
  '/finance':      () => <S><FinancePage /></S>,
  '/inventory':    () => <S><InventoryPage /></S>,
  '/reports':      () => <S><ReportsPage /></S>,
  '/dine-in':      () => <S><DineInPage /></S>,
  '/reservations': () => <S><ReservationsPage /></S>,
  '/complaints':   () => <S><ComplaintsPage /></S>,
  '/tasks':        () => <S><TasksPage /></S>,
  '/incidents':    () => <S><IncidentsPage /></S>,
}

export function getPageElement(href: string): React.ReactNode | null {
  const factory = routes[href]
  return factory ? factory() : null
}
