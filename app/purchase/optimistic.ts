import { costRatio, ratioStatus } from '../../lib/purchaseLedger/kpiMath.ts'
import type { PurchaseKpi, PurchaseRecord, PurchaseSummary, RatioPeriod } from '@/lib/purchaseLedger/types'

type Direction = 1 | -1

export type OptimisticChecklistItem = {
  id: number
  name: string
  category: string
  unit: string
  quantity: number
  note: string | null
}

// ── Client mutation ID system ────────────────────────────────────────────────
// Every optimistic mutation gets a unique clientMutationId. When the server
// responds, we reconcile by matching on clientMutationId. This prevents
// duplicate rows when the same mutation is reflected via polling before the
// server response arrives.

let _nextMutationId = 1
export function nextClientMutationId(): number {
  return _nextMutationId++
}

/**
 * Attach a clientMutationId to a record so we can deduplicate later.
 * The id is stored in a non-serialized WeakMap so it never reaches the server.
 */
const mutationIds = new WeakMap<object, number>()

export function setMutationId(record: object, id: number): void {
  mutationIds.set(record, id)
}

export function getMutationId(record: object): number | undefined {
  return mutationIds.get(record)
}

// ── Optimistic record creation ───────────────────────────────────────────────

export function createOptimisticPurchaseRecord({
  item,
  tempId,
  today,
  unitPrice,
  supplier,
}: {
  item: OptimisticChecklistItem
  tempId: number
  today: string
  unitPrice: number
  supplier: string | null
}): PurchaseRecord {
  const total = roundMoney(item.quantity * unitPrice)
  return {
    id: tempId,
    date: today,
    name: item.name,
    specification: null,
    category: item.category,
    unit: item.unit,
    quantity: item.quantity,
    unit_price: unitPrice,
    total_price: total,
    supplier,
    purchaser: null,
    receiver: null,
    note: item.note,
    purchase_method: 'Supplier Delivery',
    payment_status: 'unpaid',
    status: 'pending',
    created_by: null,
    created_by_name: null,
    purchased_by_user_id: null,
    purchased_by_name: null,
    created_at: new Date().toISOString(),
    checklist_item_id: item.id,
  }
}

/**
 * Create an optimistic record from a form submission.
 * Uses a temporary negative ID so it won't clash with server IDs.
 */
export function createOptimisticFromForm(
  form: {
    name: string
    specification: string | null
    category: string
    unit: string
    quantity: number
    unit_price: number | null
    supplier: string | null
    receiver: string | null
    remarks: string | null
  },
  tempId: number,
  today: string,
  showCosts: boolean,
): PurchaseRecord {
  const total = showCosts && form.unit_price != null
    ? roundMoney(form.quantity * form.unit_price)
    : null
  return {
    id: tempId,
    date: today,
    name: form.name,
    specification: form.specification,
    category: form.category,
    unit: form.unit,
    quantity: form.quantity,
    unit_price: showCosts ? (form.unit_price ?? null) : null,
    total_price: total,
    supplier: showCosts ? form.supplier : null,
    purchaser: null,
    receiver: form.receiver,
    note: form.remarks,
    purchase_method: 'Supplier Delivery',
    payment_status: 'unpaid',
    status: 'pending',
    created_by: null,
    created_by_name: null,
    purchased_by_user_id: null,
    purchased_by_name: null,
    created_at: new Date().toISOString(),
  }
}

// ── List manipulation helpers ─────────────────────────────────────────────────

/**
 * Prepend a record to the list, skipping if a record with the same id already
 * exists. Also skips if a record with the same clientMutationId exists (to
 * prevent duplicates when polling returns the same mutation).
 */
export function prependOptimisticRecord<T extends { id: number }>(
  records: T[],
  record: T,
  mutationId?: number,
): T[] {
  // Deduplicate by id
  if (records.some((r) => r.id === record.id)) return records
  // Deduplicate by clientMutationId (for polling reconciliation)
  if (mutationId !== undefined && records.some((r) => getMutationId(r) === mutationId)) return records
  return [record, ...records]
}

/**
 * Replace a temporary record (matched by tempId) with the server-confirmed
 * record. Also removes any record with the same server id to prevent
 * duplicates from polling.
 */
