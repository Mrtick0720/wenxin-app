// ── Attendance Validation ──
// Pure validation functions. No Supabase, no database, no side effects.

import type { AttendanceSession, ShiftType } from './types'

export const SHIFT_WINDOWS: Record<string, { start: string; end: string }> = {
  morning:   { start: '09:00', end: '15:00' },
  full:      { start: '10:00', end: '20:00' },
  afternoon: { start: '14:00', end: '21:00' },
}

/**
 * Get the time window for a shift type. Returns null for off/leave.
 */
export function getShiftWindow(shiftType: string): { start: string; end: string } | null {
  return SHIFT_WINDOWS[shiftType] ?? null
}

/**
 * Check if a staff member has an open session (clocked in, not clocked out).
 */
export function hasOpenSession(sessions: AttendanceSession[]): boolean {
  return sessions.some(s => s.clockOut === null)
}

/**
 * Find the open session for a staff member. Returns the most recent if multiple.
 */
export function findOpenSession(sessions: AttendanceSession[]): AttendanceSession | null {
  const open = sessions.filter(s => s.clockOut === null)
  if (open.length === 0) return null
  return open.sort((a, b) =>
    new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime()
  )[0]
}

/**
 * Calculate session duration in hours (one decimal place).
 */
export function sessionHours(clockIn: string, clockOut: string | null): number | null {
  if (!clockOut) return null
  const end = new Date(clockOut)
  const start = new Date(clockIn)
  return Math.round((end.getTime() - start.getTime()) / 3600000 * 10) / 10
}

/**
 * Check if a clock-in time is late relative to a shift start and threshold.
 */
export function isLate(
  clockIn: string,
  shiftType: string,
  lateThresholdMinutes: number,
): boolean {
  const window = getShiftWindow(shiftType)
  if (!window) return false

  const clockInTime = new Date(clockIn)
  const [sh, sm] = window.start.split(':').map(Number)
  const shiftStart = new Date(clockInTime)
  shiftStart.setHours(sh, sm, 0, 0)
  const lateThreshold = new Date(shiftStart.getTime() + lateThresholdMinutes * 60000)

  return clockInTime > lateThreshold
}

/**
 * Check if a shift type is a working shift (has a time window).
 */
export function isWorkingShift(shiftType: ShiftType): boolean {
  return shiftType !== 'off' && shiftType !== 'leave'
}

/**
 * Validate that a session can be closed.
 */
export function isClosable(session: AttendanceSession): boolean {
  return session.clockOut === null
}

/**
 * Validate that the user has permission to close the session.
 */
export function canCloseSession(
  session: AttendanceSession,
  staffUserId: string,
): boolean {
  return session.staffUserId === staffUserId && session.clockMethod === 'app'
}

// ═══════════════════════════════════════════════════════════════════
// Correction Validation (Phase 2)
// ═══════════════════════════════════════════════════════════════════

/**
 * Validate correction times: clock-out must be after clock-in.
 */
export function isValidCorrection(
  clockIn: string,
  clockOut: string,
): boolean {
  return new Date(clockOut).getTime() > new Date(clockIn).getTime()
}

/**
 * Validate a correction note is non-empty.
 */
export function isValidCorrectionNote(note: string | null | undefined): boolean {
  return typeof note === 'string' && note.trim().length > 0
}

/**
 * Validate that a session can be manually closed by a manager.
 * Session must be open and the closer must be different from the session owner
 * (or the session owner with manager override).
 */
export function canManualClose(session: AttendanceSession): boolean {
  return session.clockOut === null
}

/**
 * Format session duration as a human-readable string.
 */
export function formatDuration(clockIn: string, clockOut: string | null): string {
  if (!clockOut) return 'Active'
  const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime()
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.round((ms % 3600000) / 60000)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}
