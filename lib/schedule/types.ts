// ── Staff Scheduling Domain Types ──
// Fixed weekly off days, leave requests, public holidays + work invitations.
// The schedule status of any (staff, date) pair is computed by
// resolveScheduleStatus() in ./resolveScheduleStatus.ts.

import type { ShiftType } from '@/lib/attendance/types'

// Resolved status of a single (staff, date) cell, highest-priority wins.
export type ScheduleStatus =
  | 'leave' // approved leave request
  | 'holiday_working' // public holiday, invited to work
  | 'paid_holiday' // public holiday, not invited → paid day off
  | 'working' // normal working day (default or manual working shift)
  | 'off' // fixed weekly off day, or manual off override

export type StatusTone = 'working' | 'leave' | 'off' | 'paid_holiday'

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export type LeaveRequest = {
  id: number
  staffId: string
  staffName?: string
  staffRole?: string
  startDate: string
  endDate: string
  reason: string
  notes: string | null
  status: LeaveStatus
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
}

export type PublicHoliday = {
  id: number
  date: string
  name: string
  isPaid: boolean
}

export type HolidayInvitation = {
  holidayDate: string
  staffId: string
}

// Everything resolveScheduleStatus() needs for one (staff, date) decision.
export type ResolveInput = {
  date: string // YYYY-MM-DD (local calendar date)
  fixedOffWeekday: number | null // 0=Sun … 6=Sat, null = none
  approvedLeave: boolean // an approved leave request covers this date
  holiday: PublicHoliday | null // public holiday on this date, if any
  invitedToHoliday: boolean // invited to work the holiday
  shift: { shiftType: ShiftType; shiftLabel: string } | null // manual override
}

export type ResolvedDay = {
  date: string
  status: ScheduleStatus
  shiftType: ShiftType | null
  shiftLabel: string | null
  holidayName: string | null
  invited: boolean
}

// A roster row for the owner/manager full-team schedule view.
export type RosterDay = ResolvedDay & {
  staffId: string
  staffName: string
  role: string
  fixedOffWeekday: number | null
}
