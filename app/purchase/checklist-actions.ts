'use server'

import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import * as svc from '@/lib/purchaseLedger/service'
import type { ActionResult } from '@/lib/purchaseLedger/types'

export type ChecklistEntry = {
  id: number
  name: string
  category: string
  unit: string
  quantity: number
  unit_price: number | null
  note: string | null
  status: 'pending' | 'done'
  purchase_record_id: number | null
  created_at: string
  completed_at: string | null
}

export type ChecklistItemInput = {
  name: string
  category: string
  unit: string
  quantity: number
  unit_price?: number | null
  note?: string | null
}

const ROLES = ['owner', 'manager', 'kitchen'] as const
// unit_price omitted until migration 20260617_checklist_unit_price.sql is applied
const SELECT_COLS =
  'id, name, category, unit, quantity, note, status, purchase_record_id, created_at, completed_at'

function fail(error: unknown): ActionResult<never> {
  const message =
    error instanceof Error
      ? error.message
      : error != null && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error)
  console.error('[checklist action]', message, error)
  return { ok: false, error: message }
}

/** Fetch all checklist items: all pending + last 7 days of completed. */
export async function fetchChecklistAction(): Promise<ActionResult<ChecklistEntry[]>> {
  try {
    await requireRole(...ROLES)
    const supabase = await createServerSupabaseClient()

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)

    const [pendingRes, doneRes] = await Promise.all([
      supabase
        .from('purchase_checklist')
        .select(SELECT_COLS)
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
      supabase
        .from('purchase_checklist')
        .select(SELECT_COLS)
        .eq('status', 'done')
        .gte('created_at', sevenDaysAgo)
        .order('completed_at', { ascending: false })
        .limit(30),
    ])

    if (pendingRes.error) throw pendingRes.error
    if (doneRes.error) throw doneRes.error

    const data = [
      ...(pendingRes.data ?? []),
      ...(doneRes.data ?? []),
    ] as ChecklistEntry[]

    return { ok: true, data }
  } catch (error) {
    return fail(error)
  }
}

/** Add a new checklist item (all roles). */
export async function addChecklistItemAction(
  input: ChecklistItemInput,
): Promise<ActionResult<ChecklistEntry>> {
  try {
    const staff = await requireRole(...ROLES)
    const supabase = await createServerSupabaseClient()

    const insertPayload: Record<string, unknown> = {
      name: input.name.trim(),
      category: input.category,
      unit: input.unit,
      quantity: input.quantity,
      note: input.note?.trim() || null,
      created_by: staff.id,
    }
    if (input.unit_price != null) insertPayload.unit_price = input.unit_price

    const { data, error } = await supabase
      .from('purchase_checklist')
      .insert(insertPayload)
      .select(SELECT_COLS)
      .single()

    if (error) throw error
    return { ok: true, data: data as ChecklistEntry }
  } catch (error) {
    return fail(error)
  }
}

/** Edit a pending checklist item (all roles). */
export async function editChecklistItemAction(
  id: number,
  input: ChecklistItemInput,
): Promise<ActionResult<ChecklistEntry>> {
  try {
    await requireRole(...ROLES)
    const supabase = await createServerSupabaseClient()

    const updatePayload: Record<string, unknown> = {
      name: input.name.trim(),
      category: input.category,
      unit: input.unit,
      quantity: input.quantity,
      note: input.note?.trim() || null,
    }
    if (input.unit_price !== undefined) updatePayload.unit_price = input.unit_price ?? null

    const { data, error } = await supabase
      .from('purchase_checklist')
      .update(updatePayload)
      .eq('id', id)
      .eq('status', 'pending')
      .select(SELECT_COLS)
      .single()

    if (error) throw error
    if (!data) return { ok: false, error: 'Item not found or already completed.' }
    return { ok: true, data: data as ChecklistEntry }
  } catch (error) {
    return fail(error)
  }
}

/** Delete any checklist item (all roles can delete pending; owner/manager can delete done). */
export async function deleteChecklistItemAction(id: number): Promise<ActionResult<true>> {
  try {
    await requireRole(...ROLES)
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('purchase_checklist')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { ok: true, data: true }
  } catch (error) {
    return fail(error)
  }
}

/**
 * Revert a completed checklist item back to pending (owner/manager only).
 * Deletes the linked purchase_items record and resets status.
 */
