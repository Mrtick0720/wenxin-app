import assert from 'node:assert/strict'
import { isoYesterday } from '../lib/feedme/liveDailySales.ts'

// ── isoYesterday: basic regression ───────────────────────────────────────────

// Normal day
assert.equal(isoYesterday('2026-06-12'), '2026-06-11',
  'isoYesterday(2026-06-12) should return 2026-06-11')

// Year boundary
assert.equal(isoYesterday('2026-01-01'), '2025-12-31',
  'isoYesterday(2026-01-01) should return 2025-12-31')

// ── Month boundaries ─────────────────────────────────────────────────────────

// Feb 1 → Jan 31 (non-leap year)
assert.equal(isoYesterday('2025-02-01'), '2025-01-31',
  'isoYesterday(2025-02-01) should return 2025-01-31 (non-leap)')

// Feb 1 → Jan 31 (leap year — 2024 is leap)
assert.equal(isoYesterday('2024-02-01'), '2024-01-31',
  'isoYesterday(2024-02-01) should return 2024-01-31 (leap)')

// Mar 1 → Feb 28 (non-leap)
assert.equal(isoYesterday('2025-03-01'), '2025-02-28',
  'isoYesterday(2025-03-01) should return 2025-02-28 (non-leap)')

// Mar 1 → Feb 29 (leap year)
assert.equal(isoYesterday('2024-03-01'), '2024-02-29',
  'isoYesterday(2024-03-01) should return 2024-02-29 (leap)')

// Apr 1 → Mar 31
assert.equal(isoYesterday('2026-04-01'), '2026-03-31',
  'isoYesterday(2026-04-01) should return 2026-03-31')

// May 1 → Apr 30
assert.equal(isoYesterday('2026-05-01'), '2026-04-30',
  'isoYesterday(2026-05-01) should return 2026-04-30')

// Jun 1 → May 31
assert.equal(isoYesterday('2026-06-01'), '2026-05-31',
  'isoYesterday(2026-06-01) should return 2026-05-31')

// Jul 1 → Jun 30
assert.equal(isoYesterday('2026-07-01'), '2026-06-30',
  'isoYesterday(2026-07-01) should return 2026-06-30')

// Aug 1 → Jul 31
assert.equal(isoYesterday('2026-08-01'), '2026-07-31',
  'isoYesterday(2026-08-01) should return 2026-07-31')

// Sep 1 → Aug 31
assert.equal(isoYesterday('2026-09-01'), '2026-08-31',
  'isoYesterday(2026-09-01) should return 2026-08-31')

// Oct 1 → Sep 30
assert.equal(isoYesterday('2026-10-01'), '2026-09-30',
  'isoYesterday(2026-10-01) should return 2026-09-30')

// Nov 1 → Oct 31
assert.equal(isoYesterday('2026-11-01'), '2026-10-31',
  'isoYesterday(2026-11-01) should return 2026-10-31')

// Dec 1 → Nov 30
assert.equal(isoYesterday('2026-12-01'), '2026-11-30',
  'isoYesterday(2026-12-01) should return 2026-11-30')

// ── Dec 31 → Dec 30 (same year, same month) ──────────────────────────────────
assert.equal(isoYesterday('2026-12-31'), '2026-12-30',
  'isoYesterday(2026-12-31) should return 2026-12-30')

// ── Mid-month ────────────────────────────────────────────────────────────────
assert.equal(isoYesterday('2026-03-15'), '2026-03-14',
  'isoYesterday(2026-03-15) should return 2026-03-14')

// ── Day 10 → Day 9 (no month rollover, but verifies day arithmetic) ──────────
assert.equal(isoYesterday('2025-12-10'), '2025-12-09',
  'isoYesterday(2025-12-10) should return 2025-12-09')

// ── Revenue display logic: null vs 0 ─────────────────────────────────────────
// These test the consumer-side logic that page.tsx would use.
// Yesterday revenue should show "RM 0.00" when value is 0,
// and "—" only when value is null/undefined/unavailable.

function yesterdayLabel(revenueYesterday) {
  if (revenueYesterday === null) return '—'
  return `RM ${revenueYesterday.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Null → "—"
assert.equal(yesterdayLabel(null), '—',
  'null revenue should display as —')

// 0 → "RM 0.00"
assert.equal(yesterdayLabel(0), 'RM 0.00',
  'zero revenue should display as RM 0.00, not —')

// Normal value
assert.equal(yesterdayLabel(2090.15), 'RM 2,090.15',
  'normal revenue should display with formatting')

// Very small value
assert.equal(yesterdayLabel(0.50), 'RM 0.50',
  'small revenue should display correctly')

console.log('✓ All feedme date regression tests passed')
