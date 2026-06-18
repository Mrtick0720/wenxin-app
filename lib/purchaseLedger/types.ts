// ── Purchase Ledger Domain Types ──
// A flat procurement record system on top of the existing `purchase_items`
// table. Independent from the (dead) purchase_requests / request-approval system.
//
// Field shape mirrors the database row (snake_case) so the UI can consume rows
// directly. Cost fields (unit_price, total_price, supplier) are OMITTED — not
// just nulled — for staff (kitchen) so they never reach staff devices.

import type { RatioStatus } from './kpiMath'

/** The full record as seen by Owner / Manager (cost fields present). */
export type PurchaseRecord = {
  id: number
  date: string
  name: string
  specification: string | null
  category: string
  unit: string
  quantity: number
  unit_price: number | null
  total_price: number | null
  supplier: string | null
  purchaser: string | null
  receiver: string | null
  note: string | null
  purchase_method: string | null
  payment_status: string | null
  status: string
  created_by: string | null
  created_by_name: string | null
  purchased_by_user_id: string | null
  purchased_by_name: string | null
  created_at: string | null
  checklist_item_id?: number | null
}

/** The record as served to staff (kitchen) — cost columns are absent. */
export type StaffPurchaseRecord = Omit<
  PurchaseRecord,
  'unit_price' | 'total_price' | 'supplier'
>

/** Either shape, for code that handles both roles. */
export type AnyPurchaseRecord = PurchaseRecord | StaffPurchaseRecord

/** Input for creating/updating a record from the client. */
export type PurchaseRecordInput = {
  date?: string
  name: string
  specification?: string | null
  category: string
  unit: string
  quantity: number
  unit_price?: number | null
  supplier?: string | null
  purchaser?: string | null
  receiver?: string | null
  remarks?: string | null
  purchase_method?: string | null
  payment_status?: string | null
}

/** Search / filter criteria (applied within the role's allowed window). */
export type PurchaseFilters = {
  from?: string
  to?: string
  category?: string
  supplier?: string
  purchaser?: string
}

export type CategoryTotal = { category: string; total: number }

/** Dashboard summary. Null is returned for roles that cannot view costs. */
export type PurchaseSummary = {
  today: number
  week: number
  month: number | null // null when the role may not see the month total (manager)
  categoryBreakdown: CategoryTotal[]
}

/** Result wrapper returned by server actions for graceful client handling. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// ── Purchase Cost Ratio KPI ──
// `revenue`/`purchase` are null for roles that may not see amounts (staff);
// `ratio` (percent) + `status` are always present so staff can see the benchmark.
export type RatioPeriod = {
  ratio: number | null
  status: RatioStatus
  revenue: number | null
  purchase: number | null
}

export type PurchaseKpi = {
  target: number
  showAmounts: boolean
  today: RatioPeriod
  week: RatioPeriod | null
  month: RatioPeriod | null
}
