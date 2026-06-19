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

export type Payable = {
  id: number
  supplier_name: string
  original_amount: number
  paid_amount: number
  balance: number
  due_date: string | null
  status: string
  notes: string | null
  created_at: string
}

export type PayableInput = {
  supplier_name: string
  original_amount: number
  due_date?: string
  notes?: string
}

export type PaymentInput = {
  amount: number
  method: string
  notes?: string
}

function computeStatus(original: number, paid: number, dueDate: string | null, paymentStatus: string | null = null): string {
  if (paymentStatus === 'Paid' || paymentStatus === 'paid') return 'paid'
  if (paid >= original && original > 0) return 'paid'
  if (paid > 0) return 'partial'
  if (dueDate && dueDate < todayLocalStr()) return 'overdue'
  return 'outstanding'
}

function purchaseToPayable(row: Record<string, unknown>): Payable {
  const total = Number(row.total_price ?? 0)
  const paymentStatus = (row.payment_status as string) ?? 'Unpaid'
  const isPaid = paymentStatus === 'Paid' || paymentStatus === 'paid'
  return {
    id: row.id as number,
    supplier_name: (row.supplier as string) || (row.name as string) || 'Unknown',
    original_amount: total,
    paid_amount: isPaid ? total : 0,
    balance: isPaid ? 0 : total,
    due_date: (row.date as string) ?? null,
    status: isPaid ? 'paid' : computeStatus(total, 0, (row.date as string) ?? null, paymentStatus),
    notes: (row.note as string) ?? null,
    created_at: row.created_at as string,
  }
}

export async function fetchPayablesAction(): Promise<ActionResult<{ payables: Payable[]; canWrite: boolean }>> {
  try {
    const staff = await requireCurrentStaff()
    const canWrite = (WRITE_ROLES as readonly string[]).includes(staff.role)
    const supabase = await createServerSupabaseClient()
    // Query purchase_items for unpaid purchases — same source as Home Payables card
    const { data, error } = await supabase
      .from('purchase_items')
      .select('id,supplier,name,total_price,payment_status,date,note,created_at')
      .in('payment_status', ['Unpaid', 'unpaid'])
      .order('date', { ascending: false })
    if (error) throw error
    return { ok: true, data: { payables: (data ?? []).map(r => purchaseToPayable(r as Record<string, unknown>)), canWrite } }
  } catch (e) { return fail(e) }
}

export async function createPayableAction(input: PayableInput): Promise<ActionResult<{ id: number }>> {
  try {
    await requireRole(...WRITE_ROLES)
    const supabase = await createServerSupabaseClient()
    const status = computeStatus(input.original_amount, 0, input.due_date ?? null)
    const { data, error } = await supabase
      .from('payables')
      .insert({
        supplier_name: input.supplier_name,
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

export async function updatePayableAction(id: number, input: PayableInput): Promise<ActionResult<{ id: number }>> {
  try {
    await requireRole(...WRITE_ROLES)
    const supabase = await createServerSupabaseClient()
    const { data: cur } = await supabase.from('payables').select('paid_amount').eq('id', id).single()
    const paid = Number((cur as { paid_amount: number } | null)?.paid_amount ?? 0)
    const status = computeStatus(input.original_amount, paid, input.due_date ?? null)
    const { error } = await supabase
      .from('payables')
      .update({
        supplier_name: input.supplier_name,
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

export async function recordPayablePaymentAction(id: number, input: PaymentInput): Promise<ActionResult<{ id: number }>> {
  try {
    await requireRole(...WRITE_ROLES)
    const supabase = await createServerSupabaseClient()
    const { data: cur, error: fetchErr } = await supabase
      .from('payables')
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
      .from('payables')
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

export async function deletePayableAction(id: number): Promise<ActionResult<{ id: number }>> {
  try {
    await requireRole('owner')
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.from('payables').delete().eq('id', id)
    if (error) throw error
    return { ok: true, data: { id } }
  } catch (e) { return fail(e) }
}

export async function fetchPayablesSummaryAction(): Promise<ActionResult<{ totalBalance: number; dueTodayCount: number }>> {
  try {
    await requireCurrentStaff()
    const supabase = await createServerSupabaseClient()
    const today = todayLocalStr()
    const { data, error } = await supabase
      .from('purchase_items')
      .select('total_price, date')
      .in('payment_status', ['Unpaid', 'unpaid'])
    if (error) throw error
    const rows = (data ?? []) as { total_price: number | null; date: string }[]
    const totalBalance = rows.reduce((sum, r) => sum + (r.total_price ?? 0), 0)
    const dueTodayCount = rows.filter(r => r.date === today).length
    return { ok: true, data: { totalBalance, dueTodayCount } }
  } catch (e) { return fail(e) }
}
