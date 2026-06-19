// ── Attendance Domain Types ──
// Approved entities from the Attendance module architecture.
// Session-based model — multiple sessions per staff per day.

export type ShiftType = 'morning' | 'full_day' | 'afternoon' | 'off' | 'leave'

export type StaffShift = {
  id: number
  staffUserId: string
  date: string
  shiftType: ShiftType
  shiftLabel: string
  createdAt: string
  updatedAt: string
}

export type ClockMethod = 'app' | 'manager_manual' | 'owner_correction'

export type EndReason = 'app' | 'auto_closed' | 'manager_manual' | 'owner_correction'

export type AttendanceSession = {
  id: number
  outletId: string
  staffUserId: string
  scheduleId: number | null
  businessDate: string
  clockIn: string
  clockOut: string | null
  clockMethod: ClockMethod
  endReason: EndReason | null
  correctionNote: string | null
  correctedBy: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type AttendanceStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'pending'
  | 'on_leave'
  | 'off'

export type AttendanceAction =
  | 'view_own'
  | 'view_all'
  | 'clock_in'
  | 'clock_out'
  | 'correct'
  | 'manage_shifts'
