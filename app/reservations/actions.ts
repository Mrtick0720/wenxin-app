'use server'

import { requireRole, requireCurrentStaff } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { todayLocalStr } from '@/lib/dateUtils'

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(error: unknown): ActionResult<never> {
  const message = error instanceof Error ? error.message
    : error != null && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error)
  return { ok: false, error: message }
}

/** Some deployments use 'boss' instead of 'owner'. Normalise both ways. */
const EDIT_ROLES = ['owner', 'boss', 'manager', 'front_desk'] as const
/** Detail editing (date/time/pax/customer/notes) — owner/manager only, not front_desk. */
const EDIT_DETAIL_ROLES = ['owner', 'boss', 'manager'] as const

// ── Types ──────────────────────────────────────────────────────────────────

export type NewReservationInput = {
  customer_name: string
  phone?: string
  date: string
  time_start: string
  time_end?: string
  pax: number
  table_area?: string
  preordered_dishes?: string
  notes?: string
}

export type PublicReservation = {
  id: number
  date: string
  time_start: string
  time_end: string | null
  pax: number
  table_area: string | null
  preordered_dishes: string | null
  status: string
}

export type FullReservation = PublicReservation & {
  customer_name: string
  phone: string | null
  notes: string | null
}

type ReservationRow = FullReservation

// ── Fetch (role-filtered) ─────────────────────────────────────────────────

export async function fetchReservationsAction(
  date: string,
): Promise<ActionResult<{ reservations: ReservationRow[]; canSeePii: boolean }>> {
  try {
    const staff = await requireCurrentStaff()
    const canSee = (EDIT_ROLES as readonly string[]).includes(staff.role)

    const supabase = await createServerSupabaseClient()
    const select = canSee
      ? 'id,customer_name,phone,date,time_start,time_end,pax,table_area,preordered_dishes,notes,status'
      : 'id,date,time_start,time_end,pax,table_area,preordered_dishes,status'

    const { data, error } = await supabase
      .from('reservations')
      .select(select)
      .eq('date', date)
      .order('time_start', { ascending: true })

    if (error) throw error
    return { ok: true, data: { reservations: (data ?? []) as ReservationRow[], canSeePii: canSee } }
  } catch (error) {
    return fail(error)
  }
}

// ── Create ────────────────────────────────────────────────────────────────

export async function createReservationAction(
  input: NewReservationInput,
): Promise<ActionResult<{ id: number }>> {
  try {
    await requireRole(...(EDIT_ROLES as unknown as [string, ...string[]]))
    if (input.date < todayLocalStr()) throw new Error('Reservation date cannot be in the past.')

    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('reservations')
      .insert({
        customer_name: input.customer_name,
        phone: input.phone || null,
        date: input.date,
        time_start: input.time_start,
        time_end: input.time_end || null,
        pax: input.pax,
        table_area: input.table_area || null,
        preordered_dishes: input.preordered_dishes || null,
        notes: input.notes || null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) throw error
    return { ok: true, data: data as { id: number } }
  } catch (error) {
    return fail(error)
  }
}

// ── Update (edit) ────────────────────────────────────────────────────────

export async function updateReservationAction(
  id: number,
  input: NewReservationInput,
): Promise<ActionResult<{ id: number }>> {
  try {
    await requireRole(...(EDIT_DETAIL_ROLES as unknown as [string, ...string[]]))
    if (input.date < todayLocalStr()) throw new Error('Reservation date cannot be in the past.')

    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('reservations')
      .update({
        customer_name: input.customer_name,
        phone: input.phone || null,
        date: input.date,
        time_start: input.time_start,
        time_end: input.time_end || null,
        pax: input.pax,
        table_area: input.table_area || null,
        preordered_dishes: input.preordered_dishes || null,
        notes: input.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error
    return { ok: true, data: { id } }
  } catch (error) {
    return fail(error)
  }
}

// ── Update status ─────────────────────────────────────────────────────────

export async function updateReservationStatusAction(
  id: number,
  status: string,
): Promise<ActionResult<{ id: number; status: string }>> {
  try {
    await requireRole(...(EDIT_ROLES as unknown as [string, ...string[]]))

    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('reservations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id,status')
      .single()

    if (error) throw error
    return { ok: true, data: data as { id: number; status: string } }
  } catch (error) {
    return fail(error)
  }
}

// ── Date markers — which dates have reservations ──────────────────────────

export async function fetchReservationDatesAction(
  from: string,
  to: string,
): Promise<ActionResult<{ dates: string[] }>> {
  try {
    await requireCurrentStaff()
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('reservations')
      .select('date')
      .gte('date', from)
      .lte('date', to)
      .in('status', ['confirmed', 'pending'])

    if (error) throw error
    const dates = [...new Set((data ?? []).map((r: { date: string }) => r.date))]
    return { ok: true, data: { dates } }
  } catch (error) {
    return fail(error)
  }
}

// ── Delete (owner/manager only, permanent) ───────────────────────────────

export async function deleteReservationAction(
  id: number,
): Promise<ActionResult<{ id: number }>> {
  try {
    await requireRole('owner', 'boss', 'manager')

    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('reservations')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { ok: true, data: { id } }
  } catch (error) {
    return fail(error)
  }
}

// ── Count (for Home badge) ────────────────────────────────────────────────

export async function fetchReservationCountAction(): Promise<ActionResult<{ count: number }>> {
  try {
    await requireCurrentStaff()
    const supabase = await createServerSupabaseClient()
    const today = todayLocalStr()
    const { data, error } = await supabase
      .from('reservations')
      .select('id')
      .eq('date', today)
      .in('status', ['confirmed', 'pending'])

    if (error) throw error
    return { ok: true, data: { count: data?.length ?? 0 } }
  } catch (error) {
    return fail(error)
  }
}

// ── Upcoming (next 30 min) — for bell notification ────────────────────────

export async function fetchUpcomingReservationsAction(): Promise<
  ActionResult<{ reservations: ReservationRow[]; canSeePii: boolean; count: number }>
> {
  try {
    const staff = await requireCurrentStaff()
    const canSee = (EDIT_ROLES as readonly string[]).includes(staff.role)
    const today = todayLocalStr()
    const now = new Date()
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const end = new Date(now.getTime() + 30 * 60_000)
    const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`

    const supabase = await createServerSupabaseClient()
    const select = canSee
      ? 'id,customer_name,phone,date,time_start,time_end,pax,table_area,notes,status'
      : 'id,date,time_start,time_end,pax,table_area,status'

    const { data, error } = await supabase
      .from('reservations')
      .select(select)
      .eq('date', today)
      .in('status', ['confirmed', 'pending'])
      .gte('time_start', nowTime)
      .lte('time_start', endTime)
      .order('time_start', { ascending: true })

    if (error) throw error
    const reservations = (data ?? []) as ReservationRow[]
    return { ok: true, data: { reservations, canSeePii: canSee, count: reservations.length } }
  } catch (error) {
    return fail(error)
  }
}
