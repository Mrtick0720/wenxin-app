'use server'

import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { ActionResult, PurchaseRecord } from '@/lib/purchaseLedger/types'
import { purchaseRecordColumnsForRole } from '@/lib/purchaseLedger/repository'
import { businessToday } from '@/lib/purchaseLedger/time'
import { projectAcceptedVerification } from '@/lib/purchaseLedger/verification'

const VERIFY_ROLES = ['owner', 'manager', 'kitchen', 'front_desk'] as const

function fail(error: unknown): ActionResult<never> {
  if (error != null && typeof error === 'object' && 'digest' in error) {
    const digest = String((error as { digest: unknown }).digest)
    if (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND')) throw error
  }
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
    const verifiedAt = new Date().toISOString()
    const businessDate = businessToday()

    const { data: existing, error: fetchError } = await supabase
      .from('purchase_items')
      .select(purchaseRecordColumnsForRole(staff.role))
      .eq('id', id)
      .eq('status', 'pending_verification')
      .single()

    if (fetchError || !existing) {
      return { ok: false, error: 'Record not found or already verified.' }
    }
    const existingRecord = existing as unknown as PurchaseRecord

    const { error, count } = await supabase
      .from('purchase_items')
      .update({
        date: businessDate,
        status: 'verified',
        verified_by_name: staff.displayName,
        verified_at: verifiedAt,
        received_quantity: receivedQuantity,
      }, { count: 'exact' })
      .eq('id', id)
      .eq('status', 'pending_verification') // guard against double-submit

    if (error) throw error
    if (count !== 1) return { ok: false, error: 'Record not found or already verified.' }
    return {
      ok: true,
      data: projectAcceptedVerification(existingRecord, {
        businessDate,
        verifiedByName: staff.displayName,
        verifiedAt,
        receivedQuantity,
      }),
    }
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
    await requireRole('owner')
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
 * Rollback a verified (Received) item back to pending_verification (To Verify).
 * Owner only. Clears verification fields so it can be re-verified.
 */
export async function rollbackVerifiedToVerifyAction(
  id: number,
): Promise<ActionResult<{ id: number }>> {
  try {
    await requireRole('owner')
    const supabase = await createServerSupabaseClient()

    const { data: existing, error: fetchErr } = await supabase
      .from('purchase_items')
      .select('id, status')
      .eq('id', id)
      .single()

    if (fetchErr || !existing) return { ok: false, error: 'Record not found.' }
    if (existing.status !== 'verified') return { ok: false, error: 'Item is not in Received status.' }

    const { error: updateErr, count } = await supabase
      .from('purchase_items')
      .update({
        status: 'pending_verification',
        verified_by_name: null,
        verified_at: null,
        received_quantity: null,
      }, { count: 'exact' })
      .eq('id', id)
      .eq('status', 'verified')

    if (updateErr) throw updateErr
    if (count !== 1) return { ok: false, error: 'Failed to roll back item.' }
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
    const rejectedAt = new Date().toISOString()

    const { data: existing, error: fetchErr } = await supabase
      .from('purchase_items')
      .select('id, checklist_item_id')
      .eq('id', id)
      .eq('status', 'pending_verification')
      .single()

    if (fetchErr || !existing) {
      return { ok: false, error: 'Record not found or already processed.' }
    }

    const { error: updateErr, count } = await supabase
      .from('purchase_items')
      .update({
        status: 'rejected',
        rejected_by_name: staff.displayName,
        rejected_at: rejectedAt,
        rejection_reason: reason.trim() || 'No reason given',
      }, { count: 'exact' })
      .eq('id', id)
      .eq('status', 'pending_verification')

    if (updateErr) throw updateErr
    if (count !== 1) return { ok: false, error: 'Record not found or already processed.' }

    // Restore linked checklist item back to pending so it can be re-purchased
    if (existing.checklist_item_id) {
      await supabase
        .from('purchase_checklist')
        .update({ status: 'pending', purchase_record_id: null, completed_at: null })
        .eq('id', existing.checklist_item_id)
    }

    return { ok: true, data: { id: existing.id } }
  } catch (error) {
    return fail(error)
  }
}
