// ── Cashier Repository Layer ──
// Data access for cashier operations. Abstracts Supabase queries.
// Phase 2: Real queries for shifts, payment methods, and adjustments.
// Transactions and settings remain stubs pending future phases.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type {
  CashierShift,
  CashierTransaction,
  CashierAdjustment,
  CashierSettings,
  PaymentMethod,
} from './types'

const DEFAULT_OUTLET_ID = '00000000-0000-0000-0000-000000000001'

// ═══════════════════════════════════════════════════════════════════
// Shifts
// ═══════════════════════════════════════════════════════════════════

function mapShiftRow(row: Record<string, unknown>): CashierShift {
  return {
    id: row.id as number,
    outletId: row.outlet_id as string,
    staffUserId: row.staff_user_id as string,
    businessDate: row.business_date as string,
    openedAt: (row.opened_at as string),
    closedAt: (row.closed_at as string) ?? null,
    status: row.status as CashierShift['status'],
    openingBalance: Number(row.opening_balance ?? 0),
    expectedCashTotal: Number(row.expected_cash_total ?? 0),
    actualCashCount: row.actual_cash_count != null ? Number(row.actual_cash_count) : 0,
    cashDifference: Number(row.cash_difference ?? 0),
    notes: (row.notes as string) ?? null,
    closedByStaffUserId: (row.closed_by_staff_user_id as string) ?? null,
    verifiedByStaffUserId: (row.verified_by_staff_user_id as string) ?? null,
    verifiedAt: (row.verified_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function insertShift(
  shift: Omit<CashierShift, 'id' | 'createdAt' | 'updatedAt' | 'cashDifference'>,
): Promise<CashierShift> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('cashier_shifts')
    .insert({
      outlet_id: shift.outletId || DEFAULT_OUTLET_ID,
      staff_user_id: shift.staffUserId,
      business_date: shift.businessDate,
      opened_at: shift.openedAt,
      closed_at: shift.closedAt,
      status: shift.status,
      opening_balance: shift.openingBalance,
      expected_cash_total: shift.expectedCashTotal,
      actual_cash_count: shift.actualCashCount || null,
      notes: shift.notes,
      closed_by_staff_user_id: shift.closedByStaffUserId,
      verified_by_staff_user_id: shift.verifiedByStaffUserId,
      verified_at: shift.verifiedAt,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapShiftRow(data)
}

export async function updateShift(
  shiftId: number,
  updates: Partial<CashierShift>,
): Promise<CashierShift> {
  const supabase = await createServerSupabaseClient()
  const dbUpdates: Record<string, unknown> = {}
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.closedAt !== undefined) dbUpdates.closed_at = updates.closedAt
  if (updates.expectedCashTotal !== undefined) dbUpdates.expected_cash_total = updates.expectedCashTotal
  if (updates.actualCashCount !== undefined) dbUpdates.actual_cash_count = updates.actualCashCount
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes
  if (updates.closedByStaffUserId !== undefined) dbUpdates.closed_by_staff_user_id = updates.closedByStaffUserId
  if (updates.verifiedByStaffUserId !== undefined) dbUpdates.verified_by_staff_user_id = updates.verifiedByStaffUserId
  if (updates.verifiedAt !== undefined) dbUpdates.verified_at = updates.verifiedAt

  const { data, error } = await supabase
    .from('cashier_shifts')
    .update(dbUpdates)
    .eq('id', shiftId)
    .select('*')
    .single()

  if (error) throw error
  return mapShiftRow(data)
}

export async function findActiveShift(
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<CashierShift | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('cashier_shifts')
    .select('*')
    .eq('outlet_id', outletId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data ? mapShiftRow(data) : null
}

export async function findShiftById(
  shiftId: number,
): Promise<CashierShift | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('cashier_shifts')
    .select('*')
    .eq('id', shiftId)
    .maybeSingle()

  if (error) throw error
  return data ? mapShiftRow(data) : null
}

export async function findShiftsByDate(
  businessDate: string,
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<CashierShift[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('cashier_shifts')
    .select('*')
    .eq('business_date', businessDate)
    .eq('outlet_id', outletId)
    .order('opened_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapShiftRow)
}

// ═══════════════════════════════════════════════════════════════════
// Transactions (Phase 4)
// ═══════════════════════════════════════════════════════════════════

function mapTransactionRow(row: Record<string, unknown>): CashierTransaction {
  return {
    id: row.id as number,
    outletId: row.outlet_id as string,
    shiftId: row.shift_id as number,
    businessDate: row.business_date as string,
    paymentMethod: row.payment_method as CashierTransaction['paymentMethod'],
    amount: Number(row.amount ?? 0),
    transactionCount: row.transaction_count as number,
    source: row.source as CashierTransaction['source'],
    createdBy: (row.created_by as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function insertTransaction(data: {
  shiftId: number
  businessDate: string
  paymentMethod: string
  amount: number
  transactionCount?: number
  source?: string
  createdBy?: string | null
}): Promise<CashierTransaction> {
  const supabase = await createServerSupabaseClient()
  const { data: created, error } = await supabase
    .from('cashier_transactions')
    .insert({
      outlet_id: DEFAULT_OUTLET_ID,
      shift_id: data.shiftId,
      business_date: data.businessDate,
      payment_method: data.paymentMethod,
      amount: data.amount,
      transaction_count: data.transactionCount ?? 1,
      source: data.source ?? 'manual',
      created_by: data.createdBy ?? null,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapTransactionRow(created)
}

export async function findTransactionsByShift(
  shiftId: number,
): Promise<CashierTransaction[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('cashier_transactions')
    .select('*')
    .eq('shift_id', shiftId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapTransactionRow)
}

export async function findTransactionsByDate(
  businessDate: string,
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<CashierTransaction[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('cashier_transactions')
    .select('*')
    .eq('business_date', businessDate)
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapTransactionRow)
}

/**
 * Get total sales amount for a business date.
 * Used by Purchase-to-Sales Ratio KPI as the denominator.
 */
export async function getTodaySalesAmount(
  businessDate: string,
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<number> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('cashier_transactions')
    .select('amount')
    .eq('business_date', businessDate)
    .eq('outlet_id', outletId)

  if (error || !data) return 0
  return data.reduce((sum: number, row: { amount: number }) => sum + (row.amount ?? 0), 0)
}

/**
 * Get total sales amount for a date range.
 */
export async function getSalesAmountByDateRange(
  fromDate: string,
  toDate: string,
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<number> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('cashier_transactions')
    .select('amount')
    .gte('business_date', fromDate)
    .lte('business_date', toDate)
    .eq('outlet_id', outletId)

  if (error || !data) return 0
  return data.reduce((sum: number, row: { amount: number }) => sum + (row.amount ?? 0), 0)
}

// ═══════════════════════════════════════════════════════════════════
// Adjustments
// ═══════════════════════════════════════════════════════════════════

function mapAdjustmentRow(row: Record<string, unknown>): CashierAdjustment {
  return {
    id: row.id as number,
    shiftId: row.shift_id as number,
    type: row.type as CashierAdjustment['type'],
    amount: Number(row.amount ?? 0),
    reason: row.reason as string,
    authorizedByStaffUserId: row.authorized_by_staff_user_id as string,
    createdAt: row.created_at as string,
  }
}

export async function insertAdjustment(
  adjustment: Omit<CashierAdjustment, 'id' | 'createdAt'>,
): Promise<CashierAdjustment> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('cashier_adjustments')
    .insert({
      shift_id: adjustment.shiftId,
      type: adjustment.type,
      amount: adjustment.amount,
      reason: adjustment.reason,
      authorized_by_staff_user_id: adjustment.authorizedByStaffUserId,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapAdjustmentRow(data)
}

export async function findAdjustmentsByShift(
  shiftId: number,
): Promise<CashierAdjustment[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('cashier_adjustments')
    .select('*')
    .eq('shift_id', shiftId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapAdjustmentRow)
}

// ═══════════════════════════════════════════════════════════════════
// Payment Methods
// ═══════════════════════════════════════════════════════════════════

function mapPaymentMethodRow(row: Record<string, unknown>): PaymentMethod {
  return {
    id: row.id as number,
    outletId: row.outlet_id as string,
    name: row.name as string,
    type: row.type as PaymentMethod['type'],
    isActive: row.is_active as boolean,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function findPaymentMethods(
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<PaymentMethod[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('outlet_id', outletId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapPaymentMethodRow)
}

export async function findActivePaymentMethods(
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<PaymentMethod[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('outlet_id', outletId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapPaymentMethodRow)
}

// ═══════════════════════════════════════════════════════════════════
// Settings — Stubs (pending future phase)
// ═══════════════════════════════════════════════════════════════════

export async function findSettings(
  _outletId: string,
): Promise<CashierSettings | null> {
  throw new Error('Not yet implemented — cashier_settings pending')
}

export async function upsertSettings(
  _settings: CashierSettings,
): Promise<CashierSettings> {
  throw new Error('Not yet implemented — cashier_settings pending')
}
