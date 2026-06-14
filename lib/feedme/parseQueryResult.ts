// Parser for the REAL FeedMe `postgres-query` response shape (proof-of-concept).
//
// The live response is an array of result sets. Each set has:
//   columns[] — each column has an opaque `id`, a human `label`, a `schema`
//               (BILL / PAYMENT / RESTAURANT), and a `fieldType` (DIMENSION/METRIC)
//   rows[]    — each row is { isRollup?, value: { [columnId]: cell } }, where the
//               value object is keyed by the opaque column ids; rollup rows also
//               carry value._is_rollup === true
//   dateRange / timeRange / source
//
// This parser resolves columns by label, extracts the Sales (BILL) row and the
// Payment (PAYMENT) breakdown, and returns a normalized daily summary.
//
// NOT wired to the dashboard — used only by the local parse/verify script.

import type { PaymentBreakdown } from './parsePaymentMix'
import type { DailySalesPoint } from './parseDailySales'

export interface FeedMeQueryColumn {
  id: string
  schema?: string
  label?: string
  dataType?: string
  fieldType?: string // 'DIMENSION' | 'METRIC'
  aggregationType?: string | null
  hide?: boolean
}

export interface FeedMeQueryRow {
  isRollup?: boolean
  value: Record<string, unknown>
}

export interface FeedMeQueryResultSet {
  columns: FeedMeQueryColumn[]
  rows: FeedMeQueryRow[]
  dateRange?: { start?: string; end?: string }
  timeRange?: { start?: string; end?: string }
  source?: string
}

export type FeedMeQueryResponse = FeedMeQueryResultSet[]

export interface FeedMeLiveDailySales {
  date: string
  revenue: number
  gross: number
  qty: number
  pax: number
  serviceCharge: number
  rounding: number
  payments: PaymentBreakdown[]
}

// FeedMe returns business-day boundaries in UTC; this restaurant runs on
// Kota Kinabalu time (UTC+8), so shift before taking the calendar date.
const BUSINESS_TZ_OFFSET_HOURS = 8

function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function str(v: unknown): string {
  return v == null ? '' : String(v)
}

function isRollupRow(row: FeedMeQueryRow): boolean {
  return row.isRollup === true || row.value['_is_rollup'] === true
}

function setHasSchema(set: FeedMeQueryResultSet, schema: string): boolean {
  return set.columns.some((c) => c.schema === schema)
}

// Business date (YYYY-MM-DD) for a UTC instant, shifted to the restaurant tz.
function businessDate(iso: string): string {
  if (!iso) return ''
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return ''
  return new Date(ms + BUSINESS_TZ_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10)
}

// Today's date (YYYY-MM-DD) in the restaurant timezone (UTC+8) — used to decide
// whether a parsed result's date is actually "today" vs a completed prior day.
export function businessToday(now: Date = new Date()): string {
  return businessDate(now.toISOString())
}

function labelToId(columns: FeedMeQueryColumn[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const c of columns) if (c.label) map.set(c.label, c.id)
  return map
}

function parseSales(set: FeedMeQueryResultSet): Omit<FeedMeLiveDailySales, 'payments'> {
  const ids = labelToId(set.columns)
  const cell = (row: FeedMeQueryRow, label: string): unknown => {
    const id = ids.get(label)
    return id ? row.value[id] : undefined
  }

  // Prefer the real (non-rollup) row; fall back to the rollup total.
  const row =
    set.rows.find((r) => !isRollupRow(r)) ??
    set.rows.find((r) => isRollupRow(r)) ??
    undefined

  const date =
    businessDate(str(set.dateRange?.start)) ||
    (row ? businessDate(str(cell(row, 'Time'))) : '')

  if (!row) {
    return { date, revenue: 0, gross: 0, qty: 0, pax: 0, serviceCharge: 0, rounding: 0 }
  }

  return {
    date,
    revenue: num(cell(row, 'Nett')),
    gross: num(cell(row, 'Gross')),
    qty: num(cell(row, 'Qty')),
    pax: num(cell(row, 'Pax')),
    serviceCharge: num(cell(row, 'SC')),
    rounding: num(cell(row, 'Rounding')),
  }
}

function parsePayments(set: FeedMeQueryResultSet | undefined): PaymentBreakdown[] {
  if (!set) return []

  const methodCol = set.columns.find(
    (c) => c.schema === 'PAYMENT' && c.fieldType === 'DIMENSION' && c.label === 'Name',
  )
  const amountCol = set.columns.find(
    (c) => c.schema === 'PAYMENT' && c.fieldType === 'METRIC',
  )
  if (!methodCol || !amountCol) return []

  // Sum leaf (non-rollup) rows by method — this excludes ALL rollups, including
  // the grand-total row, and avoids double counting per-method subtotals.
  const totals = new Map<string, number>()
  for (const row of set.rows) {
    if (isRollupRow(row)) continue
    const method = str(row.value[methodCol.id]).trim()
    if (!method) continue
    totals.set(method, (totals.get(method) ?? 0) + num(row.value[amountCol.id]))
  }

  const grand = [...totals.values()].reduce((sum, a) => sum + a, 0)
  return [...totals.entries()]
    .map(([method, amount]) => ({
      method,
      amount: Number(amount.toFixed(2)),
      percentage: grand > 0 ? Number(((amount / grand) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function parseFeedMeQueryResult(response: unknown): FeedMeLiveDailySales {
  const sets: FeedMeQueryResultSet[] = Array.isArray(response)
    ? (response as FeedMeQueryResultSet[])
    : []

  const salesSet = sets.find((s) => setHasSchema(s, 'BILL'))
  if (!salesSet) {
    throw new Error('FeedMe response has no BILL (sales) result set')
  }
  const paymentSet = sets.find((s) => setHasSchema(s, 'PAYMENT'))

  return { ...parseSales(salesSet), payments: parsePayments(paymentSet) }
}

// Multi-row variant for date-range queries (granularity DAY): every non-rollup
// BILL row becomes a DailySalesPoint, dated by its own `Time` cell. Sorted by
// date ascending. Gap-filled days appear with revenue 0.
export function parseFeedMeDailyRows(response: unknown): DailySalesPoint[] {
  const sets: FeedMeQueryResultSet[] = Array.isArray(response)
    ? (response as FeedMeQueryResultSet[])
    : []
  const salesSet = sets.find((s) => setHasSchema(s, 'BILL'))
  if (!salesSet) return []

  const ids = labelToId(salesSet.columns)
  const cell = (row: FeedMeQueryRow, label: string): unknown => {
    const id = ids.get(label)
    return id ? row.value[id] : undefined
  }

  const points: DailySalesPoint[] = []
  for (const row of salesSet.rows) {
    if (isRollupRow(row)) continue
    const date = businessDate(str(cell(row, 'Time')))
    if (!date) continue
    const point: DailySalesPoint = {
      date,
      revenue: num(cell(row, 'Nett')),
      gross: num(cell(row, 'Gross')),
      qty: num(cell(row, 'Qty')),
      serviceCharge: num(cell(row, 'SC')),
    }
    const pax = cell(row, 'Pax')
    if (typeof pax === 'number') point.pax = pax
    points.push(point)
  }
  return points.sort((a, b) => a.date.localeCompare(b.date))
}
