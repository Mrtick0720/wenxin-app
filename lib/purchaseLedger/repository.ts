// ── Purchase Ledger Repository ──
// Data access for the `purchase_items` ledger. Runs under the caller's RLS
// (anon key + session cookies), so row windows are enforced by the database as
// a backstop. Cost columns are only ever SELECTed when `withCosts` is true.

import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { PurchaseFilters, PurchaseRecord } from './types'

const BASE_COLUMNS =
  'id, date, name, specification, category, unit, quantity, purchaser, receiver, note, purchase_method, payment_status, status, created_by, created_by_name, purchased_by_user_id, purchased_by_name, created_at, checklist_item_id'
const COST_COLUMNS = 'unit_price, total_price, supplier'
const FULL_COLUMNS = `${BASE_COLUMNS}, ${COST_COLUMNS}`

function columns(withCosts: boolean): string {
  return withCosts ? FULL_COLUMNS : BASE_COLUMNS
}

export async function queryRecords(opts: {
  withCosts: boolean
  from?: string
  to?: string
  filters?: PurchaseFilters
}): Promise<PurchaseRecord[]> {
  const supabase = await createServerSupabaseClient()
  let q = supabase.from('purchase_items').select(columns(opts.withCosts))

  if (opts.from) q = q.gte('date', opts.from)
  if (opts.to) q = q.lte('date', opts.to)
  if (opts.filters?.category) q = q.eq('category', opts.filters.category)
  if (opts.filters?.supplier) q = q.ilike('supplier', `%${opts.filters.supplier}%`)
  if (opts.filters?.purchaser) q = q.ilike('purchaser', `%${opts.filters.purchaser}%`)

  q = q.order('date', { ascending: false }).order('id', { ascending: false })

  // Guard against unbounded queries — if no date range is provided (owner view),
  // limit to the last 90 days / 500 rows to keep the initial load fast.
  if (!opts.from && !opts.to) {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    q = q.gte('date', ninetyDaysAgo.toISOString().split('T')[0])
  }
  q = q.limit(500)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as PurchaseRecord[]
}

export async function getRecordById(
  id: number,
  withCosts: boolean,
): Promise<PurchaseRecord | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('purchase_items')
    .select(columns(withCosts))
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as unknown as PurchaseRecord | null
}

export async function insertRecord(
  row: Record<string, unknown>,
  withCosts: boolean,
): Promise<PurchaseRecord> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('purchase_items')
    .insert(row)
    .select(columns(withCosts))
    .single()
  if (error) throw error
  return data as unknown as PurchaseRecord
}

export async function updateRecordRow(
  id: number,
  patch: Record<string, unknown>,
  withCosts: boolean,
): Promise<PurchaseRecord> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('purchase_items')
    .update(patch)
    .eq('id', id)
    .select(columns(withCosts))
    .single()
  if (error) throw error
  return data as unknown as PurchaseRecord
}

export async function deleteRecordRow(id: number): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('purchase_items').delete().eq('id', id)
  if (error) throw error
}
