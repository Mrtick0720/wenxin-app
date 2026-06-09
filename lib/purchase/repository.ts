// ── Purchase Repository Layer ──
// Data access for purchase operations. Abstracts Supabase queries.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { PurchaseRequest, PurchaseRequestItem } from './types'

const DEFAULT_OUTLET_ID = '00000000-0000-0000-0000-000000000001'

// ═══════════════════════════════════════════════════════════════════
// Purchase Requests
// ═══════════════════════════════════════════════════════════════════

function mapRequestRow(row: Record<string, unknown>): PurchaseRequest {
  return {
    id: row.id as number,
    outletId: row.outlet_id as string,
    businessDate: row.business_date as string,
    status: row.status as PurchaseRequest['status'],
    urgency: row.urgency as PurchaseRequest['urgency'],
    requestedBy: row.requested_by as string,
    approvedBy: (row.approved_by as string) ?? null,
    approvedAt: (row.approved_at as string) ?? null,
    confirmedBy: (row.confirmed_by as string) ?? null,
    confirmedAt: (row.confirmed_at as string) ?? null,
    rejectionReason: (row.rejection_reason as string) ?? null,
    rejectedBy: (row.rejected_by as string) ?? null,
    rejectedAt: (row.rejected_at as string) ?? null,
    cancelledBy: (row.cancelled_by as string) ?? null,
    cancelledAt: (row.cancelled_at as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function createPurchaseRequest(data: {
  businessDate: string
  urgency: string
  requestedBy: string
  notes?: string | null
}): Promise<PurchaseRequest> {
  const supabase = await createServerSupabaseClient()
  const { data: created, error } = await supabase
    .from('purchase_requests')
    .insert({
      outlet_id: DEFAULT_OUTLET_ID,
      business_date: data.businessDate,
      urgency: data.urgency,
      requested_by: data.requestedBy,
      notes: data.notes ?? null,
      status: 'draft',
    })
    .select('*')
    .single()

  if (error) throw error
  return mapRequestRow(created)
}

// Phase 2.1: this generic updater NO LONGER writes `status` or decision audit
// columns. All status changes go through transitionRequestStatus() (status-guarded,
// single boundary owned by purchaseLifecycleService). This updater handles only
// non-lifecycle fields (urgency, notes) on editable requests.
export async function updatePurchaseRequest(
  requestId: number,
  updates: {
    urgency?: string
    notes?: string | null
  },
): Promise<PurchaseRequest> {
  const supabase = await createServerSupabaseClient()
  const db: Record<string, unknown> = {}
  if (updates.urgency !== undefined) db.urgency = updates.urgency
  if (updates.notes !== undefined) db.notes = updates.notes

  const { data, error } = await supabase
    .from('purchase_requests')
    .update(db)
    .eq('id', requestId)
    .select('*')
    .single()

  if (error) throw error
  return mapRequestRow(data)
}

// Phase 2.1: the ONLY status-mutation path. Conditional on the expected current
// status (optimistic concurrency); returns null if no row matched (caller maps to
// a conflict error). Sets status + the relevant decision audit columns atomically.
export async function transitionRequestStatus(
  requestId: number,
  fromStatus: string,
  patch: {
    status: string
    approvedBy?: string
    approvedAt?: string
    confirmedBy?: string
    confirmedAt?: string
    rejectionReason?: string | null
    rejectedBy?: string
    rejectedAt?: string
    cancelledBy?: string
    cancelledAt?: string
  },
): Promise<PurchaseRequest | null> {
  const supabase = await createServerSupabaseClient()
  const db: Record<string, unknown> = { status: patch.status }
  if (patch.approvedBy !== undefined) db.approved_by = patch.approvedBy
  if (patch.approvedAt !== undefined) db.approved_at = patch.approvedAt
  if (patch.confirmedBy !== undefined) db.confirmed_by = patch.confirmedBy
  if (patch.confirmedAt !== undefined) db.confirmed_at = patch.confirmedAt
  if (patch.rejectionReason !== undefined) db.rejection_reason = patch.rejectionReason
  if (patch.rejectedBy !== undefined) db.rejected_by = patch.rejectedBy
  if (patch.rejectedAt !== undefined) db.rejected_at = patch.rejectedAt
  if (patch.cancelledBy !== undefined) db.cancelled_by = patch.cancelledBy
  if (patch.cancelledAt !== undefined) db.cancelled_at = patch.cancelledAt

  const { data, error } = await supabase
    .from('purchase_requests')
    .update(db)
    .eq('id', requestId)
    .eq('status', fromStatus) // optimistic guard — 0 rows if status changed under us
    .select('*')
    .maybeSingle()

  if (error) throw error
  return data ? mapRequestRow(data) : null
}

// Phase 2.1: approval configuration from restaurant_settings (text values).
export async function getApprovalSettings(): Promise<{ managerLimit: number; allowSelfApprove: boolean }> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('restaurant_settings')
    .select('key, value')
    .in('key', ['purchase.approval.manager_limit', 'purchase.approval.allow_self_approve'])

  const defaults = { managerLimit: 500, allowSelfApprove: true }
  if (error || !data) return defaults

  const map = new Map(data.map((r: { key: string; value: string }) => [r.key, r.value]))
  const limitRaw = map.get('purchase.approval.manager_limit')
  const selfRaw = map.get('purchase.approval.allow_self_approve')
  const parsedLimit = limitRaw != null ? Number(limitRaw) : NaN
  return {
    managerLimit: Number.isFinite(parsedLimit) && parsedLimit >= 0 ? parsedLimit : defaults.managerLimit,
    allowSelfApprove: selfRaw != null ? selfRaw === 'true' : defaults.allowSelfApprove,
  }
}

export async function findPurchaseRequestById(
  requestId: number,
): Promise<PurchaseRequest | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('purchase_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()

  if (error) throw error
  return data ? mapRequestRow(data) : null
}

export async function findPurchaseRequestsByDate(
  businessDate: string,
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<PurchaseRequest[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('purchase_requests')
    .select('*')
    .eq('business_date', businessDate)
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapRequestRow)
}

export async function findPurchaseRequestsByStatus(
  status: string,
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<PurchaseRequest[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('purchase_requests')
    .select('*')
    .eq('status', status)
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapRequestRow)
}

// ═══════════════════════════════════════════════════════════════════
// Purchase Request Items
// ═══════════════════════════════════════════════════════════════════

function mapItemRow(row: Record<string, unknown>): PurchaseRequestItem {
  return {
    id: row.id as number,
    requestId: row.request_id as number,
    itemName: row.item_name as string,
    quantity: Number(row.quantity ?? 0),
    unit: row.unit as string,
    reason: (row.reason as string) ?? null,
    urgency: row.urgency as PurchaseRequestItem['urgency'],
    notes: (row.notes as string) ?? null,
    supplierId: (row.supplier_id as number) ?? null,
    unitPrice: row.unit_price != null ? Number(row.unit_price) : null,
    totalPrice: row.total_price != null ? Number(row.total_price) : null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function addPurchaseItem(data: {
  requestId: number
  itemName: string
  quantity: number
  unit: string
  reason?: string | null
  urgency?: string
  notes?: string | null
  supplierId?: number | null
}): Promise<PurchaseRequestItem> {
  const supabase = await createServerSupabaseClient()
  const { data: created, error } = await supabase
    .from('purchase_request_items')
    .insert({
      request_id: data.requestId,
      item_name: data.itemName,
      quantity: data.quantity,
      unit: data.unit,
      reason: data.reason ?? null,
      urgency: data.urgency ?? 'normal',
      notes: data.notes ?? null,
      supplier_id: data.supplierId ?? null,
      unit_price: null,   // staff cannot set prices
      total_price: null,  // staff cannot set prices
    })
    .select('*')
    .single()

  if (error) throw error
  return mapItemRow(created)
}

export async function updatePurchaseItem(
  itemId: number,
  updates: {
    quantity?: number
    unit?: string
    reason?: string | null
    notes?: string | null
    supplierId?: number | null
    unitPrice?: number | null    // Manager/Owner only
    totalPrice?: number | null   // Manager/Owner only
  },
): Promise<PurchaseRequestItem> {
  const supabase = await createServerSupabaseClient()
  const db: Record<string, unknown> = {}
  if (updates.quantity !== undefined) db.quantity = updates.quantity
  if (updates.unit !== undefined) db.unit = updates.unit
  if (updates.reason !== undefined) db.reason = updates.reason
  if (updates.notes !== undefined) db.notes = updates.notes
  if (updates.supplierId !== undefined) db.supplier_id = updates.supplierId
  if (updates.unitPrice !== undefined) db.unit_price = updates.unitPrice
  if (updates.totalPrice !== undefined) db.total_price = updates.totalPrice

  const { data, error } = await supabase
    .from('purchase_request_items')
    .update(db)
    .eq('id', itemId)
    .select('*')
    .single()

  if (error) throw error
  return mapItemRow(data)
}

export async function findRequestItems(
  requestId: number,
): Promise<PurchaseRequestItem[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('purchase_request_items')
    .select('*')
    .eq('request_id', requestId)
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapItemRow)
}

// ═══════════════════════════════════════════════════════════════════
// Confirmed Purchase Total (for Purchase-to-Sales Ratio KPI)
// ═══════════════════════════════════════════════════════════════════

export async function findConfirmedPurchaseTotal(
  businessDate: string,
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<number> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('purchase_requests')
    .select('id')
    .eq('business_date', businessDate)
    .eq('outlet_id', outletId)
    .in('status', ['confirmed', 'purchased'])

  if (error || !data?.length) return 0

  const requestIds = data.map((r: { id: number }) => r.id)
  const { data: items, error: itemsError } = await supabase
    .from('purchase_request_items')
    .select('total_price')
    .in('request_id', requestIds)

  if (itemsError || !items) return 0

  return items.reduce(
    (sum: number, item: { total_price: number | null }) =>
      sum + (item.total_price ?? 0),
    0,
  )
}
