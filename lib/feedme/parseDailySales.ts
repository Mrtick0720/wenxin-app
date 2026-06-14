// FeedMe "Daily Sales" report parser (proof-of-concept).
//
// Input : a captured FeedMe Daily Sales response (see ./mock/dailySales.json).
//         Each row is one business day. Only days actually present in the
//         captured response appear here — missing days are NEVER invented.
// Output: a normalized, date-ascending array the dashboard can compare/chart.
//
// Per-day column mapping (per the captured FeedMe response shape):
//   Nett  -> revenue
//   Gross -> gross
//   Qty   -> qty
//   Pax   -> pax           (optional — omitted when the capture has no Pax)
//   SC    -> serviceCharge

import type { FeedMePaymentRow } from './parsePaymentMix'

export interface FeedMeDailySalesRow {
  Date: string
  Gross: number
  SC: number
  Nett: number
  Qty: number
  Pax?: number
  isRollup?: boolean
}

export interface FeedMeDailySalesResponse {
  report?: string
  currency?: string
  dateRange?: { start: string; end?: string }
  rows: FeedMeDailySalesRow[]
  payments?: FeedMePaymentRow[]
}

export interface DailySalesPoint {
  date: string
  revenue: number
  gross: number
  qty: number
  pax?: number
  serviceCharge: number
}

export function parseDailySales(
  response: FeedMeDailySalesResponse,
): DailySalesPoint[] {
  return response.rows
    .filter((row) => row.isRollup !== true)
    .map((row) => {
      const point: DailySalesPoint = {
        date: row.Date,
        revenue: row.Nett,
        gross: row.Gross,
        qty: row.Qty,
        serviceCharge: row.SC,
      }
      // Only attach pax when the captured row actually carries it.
      if (typeof row.Pax === 'number') point.pax = row.Pax
      return point
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ── Revenue trend model (Step 4) ──
// Data model only, for future 7-day / 30-day charts. Contains exactly the dates
// present in the captured response — no gap-filling, no invented days.
export interface RevenuePoint {
  date: string
  revenue: number
}

export function toRevenueTrend(history: DailySalesPoint[]): RevenuePoint[] {
  return history.map((p) => ({ date: p.date, revenue: p.revenue }))
}

// ── Today vs yesterday comparison (Step 3) ──
export interface DailyRevenueComparison {
  currentBusinessDate: string | null
  previousBusinessDate: string | null
  todayRevenue: number | null
  yesterdayRevenue: number | null
  revenueDifference: number | null
  growthPercent: number | null
}

function isoYesterday(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().split('T')[0]
}

const EMPTY_COMPARISON: DailyRevenueComparison = {
  currentBusinessDate: null,
  previousBusinessDate: null,
  todayRevenue: null,
  yesterdayRevenue: null,
  revenueDifference: null,
  growthPercent: null,
}

// Derives the comparison strictly from captured history — NO hardcoded "today":
//   1. The latest date present in history is the currentBusinessDate.
//   2. The previous calendar day is the previousBusinessDate.
//   3. If that previous day exists in history, derive the real comparison;
//      otherwise yesterday/growth are null so the UI shows "—".
// This is fully data-driven: once history contains a newer date, that date
// automatically becomes "today" without any code or date change.
export function deriveDailyComparison(
  history: DailySalesPoint[],
): DailyRevenueComparison {
  if (history.length === 0) return EMPTY_COMPARISON

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date))
  const current = sorted[sorted.length - 1]
  const currentBusinessDate = current.date
  const todayRevenue = current.revenue
  const previousBusinessDate = isoYesterday(currentBusinessDate)

  const previous = sorted.find((p) => p.date === previousBusinessDate)
  const yesterdayRevenue = previous ? previous.revenue : null

  if (yesterdayRevenue === null || yesterdayRevenue === 0) {
    return {
      currentBusinessDate,
      previousBusinessDate,
      todayRevenue,
      yesterdayRevenue: null,
      revenueDifference: null,
      growthPercent: null,
    }
  }

  return {
    currentBusinessDate,
    previousBusinessDate,
    todayRevenue,
    yesterdayRevenue,
    revenueDifference: Number((todayRevenue - yesterdayRevenue).toFixed(2)),
    growthPercent: Number(
      (((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1),
    ),
  }
}
