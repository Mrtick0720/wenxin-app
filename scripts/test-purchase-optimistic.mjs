// ── Purchase optimistic UI tests ──
// Runs with: node --experimental-strip-types scripts/test-purchase-optimistic.mjs

import {
  applyRecordToKpi,
  applyRecordToSummary,
  createOptimisticPurchaseRecord,
  prependOptimisticRecord,
  reconcileOptimisticRecord,
  removeOptimisticRecord,
} from '../app/purchase/optimistic.ts'

let passed = 0
let failed = 0
function assert(cond, msg) {
  if (cond) passed++
  else { failed++; console.error(`  FAIL: ${msg}`) }
}
function section(t) { console.log(`\n${t}`) }

section('1. creates a temporary purchase record')
const checklistItem = {
  id: 88,
  name: '菜心',
  category: 'Vegetables',
  unit: 'bag',
  quantity: 1,
  unit_price: null,
  note: 'fresh',
  status: 'pending',
  purchase_record_id: null,
  created_at: '2026-06-17T01:00:00.000Z',
  completed_at: null,
}
const tempRecord = createOptimisticPurchaseRecord({
  item: checklistItem,
  tempId: -1,
  today: '2026-06-17',
  unitPrice: 15,
  supplier: null,
})
assert(tempRecord.id === -1, 'uses temporary id')
assert(tempRecord.total_price === 15, 'computes total')
assert(tempRecord.date === '2026-06-17', 'uses business date')

section('2. prepends, reconciles, and rolls back without duplicates')
const existingRecord = { ...tempRecord, id: 7, name: 'Fish', total_price: 20, category: 'Seafood' }
const withTemp = prependOptimisticRecord([existingRecord], tempRecord)
const withTempAgain = prependOptimisticRecord(withTemp, tempRecord)
assert(withTemp[0].id === -1 && withTemp[1].id === 7, 'prepends immediately')
assert(withTempAgain.filter(r => r.id === -1).length === 1, 'same temp id is idempotent')

const serverRecord = { ...tempRecord, id: 101, purchaser: 'Bruce', created_by: 'u1' }
const reconciled = reconcileOptimisticRecord(withTemp, -1, serverRecord)
assert(reconciled[0].id === 101 && reconciled.length === 2, 'server record replaces temp')
assert(reconcileOptimisticRecord([...withTemp, serverRecord], -1, serverRecord).filter(r => r.id === 101).length === 1, 'prevents duplicate server record')
assert(removeOptimisticRecord(withTemp, -1).every(r => r.id !== -1), 'rollback removes temp')

section('3. summary and KPI update immediately and roll back')
const summary0 = { today: 20, week: 40, month: 100, categoryBreakdown: [{ category: 'Seafood', total: 20 }] }
const summary1 = applyRecordToSummary(summary0, tempRecord, 1, '2026-06-17')
assert(summary1.today === 35 && summary1.week === 55 && summary1.month === 115, 'summary totals increase')
assert(summary1.categoryBreakdown.some(c => c.category === 'Vegetables' && c.total === 15), 'category breakdown includes temp record')
const summary2 = applyRecordToSummary(summary1, tempRecord, -1, '2026-06-17')
assert(summary2.today === 20 && summary2.week === 40 && summary2.month === 100, 'summary rollback restores totals')
assert(!summary2.categoryBreakdown.some(c => c.category === 'Vegetables'), 'category rollback removes zero category')

const kpi0 = {
  target: 30,
  showAmounts: true,
  today: { ratio: 10, status: 'good', revenue: 200, purchase: 20 },
  week: { ratio: 20, status: 'good', revenue: 200, purchase: 40 },
  month: { ratio: 50, status: 'bad', revenue: 200, purchase: 100 },
}
const kpi1 = applyRecordToKpi(kpi0, tempRecord, 1, '2026-06-17')
assert(kpi1.today.purchase === 35 && kpi1.today.ratio === 17.5, 'KPI today purchase and ratio update')
assert(kpi1.week?.purchase === 55 && kpi1.month?.purchase === 115, 'KPI week and month update')

console.log(`\n${'═'.repeat(60)}`)
console.log(`  Passed: ${passed}`)
console.log(`  Failed: ${failed}`)
console.log(`  Total:  ${passed + failed}`)
console.log(`${'═'.repeat(60)}\n`)
if (failed > 0) process.exit(1)
