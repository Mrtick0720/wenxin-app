// FeedMe adapter layer (proof-of-concept).
//
// The dashboard depends on THIS module, not on the raw mock JSON, so the data
// source can later be swapped (scheduled export, accounting relay, or a
// read-only API) without touching any UI. For now it reads a captured FeedMe
// Product Sales response from disk and returns a normalized daily summary.
//
// PoC constraints: mock data only — no live FeedMe endpoint, no JWT, no auth,
// no Firebase refresh, no Supabase sync.

import mockProductSales from './mock/productSales.json'
import mockDailySales from './mock/dailySales.json'
import {
  parseProductSales,
  type DailyRevenueSummary,
  type FeedMeProductSalesResponse,
} from './parseProductSales'
import {
  parseDailySales,
  toRevenueTrend,
  type DailySalesPoint,
  type RevenuePoint,
  type FeedMeDailySalesResponse,
} from './parseDailySales'
import { parsePaymentMix, type PaymentBreakdown } from './parsePaymentMix'

export type { DailyRevenueSummary } from './parseProductSales'
export type {
  DailySalesPoint,
  DailyRevenueComparison,
  RevenuePoint,
} from './parseDailySales'
export type { PaymentBreakdown } from './parsePaymentMix'
export { deriveDailyComparison } from './parseDailySales'

export function getFeedMeDailySummary(): DailyRevenueSummary {
  return parseProductSales(mockProductSales as FeedMeProductSalesResponse)
}

export function getFeedMeDailySalesHistory(): DailySalesPoint[] {
  return parseDailySales(mockDailySales as FeedMeDailySalesResponse)
}

// Revenue trend model (Step 4) — only the dates present in captured data.
export function getFeedMeRevenueTrend(): RevenuePoint[] {
  return toRevenueTrend(getFeedMeDailySalesHistory())
}

// Payment mix (Step 5) — [] until a captured response includes payment data.
export function getFeedMePaymentMix(): PaymentBreakdown[] {
  return parsePaymentMix((mockDailySales as FeedMeDailySalesResponse).payments)
}
