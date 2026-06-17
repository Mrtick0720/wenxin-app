// ── Purchase Cost Ratio KPI — data assembly ──
// Computes purchase totals via the ADMIN client (bypasses RLS) so the KPI is
// correct for every role — including staff, whose RLS only exposes today's rows.
// Revenue comes from the FeedMe relay cache. Output is gated per role: staff
// receive ratio% + status ONLY (no revenue/purchase amounts ever serialized).

import 'server-only'

import type { StaffRole } from '@/lib/auth/types'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { readRelayDaily, readRelayWeek, readRelayMtd } from '@/lib/feedme/relayStore'
import { businessToday, monthStart, shiftDays } from './time'
import { COST_RATIO_TARGET, costRatio, ratioStatus } from './kpiMath'
import { canViewMonthTotal, canViewPurchaseCosts } from './permissions'
import type { PurchaseKpi, RatioPeriod } from './types'

type Totals = { today: number; week: number; month: number }

async function purchaseTotals(today: string): Promise<Totals> {
  const weekFrom = shiftDays(today, -6)
  const mStart = monthStart(today)
  const from = mStart < weekFrom ? mStart : weekFrom

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('purchase_items')
    .select('date, total_price')
    .gte('date', from)
  if (error) throw error

  const rows = (data ?? []) as { date: string; total_price: number | null }[]
  const sum = (pred: (d: string) => boolean) =>
    rows.filter((r) => pred(r.date)).reduce((s, r) => s + (r.total_price ?? 0), 0)

  return {
    today: sum((d) => d === today),
    week: sum((d) => d >= weekFrom),
    month: sum((d) => d >= mStart),
  }
}

function period(purchase: number, revenue: number | null, showAmounts: boolean): RatioPeriod {
  const ratio = costRatio(purchase, revenue)
  return {
    ratio,
    status: ratioStatus(ratio),
    revenue: showAmounts ? revenue : null,
    purchase: showAmounts ? purchase : null,
  }
}

export async function computeKpi(role: StaffRole): Promise<PurchaseKpi> {
  const today = businessToday()
  const showAmounts = canViewPurchaseCosts(role) // owner + manager
  const showMonth = canViewMonthTotal(role) || !showAmounts
  // ↑ owner sees month with amounts; staff sees month ratio-only (kitchen
  //   benchmark is monthly); manager is restricted to today + last 7 days.

  const [totals, daily, week, mtd] = await Promise.all([
    purchaseTotals(today),
    readRelayDaily(),
    readRelayWeek(),
    readRelayMtd(),
  ])

  // Today's revenue only counts if the relay value is actually for today.
  const revenueToday =
    daily?.value.date === today ? daily.value.revenue ?? null : null
  const revenueWeek = week?.totalRevenue ?? null
  const revenueMonth = mtd?.mtdRevenue ?? null

  return {
    target: COST_RATIO_TARGET,
    showAmounts,
    today: period(totals.today, revenueToday, showAmounts),
    week: period(totals.week, revenueWeek, showAmounts),
    month: showMonth ? period(totals.month, revenueMonth, showAmounts) : null,
  }
}
