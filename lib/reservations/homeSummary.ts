// Shared "nearest upcoming reservation" summary for Home cards.
//
// Used by both the owner/manager Home (StatusSummaryGrid count) and the
// front_desk Home (operation card + Next Reservation card). Centralising it
// keeps the horizon, active-status filter, and date math identical everywhere.
//
// All date math is LOCAL (Malaysia UTC+8) via todayLocalStr/addDays — never UTC.

import type { SupabaseClient } from '@supabase/supabase-js'
import { todayLocalStr, addDays } from '@/lib/dateUtils'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Active reservation statuses — pending/confirmed only. completed, cancelled
 *  and no_show are explicitly excluded from every Home reservation figure. */
export const ACTIVE_RESERVATION_STATUSES = ['confirmed', 'pending'] as const

/** Default look-ahead window for the Home cards: today + 30 days. */
export const RESERVATION_HORIZON_DAYS = 30

/** Label for a reservation date relative to today's local date. */
export function reservationDateLabel(dateStr: string, today: string): string {
  if (dateStr === today) return 'Today'
  if (dateStr === addDays(today, 1)) return 'Tomorrow'
  const d = new Date(dateStr + 'T00:00:00')
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export type NextReservationDetail = {
  date: string
  timeStart: string
  timeEnd: string | null
  pax: number
  tableArea: string | null
  status: string
  hasPreorder: boolean
}

export type ReservationSummary = {
  /** Active reservation count on the NEAREST date only — not the future total. */
  count: number
  /** "Today" | "Tomorrow" | "Jul 12" | "No upcoming". */
  label: string
  /** Nearest active date (YYYY-MM-DD), or null when there are none in horizon. */
  date: string | null
  /** Earliest reservation on the nearest date (for the Next Reservation card). */
  next: NextReservationDetail | null
  /** Total pending (unconfirmed) reservations across the whole horizon. */
  pendingCount: number
}

type Row = {
  date: string
  time_start: string
  time_end: string | null
  pax: number
  table_area: string | null
  status: string
  preordered_dishes: string | null
}

export const EMPTY_RESERVATION_SUMMARY: ReservationSummary = {
  count: 0,
  label: 'No upcoming',
  date: null,
  next: null,
  pendingCount: 0,
}

/**
 * Find the nearest upcoming date (today → +horizon) that has active
 * reservations, plus that date's count and its earliest reservation detail.
 * Rows are ordered by date then time, so rows[0] is the earliest reservation on
 * the earliest date.
 */
export async function getReservationSummary(
  supabase: SupabaseClient,
  horizonDays: number = RESERVATION_HORIZON_DAYS,
): Promise<ReservationSummary> {
  const today = todayLocalStr()
  const horizonEnd = addDays(today, horizonDays)
  const { data } = await supabase
    .from('reservations')
    .select('date,time_start,time_end,pax,table_area,status,preordered_dishes')
    .gte('date', today)
    .lte('date', horizonEnd)
    .in('status', ACTIVE_RESERVATION_STATUSES as unknown as string[])
    .order('date', { ascending: true })
    .order('time_start', { ascending: true })

  const rows = (data ?? []) as Row[]
  if (rows.length === 0) return EMPTY_RESERVATION_SUMMARY

  const nearest = rows[0].date
  const onNearest = rows.filter(r => r.date === nearest)
  const first = onNearest[0]
  const pendingCount = rows.filter(r => r.status === 'pending').length

  return {
    count: onNearest.length,
    label: reservationDateLabel(nearest, today),
    date: nearest,
    pendingCount,
    next: {
      date: first.date,
      timeStart: first.time_start,
      timeEnd: first.time_end,
      pax: first.pax,
      tableArea: first.table_area,
      status: first.status,
      hasPreorder: !!(first.preordered_dishes && first.preordered_dishes.trim()),
    },
  }
}
