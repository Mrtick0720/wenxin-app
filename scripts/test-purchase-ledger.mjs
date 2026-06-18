// ── Purchase Ledger Tests ──
// Pure-function tests for permissions, windows, categories, validation, CSV
// and business-date helpers. No database access.

import {
  canViewPurchaseCosts,
  canAddPurchase,
  canDeletePurchase,
  canExportPurchase,
  canViewMonthTotal,
  historyWindowDays,
  canEditRecord,
  sanitizeRecordForRole,
} from '../lib/purchaseLedger/permissions.ts'
import {
  PURCHASE_CATEGORIES,
  categoryColor,
  sortCategories,
  categoryOrderIndex,
} from '../lib/purchaseLedger/categories.ts'
import {
  isValidItemName,
  isValidQuantity,
  isValidUnit,
  isValidPrice,
  round2,
  computeTotal,
} from '../lib/purchaseLedger/validation.ts'
import { recordsToCsv, CSV_HEADERS } from '../lib/purchaseLedger/csv.ts'
import { businessToday, shiftDays, monthStart } from '../lib/purchaseLedger/time.ts'
import {
  costRatio,
  ratioStatus,
  statusLabel,
  COST_RATIO_TARGET,
} from '../lib/purchaseLedger/kpiMath.ts'
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

// ── Cost visibility ──
section('1. canViewPurchaseCosts')
assert(canViewPurchaseCosts('owner'), 'owner sees costs')
assert(canViewPurchaseCosts('manager'), 'manager sees costs')
assert(!canViewPurchaseCosts('kitchen'), 'kitchen does NOT see costs')
assert(!canViewPurchaseCosts('front_desk'), 'front_desk does NOT see costs')

// ── Add ──
section('2. canAddPurchase')
assert(canAddPurchase('owner'), 'owner can add')
assert(canAddPurchase('manager'), 'manager can add')
assert(canAddPurchase('kitchen'), 'kitchen can add')
assert(!canAddPurchase('front_desk'), 'front_desk cannot add')

// ── Delete / Export (owner only) ──
section('3. canDeletePurchase / canExportPurchase')
assert(canDeletePurchase('owner'), 'owner can delete')
assert(!canDeletePurchase('manager'), 'manager cannot delete')
assert(!canDeletePurchase('kitchen'), 'kitchen cannot delete')
assert(canExportPurchase('owner'), 'owner can export')
assert(!canExportPurchase('manager'), 'manager cannot export')

// ── Month total ──
section('4. canViewMonthTotal')
assert(canViewMonthTotal('owner'), 'owner sees month total')
assert(!canViewMonthTotal('manager'), 'manager does NOT see month total')
assert(!canViewMonthTotal('kitchen'), 'kitchen does NOT see month total')

// ── History window ──
section('5. historyWindowDays')
assert(historyWindowDays('owner') === null, 'owner = all history')
assert(historyWindowDays('manager') === 7, 'manager = 7 days')
assert(historyWindowDays('kitchen') === 1, 'kitchen = today only')

// ── Edit rights ──
section('6. canEditRecord')
const today = '2026-06-16'
const own = { created_by: 'u1', date: today }
const other = { created_by: 'u2', date: today }
const yesterdayOwn = { created_by: 'u1', date: '2026-06-15' }
assert(canEditRecord('owner', other, 'u1', today), 'owner edits any')
assert(canEditRecord('manager', other, 'u1', today), 'manager edits any (in window)')
assert(canEditRecord('kitchen', own, 'u1', today), 'kitchen edits own today')
assert(!canEditRecord('kitchen', other, 'u1', today), 'kitchen cannot edit others')
assert(!canEditRecord('kitchen', yesterdayOwn, 'u1', today), 'kitchen cannot edit own from yesterday')

// ── Sanitize ──
section('7. sanitizeRecordForRole')
const full = { id: 1, name: 'Fish', unit_price: 10, total_price: 50, supplier: 'KK', actual_unit_price: 9, quantity: 5 }
const staffView = sanitizeRecordForRole('kitchen', full)
assert(!('unit_price' in staffView), 'kitchen view drops unit_price')
assert(!('total_price' in staffView), 'kitchen view drops total_price')
assert(!('supplier' in staffView), 'kitchen view drops supplier')
assert(!('actual_unit_price' in staffView), 'kitchen view drops actual_unit_price')
assert(staffView.name === 'Fish' && staffView.quantity === 5, 'kitchen view keeps name/quantity')
const ownerView = sanitizeRecordForRole('owner', full)
assert(ownerView.unit_price === 10, 'owner view keeps unit_price')

// ── Categories ──
section('8. categories')
assert(PURCHASE_CATEGORIES.length === 7, '7 categories')
assert(PURCHASE_CATEGORIES.includes('Seafood') && PURCHASE_CATEGORIES.includes('Packaging'), 'spec categories present')
assert(categoryColor('Meat') === '#ef4444', 'meat color')
assert(categoryColor('Unknown') === '#9ca3af', 'unknown color fallback')
assert(categoryOrderIndex('Seafood') === 0, 'seafood first')
assert(categoryOrderIndex('Condiments') === 7, 'legacy category sorts last')
const ordered = sortCategories(['Others', 'Condiments', 'Meat', 'Seafood'])
assert(ordered[0] === 'Seafood' && ordered[1] === 'Meat', 'sort puts standard categories first')
assert(ordered[ordered.length - 1] === 'Condiments', 'legacy sorts after Others')

