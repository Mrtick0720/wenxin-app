'use server'

import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import * as svc from '@/lib/purchaseLedger/service'
import type { ActionResult, PurchaseRecord, PurchaseSummary } from '@/lib/purchaseLedger/types'

export type ChecklistEntry = {
  id: number
  name: string
  specification: string | null
  supplier: string | null
  category: string
  unit: string
  quantity: number
  note: string | null
  status: 'pending' | 'done'
  purchase_record_id: number | null
  created_at: string
  completed_at: string | null
  created_by: string | null
  created_by_name: string | null
}

export type ChecklistItemInput = {
  name: string
  specification?: string | null
  supplier?: string | null
  category: string
  unit: string
  quantity: number
  note?: string | null
}

const ROLES = ['owner', 'manager', 'kitchen'] as const
// unit_price omitted until migration 20260617_checklist_unit_price.sql is applied
const SELECT_COLS =
  'id, name, specification, supplier, category, unit, quantity, note, status, purchase_record_id, created_at, completed_at, created_by, created_by_name'

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

export type PurchaseContentData = {
  checklist: ChecklistEntry[]
  pending: PurchaseRecord[]
  records: PurchaseRecord[]
  summary: PurchaseSummary | null
}

/**
 * Combined content fetch for the Purchase page boot: checklist + pending
 * verification + records + summary in a SINGLE round-trip with ONE auth check.
 * Replaces three separate server actions (each with its own requireRole), so
 * page entry no longer pays 3× auth + 3× HTTP overhead. The hero KPI stays
 * separate (slowest, fetched after this resolves).
 */
export async function fetchPurchaseContentAction(): Promise<ActionResult<PurchaseContentData>> {
  try {
    const staff = await requireRole(...ROLES)
    const supabase = await createServerSupabaseClient()

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)

    const [pendingChecklistRes, doneChecklistRes, pending, records, summary] = await Promise.all([
      supabase
        .from('purchase_checklist')
        .select(SELECT_COLS)
        .eq('status', 'pending')
        .order('id', { ascending: false }),
      supabase
        .from('purchase_checklist')
        .select(SELECT_COLS)
        .eq('status', 'done')
        .gte('created_at', sevenDaysAgo)
        .order('completed_at', { ascending: false })
        .limit(30),
      svc.listPendingVerification(),
      svc.listRecords(staff.role, {}),
      svc.getSummary(staff.role),
    ])

    if (pendingChecklistRes.error) throw pendingChecklistRes.error
    if (doneChecklistRes.error) throw doneChecklistRes.error

    const checklist = [
      ...(pendingChecklistRes.data ?? []),
      ...(doneChecklistRes.data ?? []),
    ] as ChecklistEntry[]

    return { ok: true, data: { checklist, pending, records, summary } }
  } catch (error) {
    return fail(error)
  }
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
        .order('id', { ascending: false }),
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
      specification: input.specification?.trim() || null,
      supplier: input.supplier?.trim() || null,
      category: input.category,
      unit: input.unit,
      quantity: input.quantity,
      note: input.note?.trim() || null,
      created_by: staff.id,
      created_by_name: staff.displayName,
    }

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
      specification: input.specification?.trim() || null,
      supplier: input.supplier?.trim() || null,
      category: input.category,
      unit: input.unit,
      quantity: input.quantity,
      note: input.note?.trim() || null,
    }

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
 * Returns the restored checklist entry so the client can reconcile optimistic state.
 */
export async function moveRecordToChecklistAction(
  purchaseRecordId: number,
): Promise<ActionResult<ChecklistEntry>> {
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
      // Revert: delete the purchase record, then reset the checklist item to pending.
      const { error: delErr } = await supabase
        .from('purchase_items')
        .delete()
        .eq('id', purchaseRecordId)
      if (delErr) throw delErr

      const { data: restored, error: resetErr } = await supabase
        .from('purchase_checklist')
        .update({ status: 'pending', purchase_record_id: null, completed_at: null })
        .eq('id', linked.id)
        .select(SELECT_COLS)
        .single()
      if (resetErr) throw resetErr
      if (!restored) return { ok: false, error: 'Failed to restore checklist item.' }

      return { ok: true, data: restored as ChecklistEntry }
    } else {
      // No linked checklist item — copy record data into a new checklist item, then delete record.
      const { data: record, error: fetchErr } = await supabase
        .from('purchase_items')
        .select('name, specification, supplier, category, unit, quantity, note')
        .eq('id', purchaseRecordId)
        .single()
      if (fetchErr || !record) return { ok: false, error: 'Purchase record not found.' }

      const { data: inserted, error: insertErr } = await supabase
        .from('purchase_checklist')
        .insert({
          name: record.name,
          specification: record.specification ?? null,
          supplier: record.supplier ?? null,
          category: record.category,
          unit: record.unit,
          quantity: record.quantity,
          note: record.note ?? null,
        })
        .select(SELECT_COLS)
        .single()
      if (insertErr) throw insertErr

      const { error: delErr } = await supabase
        .from('purchase_items')
        .delete()
        .eq('id', purchaseRecordId)
      if (delErr) throw delErr

      return { ok: true, data: inserted as ChecklistEntry }
    }
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
): Promise<ActionResult<{ purchaseRecordId: number; record: PurchaseRecord }>> {
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
      specification: item.specification ?? null,
      category: item.category,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: completion.unit_price,
      supplier: completion.supplier || item.supplier || null,
      receiver: null,
      remarks: item.note ?? null,
    })

    // Override status to pending_verification and set audit fields.
    // (createRecord sets status='verified' for manual entries; checklist
    // completions enter the verification workflow instead.)
    const { error: updateErr2 } = await supabase
      .from('purchase_items')
      .update({
        status: 'pending_verification',
        checklist_item_id: item.id,
        created_by_name: item.created_by_name ?? staff.displayName,
        purchased_by_user_id: staff.id,
        purchased_by_name: staff.displayName,
      })
      .eq('id', record.id)
    if (updateErr2) throw updateErr2

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

    // Return the record with the updated status — svc.createRecord() returns the
    // INSERT result ('verified') but we immediately UPDATE to 'pending_verification'.
    const updatedRecord = { ...record, status: 'pending_verification' as const, checklist_item_id: item.id }
    return { ok: true, data: { purchaseRecordId: record.id, record: updatedRecord } }
  } catch (error) {
    return fail(error)
  }
}
