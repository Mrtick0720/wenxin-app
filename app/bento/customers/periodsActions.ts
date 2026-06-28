'use server'

// ── Bento subscription periods (package ledger) ──
// Archive the current package as a completed period, then either start a fresh
// period on the same customer (renew) or close the subscription (active=false).
// The active period stays mirrored on bento_customers so the schedule generator
// is unchanged.

import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { todayLocalStr } from '@/lib/dateUtils'

const ROLES = ['owner', 'manager', 'front_desk'] as const

export type SubscriptionPeriod = {
  id: number
  customer_id: number
  period_no: number
  start_date: string | null
  end_date: string | null
  total_portions: number
  used_portions: number
  delivery_frequency: string
  completed_at: string
}

export type PeriodResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(error: unknown): PeriodResult<never> {
  const message =
    error instanceof Error ? error.message
    : error != null && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message)
    : String(error)
  console.error('[subscription period]', message, error)
  return { ok: false, error: message }
}

export async function fetchPeriodsAction(customerId: number): Promise<PeriodResult<SubscriptionPeriod[]>> {
  try {
    await requireRole(...ROLES)
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('bento_subscription_periods')
      .select('*')
      .eq('customer_id', customerId)
      .order('period_no', { ascending: false })
    if (error) throw error
    return { ok: true, data: (data ?? []) as SubscriptionPeriod[] }
  } catch (e) { return fail(e) }
}

/**
 * Archive the customer's current package into the periods ledger, then:
 *  • renew=true  → start a fresh period (new start date + portions, used reset to 0)
 *  • renew=false → close the subscription (active=false)
 */
export async function archivePeriodAction(
  customerId: number,
  opts: { renew: boolean; newStartDate?: string; newTotalPortions?: number },
): Promise<PeriodResult<{ periodNo: number }>> {
  try {
    await requireRole(...ROLES)
    const supabase = await createServerSupabaseClient()

    // select('*') so opening_offset is read when the column exists, and simply
    // comes back undefined on databases where the migration hasn't run yet.
    const { data: cust, error: custErr } = await supabase
      .from('bento_customers')
      .select('*')
      .eq('id', customerId)
      .single()
    if (custErr) throw custErr

    const { count } = await supabase
      .from('bento_subscription_periods')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
    const periodNo = (count ?? 0) + 1

    const { error: insErr } = await supabase.from('bento_subscription_periods').insert({
      customer_id:        customerId,
      period_no:          periodNo,
      start_date:         cust.start_date ?? null,
      end_date:           todayLocalStr(),
      total_portions:     cust.total_portions ?? 0,
      used_portions:      cust.used_portions ?? 0,
      delivery_frequency: cust.delivery_frequency ?? 'daily',
    })
    if (insErr) throw insErr

    const update = opts.renew
      ? {
          start_date:     opts.newStartDate || todayLocalStr(),
          total_portions: opts.newTotalPortions ?? cust.total_portions ?? 0,
          used_portions:  0,
          active:         true,
        }
      : { active: false }

    const { error: updErr } = await supabase.from('bento_customers').update(update).eq('id', customerId)
    if (updErr) throw updErr

    // Carry the just-completed package's overuse into the new package as an
    // opening offset. Best-effort: a separate write so the renewal never fails
    // on databases where the opening_offset column hasn't been added yet.
    if (opts.renew) {
      const prevOffset = (cust as { opening_offset?: number }).opening_offset ?? 0
      const carryOveruse = Math.max(prevOffset + (cust.used_portions ?? 0) - (cust.total_portions ?? 0), 0)
      await supabase.from('bento_customers').update({ opening_offset: carryOveruse }).eq('id', customerId)
    }

    return { ok: true, data: { periodNo } }
  } catch (e) { return fail(e) }
}
