'use server'

import { requireCurrentStaff, requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { todayLocalStr } from '@/lib/dateUtils'

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(error: unknown): ActionResult<never> {
  const msg = error instanceof Error ? error.message : String(error)
  return { ok: false, error: msg }
}

const WRITE_ROLES = ['owner', 'manager'] as const

export type Receivable = {
  id: number
  customer_name: string
  original_amount: number
  paid_amount: number
  balance: number
  due_date: string | null
  status: string
  notes: string | null
  created_at: string
}

export type ReceivableInput = {
  customer_name: string
  original_amount: number
  due_date?: string
  notes?: string
}

export type PaymentInput = {
  amount: number
  method: string
  notes?: string
}

function computeStatus(original: number, paid: number, dueDate: string | null): string {
  if (paid >= original) return 'paid'
  if (paid > 0) return 'partial'
  if (dueDate && dueDate < todayLocalStr()) return 'overdue'
  return 'outstanding'
}

function toReceivable(row: Record<string, unknown>): Receivable {
  const original = Number(row.original_amount)
  const paid = Number(row.paid_amount)
  return {
    id: row.id as number,
    customer_name: row.customer_name as string,
    original_amount: original,
    paid_amount: paid,
    balance: Math.max(0, original - paid),
    due_date: (row.due_date as string) ?? null,
    status: row.status as string,
    notes: (row.notes as string) ?? null,
    created_at: row.created_at as string,
  }
}

export async function fetchReceivablesAction(): Promise<ActionResult<{ receivables: Receivable[]; canWrite: boolean }>> {
  try {
    const staff = await requireCurrentStaff()
    const canWrite = (WRITE_ROLES as readonly string[]).includes(staff.role)
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('receivables')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false })
    if (error) throw error
    return { ok: true, data: { receivables: (data ?? []).map(r => toReceivable(r as Record<string, unknown>)), canWrite } }
  } catch (e) { return fail(e) }
}

export async function createReceivableAction(input: ReceivableInput): Promise<ActionResult<{ id: number }>> {
  try {
    await requireRole(...WRITE_ROLES)
    const supabase = await createServerSupabaseClient()
    const status = computeStatus(input.original_amount, 0, input.due_date ?? null)
    const { data, error } = await supabase
      .from('receivables')
      .insert({
        customer_name: input.customer_name,
        original_amount: input.original_amount,
        paid_amount: 0,
        due_date: input.due_date ?? null,
        notes: input.notes ?? null,
        status,
      })
      .select('id')
      .single()
    if (error) throw error
    return { ok: true, data: { id: (data as { id: number }).id } }
  } catch (e) { return fail(e) }
}

export async function updateReceivableAction(id: number, input: ReceivableInput): Promise<ActionResult<{ id: number }>> {
  try {
    await requireRole(...WRITE_ROLES)
    const supabase = await createServerSupabaseClient()
    const { data: cur } = await supabase.from('receivables').select('paid_amount').eq('id', id).single()
    const paid = Number((cur as { paid_amount: number } | null)?.paid_amount ?? 0)
    const status = computeStatus(input.original_amount, paid, input.due_date ?? null)
    const { error } = await supabase
      .from('receivables')
      .update({
        customer_name: input.customer_name,
        original_amount: input.original_amount,
        due_date: input.due_date ?? null,
        notes: input.notes ?? null,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) throw error
    return { ok: true, data: { id } }
  } catch (e) { return fail(e) }
}

export async function recordReceivablePaymentAction(id: number, input: PaymentInput): Promise<ActionResult<{ id: number }>> {
  try {
    await requireRole(...WRITE_ROLES)
    const supabase = await createServerSupabaseClient()
    const { data: cur, error: fetchErr } = await supabase
      .from('receivables')
      .select('original_amount, paid_amount, due_date, notes')
      .eq('id', id)
      .single()
    if (fetchErr) throw fetchErr
    const row = cur as { original_amount: number; paid_amount: number; due_date: string | null; notes: string | null }
    const newPaid = Math.min(Number(row.original_amount), Number(row.paid_amount) + input.amount)
    const status = computeStatus(Number(row.original_amount), newPaid, row.due_date)
    const noteAppend = input.notes ? ` | Pmt ${input.method}: ${input.notes}` : ` | Pmt ${input.method}`
    const existingNotes = row.notes ?? ''
    const { error } = await supabase
      .from('receivables')
      .update({
        paid_amount: newPaid,
        status,
        notes: (existingNotes + noteAppend).trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) throw error
    return { ok: true, data: { id } }
  } catch (e) { return fail(e) }
}

export async function deleteReceivableAction(id: number): Promise<ActionResult<{ id: number }>> {
  try {
    await requireRole('owner')
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.from('receivables').delete().eq('id', id)
    if (error) throw error
    return { ok: true, data: { id } }
  } catch (e) { return fail(e) }
}

export async function fetchReceivablesSummaryAction(): Promise<ActionResult<{ totalBalance: number; openCount: number }>> {
  try {
    await requireCurrentStaff()
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('receivables')
      .select('original_amount, paid_amount')
      .neq('status', 'paid')
    if (error) throw error
    const rows = (data ?? []) as { original_amount: number; paid_amount: number }[]
    const totalBalance = rows.reduce((sum, r) => sum + Math.max(0, Number(r.original_amount) - Number(r.paid_amount)), 0)
    return { ok: true, data: { totalBalance, openCount: rows.length } }
  } catch (e) { return fail(e) }
}
