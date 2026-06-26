// ── Purchase Cost Ratio — pure math ──
// Cost Ratio = Purchase Total / Revenue Total × 100%.
// No Supabase, no side effects. Safe to unit-test.

export type RatioStatus = 'excellent' | 'good' | 'warning' | 'bad' | 'na'

/** Default kitchen cost-control target (percent). */
export const COST_RATIO_TARGET = 30

/** Status thresholds (percent): ≤25 excellent · 25–30 good · 30–35 warning · >35 bad. */
export const COST_RATIO_EXCELLENT_MAX = 25
export const COST_RATIO_GOOD_MAX = 30
export const COST_RATIO_WARNING_MAX = 35

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Cost ratio as a percentage, or null when it cannot be computed
 * (missing or non-positive revenue).
 */
export function costRatio(
  purchaseTotal: number | null | undefined,
  revenueTotal: number | null | undefined,
): number | null {
  if (revenueTotal === null || revenueTotal === undefined) return null
  if (!Number.isFinite(revenueTotal) || revenueTotal <= 0) return null
  const purchase = purchaseTotal ?? 0
  return round1((purchase / revenueTotal) * 100)
}

/** Traffic-light status for a ratio. */
export function ratioStatus(ratio: number | null | undefined): RatioStatus {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return 'na'
  if (ratio <= COST_RATIO_EXCELLENT_MAX) return 'excellent'
  if (ratio <= COST_RATIO_GOOD_MAX) return 'good'
  if (ratio <= COST_RATIO_WARNING_MAX) return 'warning'
  return 'bad'
}

/** Short human label for a status. */
export function statusLabel(status: RatioStatus): string {
  switch (status) {
    case 'excellent': return 'Excellent'
    case 'good': return 'Good'
    case 'warning': return 'Watch'
    case 'bad': return 'Too high'
    default: return 'No data'
  }
}
