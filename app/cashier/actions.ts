// app/cashier/actions.ts
'use server'

import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { CashDrawerSession, CashAdjustment, ImportSessionInput, CreateAdjustmentInput } from '@/lib/cashDrawer/types'
import { readRelayDaily } from '@/lib/feedme/relayStore'

const OUTLET_ID = '00000000-0000-0000-0000-000000000001'

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// ── Session helpers ───────────────────────────────────────────────────

function rowToSession(row: Record<string, unknown>): CashDrawerSession {
  return {
    id:                    row.id as number,
    businessDate:          row.business_date as string,
    counter:               row.counter as string,
    outletId:              row.outlet_id as string,
    outletName:            (row.outlet_name as string) ?? null,
    cashierOnDutyStaffId:  (row.cashier_on_duty_staff_id as string) ?? null,
    cashierOnDutyName:     null,  // resolved after fetch via resolveStaffNames
    openTime:              (row.open_time as string) ?? null,
    closeTime:             (row.close_time as string) ?? null,
    openedBy:              (row.opened_by as string) ?? null,
    closedBy:              (row.closed_by as string) ?? null,
    openingFloat:  row.opening_float != null ? Number(row.opening_float) : null,
    closingFloat:  row.closing_float != null ? Number(row.closing_float) : null,
    cashSales:     row.cash_sales != null ? Number(row.cash_sales) : null,
    payIn:         row.pay_in != null ? Number(row.pay_in) : null,
    payOut:        row.pay_out != null ? Number(row.pay_out) : null,
    alipay:        row.alipay != null ? Number(row.alipay) : null,
    duitnow:       row.duitnow != null ? Number(row.duitnow) : null,
    maybankQr:     row.maybank_qr != null ? Number(row.maybank_qr) : null,
    touchngo:      row.touchngo != null ? Number(row.touchngo) : null,
    wechat:        row.wechat != null ? Number(row.wechat) : null,
    source:        row.source as 'manual_import' | 'feedme_relay',
    importedAt:    (row.imported_at as string) ?? null,
    importedBy:    (row.imported_by as string) ?? null,
    createdAt:     row.created_at as string,
  }
}

function rowToAdjustment(row: Record<string, unknown>): CashAdjustment {
  return {
    id:             row.id as number,
    businessDate:   row.business_date as string,
    outletId:       row.outlet_id as string,
    sessionId:      row.session_id != null ? Number(row.session_id) : null,
    adjustmentType: row.adjustment_type as CashAdjustment['adjustmentType'],
    amount:         Number(row.amount),
    quantity:       (row.quantity as number) ?? null,
    referenceNo:    (row.reference_no as string) ?? null,
    receiptUrl:     (row.receipt_url as string) ?? null,
    category:       (row.category as string) ?? null,
    note:           (row.note as string) ?? null,
    status:         row.status as CashAdjustment['status'],
    approvedBy:     (row.approved_by as string) ?? null,
    approvedAt:     (row.approved_at as string) ?? null,
    createdBy:      row.created_by as string,
    createdAt:      row.created_at as string,
    deletedAt:      (row.deleted_at as string) ?? null,
    deletedBy:      (row.deleted_by as string) ?? null,
  }
}

// ── Staff name resolution ─────────────────────────────────────────────

async function resolveStaffNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))]
  if (unique.length === 0) return new Map()
  const admin = createAdminSupabaseClient()
  const { data } = await admin.from('staff_profiles').select('id, display_name').in('id', unique)
  return new Map((data ?? []).map(r => [r.id as string, r.display_name as string]))
}

// ── Session actions ───────────────────────────────────────────────────

