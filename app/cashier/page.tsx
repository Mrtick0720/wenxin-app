import { requireCurrentStaff } from '@/lib/auth/currentStaff'
import { canViewCashier } from '@/lib/cashier/permissions'
import { redirect } from 'next/navigation'
import { readRelayDaily } from '@/lib/feedme/relayStore'
import { fetchCashDrawerSessionsAction, fetchCashAdjustmentsAction } from './actions'
import { businessToday } from '@/lib/purchaseLedger/time'
import CashierClient from './CashierClient'

export const dynamic = 'force-dynamic'

export default async function CashierPage() {
  const staff = await requireCurrentStaff()

  if (!canViewCashier(staff.role)) {
    redirect('/access-denied')
  }

  const businessDate = businessToday()
  const canImport = staff.role === 'owner'
  const canAdjust = staff.role === 'owner' || staff.role === 'manager'

  // Fetch sessions and adjustments in parallel
  const [sessionsResult, adjustmentsResult] = await Promise.all([
    fetchCashDrawerSessionsAction(businessDate),
    fetchCashAdjustmentsAction(businessDate),
  ])

  const sessions = sessionsResult.ok ? sessionsResult.data : []
  const adjustments = adjustmentsResult.ok ? adjustmentsResult.data : []

  // FeedMe relay — fallback when no session imported yet
  let feedMeCashSales: number | null = null
  let feedMePayments: Array<{ method: string; amount: number; percentage: number }> | null = null

  if (sessions.length === 0) {
    try {
      const relay = await readRelayDaily()
      if (relay?.value) {
        const pmts = relay.value.payments
        feedMeCashSales = pmts?.find(p => p.method === 'CASH')?.amount ?? null
        feedMePayments  = pmts?.length ? pmts : null
      }
    } catch {
      // FeedMe unavailable — page renders with empty states
    }
  }

  return (
    <CashierClient
      sessions={sessions}
      adjustments={adjustments}
      feedMeCashSales={feedMeCashSales}
      feedMePayments={feedMePayments}
      businessDate={businessDate}
      canImport={canImport}
      canAdjust={canAdjust}
    />
  )
}
