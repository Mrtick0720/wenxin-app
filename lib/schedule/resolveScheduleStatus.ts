// ── Schedule status priority engine ──
// Single source of truth (app side) for what a (staff, date) cell shows.
// The SQL function public.team_on_duty(date) in
// 20260629_staff_scheduling.sql mirrors this logic — keep the two in sync.
//
// Priority, highest → lowest:
//   1. Approved leave            → 'leave'
//   2. Public holiday + invited  → 'holiday_working'
//   3. Public holiday (no invite)→ 'paid_holiday'
//   4. Manual shift override     → its type ('off'/'leave' → off/leave, else working)
//   5. Fixed weekly off day      → 'off'
//   6. Otherwise                 → 'working'

import type { ShiftType } from '@/lib/attendance/types'
import type { ResolveInput, ResolvedDay, StatusTone } from './types'

const SHIFT_LABELS: Record<ShiftType, string> = {
  morning: 'Morning',
  full_day: 'Full Day',
  afternoon: 'Afternoon',
  off: 'Off',
  leave: 'Leave',
}

/** Local weekday (0=Sun … 6=Sat) for a YYYY-MM-DD string, matching Postgres dow. */
export function weekdayOf(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay()
}

export function resolveScheduleStatus(input: ResolveInput): ResolvedDay {
  const base = {
    date: input.date,
    shiftType: null as ShiftType | null,
    shiftLabel: null as string | null,
    holidayName: input.holiday?.name ?? null,
    invited: input.invitedToHoliday,
  }

  // 1. Approved leave wins over everything.
  if (input.approvedLeave) {
    return { ...base, status: 'leave' }
  }

  // 2 & 3. Public holiday: invited → work, otherwise paid holiday.
  if (input.holiday) {
    return input.invitedToHoliday
      ? { ...base, status: 'holiday_working' }
      : { ...base, status: 'paid_holiday' }
  }

  // 4. Manual owner/manager shift override for this date.
  if (input.shift) {
    const { shiftType, shiftLabel } = input.shift
    if (shiftType === 'off') return { ...base, status: 'off', shiftType }
    if (shiftType === 'leave') return { ...base, status: 'leave', shiftType }
    return {
      ...base,
      status: 'working',
      shiftType,
      shiftLabel: shiftLabel || null,
    }
  }

  // 5. Fixed weekly off day.
  if (input.fixedOffWeekday !== null && input.fixedOffWeekday === weekdayOf(input.date)) {
    return { ...base, status: 'off' }
  }

  // 6. Normal working day.
  return { ...base, status: 'working' }
}

/** Human label + semantic tone for a resolved cell. */
export function statusDisplay(day: ResolvedDay): { label: string; tone: StatusTone } {
  switch (day.status) {
    case 'leave':
      return { label: 'Leave', tone: 'leave' }
    case 'holiday_working':
      return { label: 'Working · Holiday', tone: 'working' }
    case 'paid_holiday':
      return { label: 'Paid Holiday', tone: 'paid_holiday' }
    case 'off':
      return { label: 'Off', tone: 'off' }
    case 'working':
    default: {
      const label =
        day.shiftLabel ||
        (day.shiftType ? SHIFT_LABELS[day.shiftType] : null) ||
        'Working'
      return { label, tone: 'working' }
    }
  }
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function weekdayName(weekday: number | null): string | null {
  if (weekday === null || weekday < 0 || weekday > 6) return null
  return WEEKDAY_NAMES[weekday]
}

export function weekdayShort(weekday: number | null): string | null {
  if (weekday === null || weekday < 0 || weekday > 6) return null
  return WEEKDAY_SHORT[weekday]
}
