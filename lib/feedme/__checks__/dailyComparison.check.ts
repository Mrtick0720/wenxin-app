// Sanity checks for the data-driven FeedMe daily comparison logic.
//
// Verifies that "today" is ALWAYS the latest date present in the captured
// history (never a hardcoded date), and that yesterday is the previous calendar
// day — present → real comparison, absent → nulls (UI shows "—").
//
// Revenue values below are synthetic test fixtures chosen for easy assertions.
// They are NOT real FeedMe figures and are never shown in the app.
//
// Run (compiles the real modules, then executes):
//   npx tsc lib/feedme/parseDailySales.ts lib/feedme/__checks__/dailyComparison.check.ts \
//     --outDir /tmp/wxcheck --module commonjs --target es2022 \
//     --moduleResolution node --esModuleInterop --skipLibCheck
//   node /tmp/wxcheck/lib/feedme/__checks__/dailyComparison.check.js

import assert from 'node:assert/strict'
import {
  parseDailySales,
  deriveDailyComparison,
  type FeedMeDailySalesResponse,
  type FeedMeDailySalesRow,
} from '../parseDailySales'

function row(date: string, nett: number): FeedMeDailySalesRow {
  return { Date: date, Gross: nett, SC: 0, Nett: nett, Qty: 0, isRollup: false }
}

function compare(rows: FeedMeDailySalesRow[]) {
  const response: FeedMeDailySalesResponse = { rows }
  return deriveDailyComparison(parseDailySales(response))
}

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('FeedMe daily comparison — sanity checks')

// Case 1: only the latest day present → yesterday missing → "—".
check('Case 1: only 2026-06-11 → today=06-11, yesterday missing → —', () => {
  const c = compare([row('2026-06-11', 1318.01)])
  assert.equal(c.currentBusinessDate, '2026-06-11')
  assert.equal(c.previousBusinessDate, '2026-06-10')
  assert.equal(c.todayRevenue, 1318.01)
  assert.equal(c.yesterdayRevenue, null)
  assert.equal(c.revenueDifference, null)
  assert.equal(c.growthPercent, null)
})

// Case 2: previous calendar day present → real comparison.
// Rows passed unsorted to prove the logic sorts before picking "latest".
check('Case 2: 2026-06-10 + 2026-06-11 → today=06-11, yesterday=06-10', () => {
  const c = compare([row('2026-06-11', 1250.0), row('2026-06-10', 1000.0)])
  assert.equal(c.currentBusinessDate, '2026-06-11')
  assert.equal(c.todayRevenue, 1250.0)
  assert.equal(c.yesterdayRevenue, 1000.0)
  assert.equal(c.revenueDifference, 250.0)
  assert.equal(c.growthPercent, 25.0)
})

// Case 3: history rolls forward → newest date auto-becomes "today".
check('Case 3: 2026-06-11 + 2026-06-12 → today=06-12, yesterday=06-11', () => {
  const c = compare([row('2026-06-11', 1250.0), row('2026-06-12', 1375.0)])
  assert.equal(c.currentBusinessDate, '2026-06-12')
  assert.equal(c.previousBusinessDate, '2026-06-11')
  assert.equal(c.todayRevenue, 1375.0)
  assert.equal(c.yesterdayRevenue, 1250.0)
  assert.equal(c.revenueDifference, 125.0)
  assert.equal(c.growthPercent, 10.0)
})

// Bonus: gap in history (latest minus one day absent) still falls back to "—".
check('Case 4: gap (2026-06-09 + 2026-06-11) → yesterday 06-10 absent → —', () => {
  const c = compare([row('2026-06-09', 900.0), row('2026-06-11', 1318.01)])
  assert.equal(c.currentBusinessDate, '2026-06-11')
  assert.equal(c.yesterdayRevenue, null)
  assert.equal(c.growthPercent, null)
})

// Bonus: empty history → everything null.
check('Case 5: empty history → all null', () => {
  const c = compare([])
  assert.equal(c.currentBusinessDate, null)
  assert.equal(c.todayRevenue, null)
  assert.equal(c.yesterdayRevenue, null)
  assert.equal(c.growthPercent, null)
})

console.log(`\nALL CHECKS PASSED (${passed}/${passed})`)
