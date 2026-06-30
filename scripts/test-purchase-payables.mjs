import {
  isPaidPaymentStatus,
  purchaseRowToPayable,
  summarizePurchasePayables,
} from '../lib/payables/purchasePayables.ts'
import {
  reconcilePayablesAfterFetch,
} from '../lib/payables/optimisticPayables.ts'
import { readFileSync } from 'node:fs'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${message}`)
  }
}

const rows = [
  {
    id: 1,
    supplier: 'A',
    name: 'Fish',
    total_price: 100,
    payment_status: 'unpaid',
    date: '2026-06-20',
    note: null,
    created_at: '2026-06-20T00:00:00Z',
  },
  {
    id: 2,
    supplier: 'B',
    name: 'Rice',
    total_price: 50,
    payment_status: 'Paid',
    date: '2026-06-20',
    note: null,
    created_at: '2026-06-20T00:00:00Z',
  },
  {
    id: 3,
    supplier: null,
    name: 'Oil',
    total_price: null,
    payment_status: null,
    date: '2026-06-19',
    note: 'No price yet',
    created_at: '2026-06-19T00:00:00Z',
  },
]

assert(isPaidPaymentStatus('paid'), 'lowercase paid is paid')
assert(isPaidPaymentStatus('Paid'), 'title-case Paid is paid')
assert(isPaidPaymentStatus(' PAID '), 'paid status ignores surrounding whitespace')
assert(!isPaidPaymentStatus('unpaid'), 'unpaid is outstanding')
assert(!isPaidPaymentStatus(null), 'missing status is outstanding')

const payable = purchaseRowToPayable(rows[0])
assert(payable.supplier_name === 'A', 'supplier name is preferred')
assert(payable.original_amount === 100, 'original amount uses total price')
assert(payable.balance === 100, 'unpaid balance equals total')
assert(payable.status === 'outstanding', 'unpaid row maps to outstanding')

const fallbackName = purchaseRowToPayable(rows[2])
assert(fallbackName.supplier_name === 'Oil', 'item name is used when supplier is missing')
assert(fallbackName.balance === 0, 'missing total price safely maps to zero')

const paid = purchaseRowToPayable(rows[1])
assert(paid.paid_amount === 50 && paid.balance === 0, 'paid row has no outstanding balance')

const summary = summarizePurchasePayables(rows, '2026-06-20')
assert(summary.totalBalance === 100, 'paid rows are excluded from total balance')
assert(summary.dueTodayCount === 1, 'only outstanding due-today rows count')

const staleFetch = reconcilePayablesAfterFetch(
  [payable, fallbackName],
  new Set([payable.id]),
)
assert(
  staleFetch.items.every((item) => item.id !== payable.id),
  'stale fetch cannot reinsert an optimistically paid payable',
)
assert(
  staleFetch.pendingPaidIds.has(payable.id),
  'paid id remains pending while server still returns it',
)

const confirmedFetch = reconcilePayablesAfterFetch(
  [fallbackName],
  staleFetch.pendingPaidIds,
)
assert(
  !confirmedFetch.pendingPaidIds.has(payable.id),
  'paid id is released once server stops returning it',
)

const actionsSource = readFileSync('app/payables/actions.ts', 'utf8')
assert(
  actionsSource.includes("const WRITE_ROLES = ['owner', 'manager', 'front_desk'] as const"),
  'front_desk can mark purchase payables paid',
)
assert(
  actionsSource.includes('await requireRole(...WRITE_ROLES)'),
  'mark paid server action enforces the shared write roles',
)
assert(
  actionsSource.includes('const admin = createAdminSupabaseClient()') &&
    actionsSource.includes("await admin\n      .from('purchase_items')"),
  'mark paid uses an admin client after role validation so RLS row windows do not block payment updates',
)

console.log(`Purchase Payables: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