// ── Validation ──
section('9. validation')
assert(isValidItemName('Chicken'), 'valid name')
assert(!isValidItemName('   '), 'whitespace name invalid')
assert(isValidQuantity(2.3), 'positive qty valid')
assert(!isValidQuantity(0), 'zero qty invalid')
assert(isValidPrice(null), 'null price valid (unset)')
assert(isValidPrice(0), 'zero price valid')
assert(!isValidPrice(-1), 'negative price invalid')
assert(round2(2.3 * 14) === 32.2, 'round2 fixes float drift (2.3*14)')
assert(computeTotal(2.3, 14) === 32.2, 'computeTotal rounds')
assert(computeTotal(5, null) === null, 'computeTotal null when no price')

// ── CSV ──
section('10. CSV')
assert(CSV_HEADERS.length === 12, '12 export columns')
const csv = recordsToCsv([
  { date: '2026-06-16', name: 'Fish, fresh', specification: '500g', quantity: 2, unit: 'kg', unit_price: 10, total_price: 20, category: 'Seafood', supplier: 'KK "Best"', purchaser: 'Bruce', receiver: null, note: 'line1\nline2' },
])
assert(csv.charCodeAt(0) === 0xfeff, 'CSV starts with UTF-8 BOM')
assert(csv.includes('"Fish, fresh"'), 'comma value quoted')
assert(csv.includes('"KK ""Best"""'), 'embedded quotes doubled')
assert(csv.includes('"line1\nline2"'), 'newline value quoted')
assert(csv.split('\r\n').length === 2, 'header + 1 row, CRLF')

// ── Time ──
section('11. time helpers')
assert(/^\d{4}-\d{2}-\d{2}$/.test(businessToday()), 'businessToday is YYYY-MM-DD')
assert(shiftDays('2026-06-16', -6) === '2026-06-10', 'shiftDays -6')
assert(shiftDays('2026-03-01', -1) === '2026-02-28', 'shiftDays crosses month')
assert(monthStart('2026-06-16') === '2026-06-01', 'monthStart')

// ── Cost Ratio KPI math ──
section('12. costRatio')
assert(costRatio(500, 2000) === 25, '500/2000 = 25%')
assert(costRatio(0, 2000) === 0, '0 purchase = 0%')
assert(costRatio(700, 2000) === 35, '700/2000 = 35%')
assert(costRatio(100, 0) === null, 'zero revenue → null (no division)')
assert(costRatio(100, null) === null, 'null revenue → null')
assert(costRatio(null, 2000) === 0, 'null purchase treated as 0')
assert(costRatio(333, 1000) === 33.3, 'rounds to 1 decimal')

section('13. ratioStatus thresholds')
assert(ratioStatus(25) === 'good', '25% good')
assert(ratioStatus(30) === 'good', '30% good (≤30)')
assert(ratioStatus(32) === 'warning', '32% warning')
assert(ratioStatus(35) === 'warning', '35% warning (≤35)')
assert(ratioStatus(40) === 'bad', '40% bad')
assert(ratioStatus(null) === 'na', 'null → na')

section('14. KPI labels + target')
assert(COST_RATIO_TARGET === 30, 'target is 30%')
assert(statusLabel('good') === 'Good', 'good label')
assert(statusLabel('na') === 'No data', 'na label')

// ── Purchase checklist optimistic completion ──
section('15. checklist optimistic completion')
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
assert(tempRecord.id === -1, 'optimistic record uses temporary id')
assert(tempRecord.total_price === 15, 'optimistic record computes total')
assert(tempRecord.date === '2026-06-17', 'optimistic record uses business date')

const existingRecord = { ...tempRecord, id: 7, name: 'Fish', total_price: 20, category: 'Seafood' }
const withTemp = prependOptimisticRecord([existingRecord], tempRecord)
const withTempAgain = prependOptimisticRecord(withTemp, tempRecord)
assert(withTemp[0].id === -1 && withTemp[1].id === 7, 'optimistic record is prepended immediately')
assert(withTempAgain.filter(r => r.id === -1).length === 1, 'prepending same temp id is idempotent')

const serverRecord = { ...tempRecord, id: 101, purchaser: 'Bruce', created_by: 'u1' }
const reconciled = reconcileOptimisticRecord(withTemp, -1, serverRecord)
assert(reconciled[0].id === 101 && reconciled.length === 2, 'server record replaces temp record')
assert(reconcileOptimisticRecord([...withTemp, serverRecord], -1, serverRecord).filter(r => r.id === 101).length === 1, 'reconcile prevents duplicate server records')
assert(removeOptimisticRecord(withTemp, -1).every(r => r.id !== -1), 'rollback removes temp record')

const summary0 = { today: 20, week: 40, month: 100, categoryBreakdown: [{ category: 'Seafood', total: 20 }] }
const summary1 = applyRecordToSummary(summary0, tempRecord, 1, '2026-06-17')
assert(summary1.today === 35 && summary1.week === 55 && summary1.month === 115, 'summary totals increase immediately')
assert(summary1.categoryBreakdown.some(c => c.category === 'Vegetables' && c.total === 15), 'category breakdown includes optimistic record')
const summary2 = applyRecordToSummary(summary1, tempRecord, -1, '2026-06-17')
assert(summary2.today === 20 && summary2.week === 40 && summary2.month === 100, 'summary rollback restores totals')
assert(!summary2.categoryBreakdown.some(c => c.category === 'Vegetables'), 'category breakdown rollback removes zero category')

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