export async function uncompleteChecklistItemAction(
  id: number,
): Promise<ActionResult<ChecklistEntry>> {
  try {
    await requireRole('owner', 'manager')
    const supabase = await createServerSupabaseClient()

    const { data: item, error: fetchErr } = await supabase
      .from('purchase_checklist')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !item) return { ok: false, error: 'Checklist item not found.' }
    if (item.status !== 'done') return { ok: false, error: 'Item is not completed.' }

    // Delete the linked purchase record if it exists
    if (item.purchase_record_id) {
      await supabase.from('purchase_items').delete().eq('id', item.purchase_record_id)
    }

    const { data, error } = await supabase
      .from('purchase_checklist')
      .update({ status: 'pending', purchase_record_id: null, completed_at: null })
      .eq('id', id)
      .select(SELECT_COLS)
      .single()

    if (error) throw error
    return { ok: true, data: data as ChecklistEntry }
  } catch (error) {
    return fail(error)
  }
}

/**
 * Move a purchase record back to Today's Purchase Checklist (owner/manager only).
 * If the record came from a checklist item, revert it. Otherwise create a new one.
 */
export async function moveRecordToChecklistAction(
  purchaseRecordId: number,
): Promise<ActionResult<true>> {
  try {
    await requireRole('owner', 'manager')
    const supabase = await createServerSupabaseClient()

    // Look for a linked checklist item (reverse of purchase_record_id FK)
    const { data: linkedRows } = await supabase
      .from('purchase_checklist')
      .select('id')
      .eq('purchase_record_id', purchaseRecordId)
      .limit(1)

    const linked = linkedRows?.[0] ?? null

    if (linked) {
      // Revert: delete the purchase record (FK on delete set null handles checklist FK),
      // then reset the checklist item status to pending.
      const { error: delErr } = await supabase
        .from('purchase_items')
        .delete()
        .eq('id', purchaseRecordId)
      if (delErr) throw delErr

      const { error: resetErr } = await supabase
        .from('purchase_checklist')
        .update({ status: 'pending', purchase_record_id: null, completed_at: null })
        .eq('id', linked.id)
      if (resetErr) throw resetErr
    } else {
      // No linked checklist item — copy record data into a new checklist item, then delete record.
      // Omit unit_price: the checklist is a "to-buy" list; price is confirmed at purchase time.
      const { data: record, error: fetchErr } = await supabase
        .from('purchase_items')
        .select('name, category, unit, quantity, note')
        .eq('id', purchaseRecordId)
        .single()
      if (fetchErr || !record) return { ok: false, error: 'Purchase record not found.' }

      const { error: insertErr } = await supabase.from('purchase_checklist').insert({
        name: record.name,
        category: record.category,
        unit: record.unit,
        quantity: record.quantity,
        note: record.note ?? null,
      })
      if (insertErr) throw insertErr

      const { error: delErr } = await supabase
        .from('purchase_items')
        .delete()
        .eq('id', purchaseRecordId)
      if (delErr) throw delErr
    }

    return { ok: true, data: true }
  } catch (error) {
    return fail(error)
  }
}

/**
 * Mark a checklist item as purchased (owner/manager only).
 * Creates a purchase_items record and links it to the checklist entry.
 */
export async function completeChecklistItemAction(
  id: number,
  completion: { unit_price: number; supplier: string | null },
): Promise<ActionResult<{ purchaseRecordId: number }>> {
  try {
    const staff = await requireRole('owner', 'manager')
    const supabase = await createServerSupabaseClient()

    const { data: item, error: fetchErr } = await supabase
      .from('purchase_checklist')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !item) return { ok: false, error: 'Checklist item not found.' }
    if (item.status === 'done') return { ok: false, error: 'Already completed.' }

    // Create purchase record via the existing service (enforces all business rules)
    const record = await svc.createRecord(staff.role, staff.id, staff.displayName, {
      name: item.name,
      specification: null,
      category: item.category,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: completion.unit_price,
      supplier: completion.supplier,
      receiver: null,
      remarks: item.note ?? null,
    })

    // Mark checklist item done
    const { error: updateErr } = await supabase
      .from('purchase_checklist')
      .update({
        status: 'done',
        purchase_record_id: record.id,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateErr) throw updateErr

    return { ok: true, data: { purchaseRecordId: record.id } }
  } catch (error) {
    return fail(error)
  }
}