export async function fetchCashDrawerSessionsAction(
  businessDate: string,
): Promise<ActionResult<CashDrawerSession[]>> {
  try {
    await requireRole('owner', 'manager')
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('cash_drawer_sessions')
      .select('*')
      .eq('outlet_id', OUTLET_ID)
      .eq('business_date', businessDate)
      .order('counter', { ascending: true })

    if (error) return { ok: false, error: error.message }
    const sessions = (data ?? []).map(rowToSession)
    const names = await resolveStaffNames(sessions.map(s => s.cashierOnDutyStaffId))
    return {
      ok: true,
      data: sessions.map(s => ({
        ...s,
        cashierOnDutyName: s.cashierOnDutyStaffId ? (names.get(s.cashierOnDutyStaffId) ?? null) : null,
      })),
    }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function importCashDrawerSessionAction(
  input: ImportSessionInput,
): Promise<ActionResult<CashDrawerSession>> {
  try {
    const staff = await requireRole('owner')
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('cash_drawer_sessions')
      .insert({
        business_date:              input.businessDate,
        counter:                    input.counter.trim(),
        outlet_id:                  OUTLET_ID,
        outlet_name:                input.outletName?.trim() || null,
        cashier_on_duty_staff_id:   input.cashierOnDutyStaffId ?? null,
        open_time:                  input.openTime || null,
        close_time:                 input.closeTime || null,
        opened_by:                  input.openedBy?.trim() || null,
        closed_by:                  input.closedBy?.trim() || null,
        opening_float:              input.openingFloat,
        closing_float:              input.closingFloat,
        cash_sales:                 input.cashSales,
        pay_in:                     input.payIn,
        pay_out:                    input.payOut,
        alipay:                     input.alipay,
        duitnow:                    input.duitnow,
        maybank_qr:                 input.maybankQr,
        touchngo:                   input.touchngo,
        wechat:                     input.wechat,
        source:                     'manual_import',
        imported_at:                new Date().toISOString(),
        imported_by:                staff.id,
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: `A session for ${input.businessDate} / ${input.counter} already exists` }
      }
      return { ok: false, error: error.message }
    }

    if (!data) return { ok: false, error: 'Session was created but could not be read back' }
    return { ok: true, data: rowToSession(data) }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function deleteCashDrawerSessionAction(
  id: number,
): Promise<ActionResult<void>> {
  try {
    await requireRole('owner')
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('cash_drawer_sessions')
      .delete()
      .eq('id', id)

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: undefined }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

// ── Adjustment actions ────────────────────────────────────────────────

export async function fetchCashAdjustmentsAction(
  businessDate: string,
): Promise<ActionResult<CashAdjustment[]>> {
  try {
    await requireRole('owner', 'manager')
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('cash_adjustments')
      .select('*')
      .eq('outlet_id', OUTLET_ID)
      .eq('business_date', businessDate)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []).map(rowToAdjustment) }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function createCashAdjustmentAction(
  input: CreateAdjustmentInput,
): Promise<ActionResult<CashAdjustment>> {
  try {
    const staff = await requireRole('owner', 'manager')
    if (input.amount <= 0) return { ok: false, error: 'Amount must be greater than zero' }

    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('cash_adjustments')
      .insert({
        business_date:    input.businessDate,
        outlet_id:        OUTLET_ID,
        session_id:       input.sessionId,
        adjustment_type:  input.adjustmentType,
        amount:           input.amount,
        quantity:         input.quantity,
        reference_no:     input.referenceNo?.trim() || null,
        category:         input.category?.trim() || null,
        note:             input.note?.trim() || null,
        status:           'approved',
        approved_by:      staff.id,
        approved_at:      new Date().toISOString(),
        created_by:       staff.id,
      })
      .select('*')
      .single()

    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: 'Adjustment was created but could not be read back' }
    return { ok: true, data: rowToAdjustment(data) }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function fetchLatestClosedSessionAction(
  beforeDate: string,
): Promise<ActionResult<CashDrawerSession | null>> {
  try {
    await requireRole('owner', 'manager')
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('cash_drawer_sessions')
      .select('*')
      .eq('outlet_id', OUTLET_ID)
      .not('close_time', 'is', null)
      .lt('business_date', beforeDate)
      .order('business_date', { ascending: false })
      .order('close_time', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: true, data: null }
    const session = rowToSession(data)
    const names = await resolveStaffNames([session.cashierOnDutyStaffId])
    return {
      ok: true,
      data: {
        ...session,
        cashierOnDutyName: session.cashierOnDutyStaffId ? (names.get(session.cashierOnDutyStaffId) ?? null) : null,
      },
    }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function softDeleteCashAdjustmentAction(
  id: number,
): Promise<ActionResult<void>> {
  try {
    const staff = await requireRole('owner', 'manager')
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('cash_adjustments')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: staff.id,
      })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: undefined }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function fetchActiveStaffAction(): Promise<ActionResult<Array<{ id: string; displayName: string }>>> {
  try {
    await requireRole('owner', 'manager')
    const admin = createAdminSupabaseClient()
    const { data, error } = await admin
      .from('staff_profiles')
      .select('id, display_name')
      .eq('active', true)
      .order('display_name')
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []).map(r => ({ id: r.id as string, displayName: r.display_name as string })) }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function fetchFeedMeRelayAction(): Promise<ActionResult<{
  cashSales: number | null
  payments: Array<{ method: string; amount: number; percentage: number }> | null
}>> {
  try {
    await requireRole('owner', 'manager')
    const relay = await readRelayDaily()
    if (!relay?.value) return { ok: true, data: { cashSales: null, payments: null } }
    const pmts = relay.value.payments
    return {
      ok: true,
      data: {
        cashSales: pmts?.find(p => p.method === 'CASH')?.amount ?? null,
        payments: pmts?.length ? pmts : null,
      },
    }
  } catch {
    return { ok: false, error: 'FeedMe relay unavailable' }
  }
}
