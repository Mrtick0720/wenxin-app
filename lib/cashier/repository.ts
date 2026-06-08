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
    auditedByStaffUserId: (row.audited_by_staff_user_id as string) ?? null,
    auditedAt: (row.audited_at as string) ?? null,
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
      audited_by_staff_user_id: shift.auditedByStaffUserId,
      audited_at: shift.auditedAt,
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
  if (updates.auditedByStaffUserId !== undefined) dbUpdates.audited_by_staff_user_id = updates.auditedByStaffUserId
  if (updates.auditedAt !== undefined) dbUpdates.audited_at = updates.auditedAt

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
// Transactions — Stubs (pending future phase)
// ═══════════════════════════════════════════════════════════════════

export async function insertTransaction(
  _transaction: Omit<CashierTransaction, 'id' | 'createdAt'>,
): Promise<CashierTransaction> {
  throw new Error('Not yet implemented — cashier_transactions table pending')
}

export async function findTransactionsByShift(
  _shiftId: number,
): Promise<CashierTransaction[]> {
  throw new Error('Not yet implemented — cashier_transactions table pending')
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
