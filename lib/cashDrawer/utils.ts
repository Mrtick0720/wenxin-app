import type { CashDrawerSession } from './types'

/**
 * Expected cash in the drawer: opening float + cash sales + pay-in − pay-out.
 * Returns null when any required field is null (session still open/incomplete).
 * Use this for closed-session reconciliation rows where "—" is the right answer
 * when a field is genuinely unknown.
 */
export function computeCurrentCash(s: CashDrawerSession): number | null {
  const { openingFloat: o, cashSales: c, payIn: i, payOut: p } = s
  if (o == null || c == null || i == null || p == null) return null
  return o + c + i - p
}

/**
 * Live estimate for an OPEN session: treats null cashSales / payIn / payOut as 0
 * so the hero card shows a floor value (openingFloat − payOut) the moment the
 * float is entered, even before FeedMe cash-sales data has been imported.
 * Returns null only when openingFloat itself is missing.
 */
export function computeCurrentCashLive(s: CashDrawerSession): number | null {
  if (s.openingFloat == null) return null
  return s.openingFloat + (s.cashSales ?? 0) + (s.payIn ?? 0) - (s.payOut ?? 0)
}

/**
 * Pick the most informative session from a list:
 *   1. Closed session with computable current cash (final reconciliation)
 *   2. Open session with computable current cash (live view)
 *   3. First session regardless
 *
 * Used by both the Cash Drawer detail page and the Home dashboard so they
 * always surface the same session.
 */
export function selectBestSession(sessions: CashDrawerSession[]): CashDrawerSession | null {
  if (sessions.length === 0) return null
  // Prefer open sessions with computable current cash (live state)
  for (const s of sessions) {
    if (s.closeTime === null && computeCurrentCash(s) !== null) return s
  }
  // Then closed sessions with a closing float (complete reconciliation)
  for (const s of sessions) {
    if (s.closeTime !== null && s.closingFloat !== null) return s
  }
  // Any session with computable current cash
  for (const s of sessions) {
    if (computeCurrentCash(s) !== null) return s
  }
  return sessions[0]
}
