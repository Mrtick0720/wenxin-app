'use server'

import { requireCurrentStaff, requireRole } from '@/lib/auth/currentStaff'
import {
  purchaseRowToPayable,
  summarizePurchasePayables,
  type PayableProjection,
  type PurchasePayableRow,
} from '@/lib/payables/purchasePayables'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { todayLocalStr } from '@/lib/dateUtils'

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(error: unknown): ActionResult<never> {
  const message =
    error instanceof Error
      ? error.message
      : error != null && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error)
  return { ok: false, error: message }
}

const WRITE_ROLES = ['owner', 'manager'] as const
const PURCHASE_PAYABLE_COLUMNS =
  'id,supplier,name,total_price,payment_status,date,note,created_at'

export type Payable = PayableProjection

async function fetchOutstandingPurchaseRows(): Promise<PurchasePayableRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('purchase_items')
    .select(PURCHASE_PAYABLE_COLUMNS)
    .in('payment_status', ['Unpaid', 'unpaid'])
    .order('date', { ascending: false })
    .order('id', { ascending: false })

  if (error) throw error
  return (data ?? []) as PurchasePayableRow[]
}

export async function fetchPayablesAction(): Promise<
  ActionResult<{ payables: Payable[]; canWrite: boolean }>
> {
  try {
    const staff = await requireCurrentStaff()
    const canWrite = (WRITE_ROLES as readonly string[]).includes(staff.role)
    const rows = await fetchOutstandingPurchaseRows()
    return {
      ok: true,
      data: {
        payables: rows.map(purchaseRowToPayable),
        canWrite,
      },
    }
  } catch (error) {
    return fail(error)
  }
}

export async function markPurchasePaidAction(
  id: number,
): Promise<ActionResult<{ id: number }>> {
  try {
    await requireRole(...WRITE_ROLES)
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('purchase_items')
      .update({ payment_status: 'paid' })
      .eq('id', id)
      .select('id')
      .single()

    if (error) throw error
    return { ok: true, data: { id: Number(data.id) } }
  } catch (error) {
    return fail(error)
  }
}

export async function fetchPayablesSummaryAction(): Promise<
  ActionResult<{ totalBalance: number; dueTodayCount: number }>
> {
  try {
    await requireCurrentStaff()
    const rows = await fetchOutstandingPurchaseRows()
    return {
      ok: true,
      data: summarizePurchasePayables(rows, todayLocalStr()),
    }
  } catch (error) {
    return fail(error)
  }
}
