// FeedMe "Product Sales" report parser (proof-of-concept).
//
// Input : a captured FeedMe Product Sales response (see ./mock/productSales.json)
// Output: a normalized daily revenue summary the dashboard can consume.
//
// The report returns one row per product plus a single rollup row
// (`isRollup: true`) carrying the day's financial totals. We read the rollup:
//   Qty  -> qty
//   Gross-> gross
//   SC   -> serviceCharge
//   Nett -> revenue   (Nett = Gross + SC)

export interface FeedMeProductSalesRow {
  product?: string
  Qty: number
  Gross: number
  SC: number
  Nett: number
  isRollup?: boolean
}

export interface FeedMeProductSalesResponse {
  report?: string
  currency?: string
  dateRange?: { start: string; end?: string }
  rows: FeedMeProductSalesRow[]
}

export interface DailyRevenueSummary {
  date: string
  revenue: number       // rollup Nett
  qty: number           // rollup Qty
  gross: number         // rollup Gross
  serviceCharge: number // rollup SC
}

export function parseProductSales(
  response: FeedMeProductSalesResponse,
): DailyRevenueSummary {
  const rollup = response.rows.find((row) => row.isRollup === true)

  if (!rollup) {
    throw new Error(
      'FeedMe Product Sales response is missing its rollup row (isRollup: true)',
    )
  }

  return {
    date: response.dateRange?.start ?? new Date().toISOString().split('T')[0],
    revenue: rollup.Nett,
    qty: rollup.Qty,
    gross: rollup.Gross,
    serviceCharge: rollup.SC,
  }
}