export function reconcileOptimisticRecord<T extends { id: number }>(
  records: T[],
  tempId: number,
  serverRecord: T,
): T[] {
  let placed = false
  const next: T[] = []

  for (const record of records) {
    // Skip the temp record AND any record with the same server id (polling dup)
    if (record.id === tempId || record.id === serverRecord.id) {
      if (!placed) {
        next.push(serverRecord)
        placed = true
      }
      continue
    }
    next.push(record)
  }

  // If not placed (temp record was wiped by polling), check for duplicate
  // server id before prepending — prevents BUG #4 double-add
  if (!placed) {
    if (records.some((r) => r.id === serverRecord.id)) return records
    return [serverRecord, ...records]
  }
  return next
}

/**
 * Remove a record by id (for rollback or deletion).
 */
export function removeOptimisticRecord<T extends { id: number }>(
  records: T[],
  tempId: number,
): T[] {
  return records.filter((record) => record.id !== tempId)
}

/**
 * Update a record in-place by id. Returns a new array.
 */
export function updateRecordInList<T extends { id: number }>(
  records: T[],
  id: number,
  patch: Partial<T>,
): T[] {
  return records.map((r) => (r.id === id ? { ...r, ...patch } : r))
}

// ── Summary / KPI helpers ────────────────────────────────────────────────────

export function applyRecordToSummary(
  summary: PurchaseSummary | null,
  record: Pick<PurchaseRecord, 'date' | 'category'> & { total_price?: number | null },
  direction: Direction,
  today: string,
): PurchaseSummary | null {
  if (!summary) return null

  const delta = (record.total_price ?? 0) * direction
  const inToday = record.date === today
  const inWeek = record.date >= shiftDays(today, -6) && record.date <= today
  const inMonth = record.date.slice(0, 7) === today.slice(0, 7)
  const categoryWindowIncludesRecord = summary.month === null ? inWeek : inMonth

  return {
    today: inToday ? addMoney(summary.today, delta) : summary.today,
    week: inWeek ? addMoney(summary.week, delta) : summary.week,
    month: summary.month !== null && inMonth ? addMoney(summary.month, delta) : summary.month,
    categoryBreakdown: categoryWindowIncludesRecord
      ? applyCategoryDelta(summary.categoryBreakdown, record.category, delta)
      : summary.categoryBreakdown,
  }
}

export function applyRecordToKpi(
  kpi: PurchaseKpi | null,
  record: Pick<PurchaseRecord, 'date'> & { total_price?: number | null },
  direction: Direction,
  today: string,
): PurchaseKpi | null {
  if (!kpi) return null

  const delta = (record.total_price ?? 0) * direction
  const inToday = record.date === today
  const inWeek = record.date >= shiftDays(today, -6) && record.date <= today
  const inMonth = record.date.slice(0, 7) === today.slice(0, 7)

  return {
    ...kpi,
    today: inToday ? applyDeltaToPeriod(kpi.today, delta) : kpi.today,
    week: kpi.week && inWeek ? applyDeltaToPeriod(kpi.week, delta) : kpi.week,
    month: kpi.month && inMonth ? applyDeltaToPeriod(kpi.month, delta) : kpi.month,
  }
}

function applyDeltaToPeriod(period: RatioPeriod, delta: number): RatioPeriod {
  if (period.purchase === null) return period
  const purchase = addMoney(period.purchase, delta)
  const ratio = costRatio(purchase, period.revenue)
  return { ...period, purchase, ratio, status: ratioStatus(ratio) }
}

function applyCategoryDelta(
  breakdown: PurchaseSummary['categoryBreakdown'],
  category: string,
  delta: number,
): PurchaseSummary['categoryBreakdown'] {
  let found = false
  const next = breakdown.map((entry) => {
    if (entry.category !== category) return entry
    found = true
    return { ...entry, total: addMoney(entry.total, delta) }
  })

  if (!found && delta > 0) next.push({ category, total: roundMoney(delta) })
  return next.filter((entry) => entry.total > 0)
}

function addMoney(value: number, delta: number): number {
  return Math.max(0, roundMoney(value + delta))
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function shiftDays(dateStr: string, deltaDays: number): string {
  const date = new Date(dateStr + 'T00:00:00')
  date.setDate(date.getDate() + deltaDays)
  return date.toISOString().slice(0, 10)
}
