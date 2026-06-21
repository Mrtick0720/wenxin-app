'use server'

import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { ActionResult, PurchaseRecord } from '@/lib/purchaseLedger/types'

const VERIFY_ROLES = ['owner', 'manager', 'kitchen'] as const

const RECORD_COLUMNS =
  'id, date, name, specification, category, unit, quantity, purchaser, receiver, note, purchase_method, payment_status, status, created_by, created_by_name, purchased_by_user_id, purchased_by_name, created_at, checklist_item_id, verified_by_name, verified_at, received_quantity, rejected_by_name, rejected_at, rejection_reason, unit_price, total_price, supplier'

function fail(error: unknown): ActionResult<never> {
  const message =
    error instanceof Error ? error.message
    : error != null && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error)
  console.error('[verification action]', message, error)
  return { ok: false, error: message }
}

/**
 * Accept a pending verification record.
 * Sets status='verified', records verified_by_name, verified_at, received_quantity.
 */
export async function acceptVerificationAction(
  id: number,
  receivedQuantity: number,
): Promise<ActionResult<PurchaseRecord>> {
  try {
    const staff = await requireRole(...VERIFY_ROLES)
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('purchase_items')
      .update({
        status: 'verified',
        verified_by_name: staff.displayName,
        verified_at: new Date().toISOString(),
        received_quantity: receivedQuantity,
      })
      .eq('id', id)
      .eq('status', 'pending_verification') // guard against double-submit
      .select(RECORD_COLUMNS)
      .single()

    if (error) throw error
    if (!data) return { ok: false, error: 'Record not found or already verified.' }
    return { ok: true, data: data as unknown as PurchaseRecord }
  } catch (error) {
    return fail(error)
  }
}

/**
 * Cancel a pending verification record (mistaken purchase).
 * Deletes the purchase record entirely and restores the checklist item to pending.
 */
export async function cancelPurchaseAction(
  id: number,
): Promise<ActionResult<{ id: number }>> {
  try {
    await requireRole('owner', 'manager')
    const supabase = await createServerSupabaseClient()

    // Fetch checklist_item_id before deleting
    const { data: record, error: fetchErr } = await supabase
      .from('purchase_items')
      .select('id, checklist_item_id, status')
      .eq('id', id)
      .eq('status', 'pending_verification')
      .single()

    if (fetchErr || !record) return { ok: false, error: 'Record not found or already processed.' }

    const { error: delErr } = await supabase
      .from('purchase_items')
      .delete()
      .eq('id', id)
    if (delErr) throw delErr

    if (record.checklist_item_id) {
      await supabase
        .from('purchase_checklist')
        .update({ status: 'pending', purchase_record_id: null, completed_at: null })
        .eq('id', record.checklist_item_id)
    }

    return { ok: true, data: { id } }
  } catch (error) {
    return fail(error)
  }
}

/**
 * Reject a pending verification record.
 * Sets status='rejected', records rejected_by_name, rejected_at, rejection_reason.
 * Restores the linked checklist item to pending so it can be re-purchased.
 */
export async function rejectVerificationAction(
  id: number,
  reason: string,
): Promise<ActionResult<{ id: number }>> {
  try {
    const staff = await requireRole(...VERIFY_ROLES)
    const supabase = await createServerSupabaseClient()

    const { data: updated, error: updateErr } = await supabase
      .from('purchase_items')
      .update({
        status: 'rejected',
        rejected_by_name: staff.displayName,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason.trim() || 'No reason given',
      })
      .eq('id', id)
      .eq('status', 'pending_verification')
      .select('id, checklist_item_id')
      .single()

    if (updateErr) throw updateErr
    if (!updated) return { ok: false, error: 'Record not found or already processed.' }

    // Restore linked checklist item back to pending so it can be re-purchased
    if (updated.checklist_item_id) {
      await supabase
        .from('purchase_checklist')
        .update({ status: 'pending', purchase_record_id: null, completed_at: null })
        .eq('id', updated.checklist_item_id)
    }

    return { ok: true, data: { id: updated.id } }
  } catch (error) {
    return fail(error)
  }
}
