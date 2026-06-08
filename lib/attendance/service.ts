// ── Attendance Service Layer ──
// Business logic for clock in/out, session management, and attendance queries.

import {
  createSession,
  closeSession,
  autoCloseOrphanedSession,
  findOpenSession,
  findSessionById,
  findSessionsByDate,
  findSessionsByStaff,
  findTodaySessions,
  findShiftsByDate,
  findShiftByStaffAndDate,
  findLateThreshold,
} from './repository'
import {
  getShiftWindow,
  findOpenSession as findOpenFromList,
  sessionHours,
  isLate,
  isWorkingShift,
  isClosable,
  canCloseSession,
} from './validation'
import type {
  AttendanceSession,
  StaffShift,
  AttendanceStatus,
} from './types'

const DEFAULT_OUTLET_ID = '00000000-0000-0000-0000-000000000001'

// ═══════════════════════════════════════════════════════════════════
// Clock In
// ═══════════════════════════════════════════════════════════════════

export async function clockIn(
  staffUserId: string,
  businessDate?: string,
): Promise<AttendanceSession> {
  const today = businessDate ?? new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()

  // Auto-close any orphaned open session
  await autoCloseOrphanedSession(staffUserId, now)

  // Match to a shift if one exists for today
  const shift = await findShiftByStaffAndDate(staffUserId, today)
  const scheduleId = shift ? shift.id : null

  return createSession({
    staffUserId,
    scheduleId,
    businessDate: today,
    clockIn: now,
    clockMethod: 'app',
  })
}

// ═══════════════════════════════════════════════════════════════════
// Clock Out
// ═══════════════════════════════════════════════════════════════════

export async function clockOut(
  staffUserId: string,
): Promise<AttendanceSession> {
  const openSession = await findOpenSession(staffUserId)
  if (!openSession) {
    throw new Error('No open session found. Clock in first.')
  }
  if (!isClosable(openSession)) {
    throw new Error('Session is already closed.')
  }
  if (!canCloseSession(openSession, staffUserId)) {
    throw new Error('You can only close your own sessions.')
  }

  const now = new Date().toISOString()
  return closeSession(openSession.id, {
    clockOut: now,
    endReason: 'app',
  })
}

// ═══════════════════════════════════════════════════════════════════
// Session Queries
// ═══════════════════════════════════════════════════════════════════

export async function getOpenSession(
  staffUserId: string,
): Promise<AttendanceSession | null> {
  return findOpenSession(staffUserId)
}

export async function getSessionById(
  sessionId: number,
): Promise<AttendanceSession | null> {
  return findSessionById(sessionId)
}

export async function getTodaySessions(): Promise<AttendanceSession[]> {
  return findTodaySessions(DEFAULT_OUTLET_ID)
}

export async function getSessionsByDate(
  businessDate: string,
): Promise<AttendanceSession[]> {
  return findSessionsByDate(businessDate, DEFAULT_OUTLET_ID)
}

export async function getStaffSessions(
  staffUserId: string,
  limit?: number,
): Promise<AttendanceSession[]> {
  return findSessionsByStaff(staffUserId, limit)
}

// ═══════════════════════════════════════════════════════════════════
// Shift Queries
// ═══════════════════════════════════════════════════════════════════

export async function getTodayShifts(): Promise<StaffShift[]> {
  const today = new Date().toISOString().split('T')[0]
  return findShiftsByDate(today)
}

export async function getStaffShift(
  staffUserId: string,
  date?: string,
): Promise<StaffShift | null> {
  const targetDate = date ?? new Date().toISOString().split('T')[0]
  return findShiftByStaffAndDate(staffUserId, targetDate)
}

// ═══════════════════════════════════════════════════════════════════
// Derived Status (Computed at Query Time)
// ═══════════════════════════════════════════════════════════════════

export async function getStaffStatus(
  staffUserId: string,
  shift: StaffShift | null,
  sessions: AttendanceSession[],
): Promise<AttendanceStatus> {
  const hasOpen = sessions.some(s => s.clockOut === null)

  // Has an open session → present
  if (hasOpen) {
    const lateThreshold = await findLateThreshold()
    const openSession = findOpenFromList(sessions)
    if (openSession && shift && isWorkingShift(shift.shiftType)) {
      return isLate(openSession.clockIn, shift.shiftType, lateThreshold)
        ? 'late'
        : 'present'
    }
    return 'present'
  }

  // Has closed sessions
  if (sessions.length > 0) {
    const lateThreshold = await findLateThreshold()
    const hasLateSession = sessions.some(s => {
      if (!shift || !isWorkingShift(shift.shiftType)) return false
      return isLate(s.clockIn, shift.shiftType, lateThreshold)
    })
    return hasLateSession ? 'late' : 'present'
  }

  // No sessions at all
  if (!shift) return 'off'
  if (shift.shiftType === 'leave') return 'on_leave'
  if (shift.shiftType === 'off') return 'off'

  // Has working shift, no session
  const window = getShiftWindow(shift.shiftType)
  if (!window) return 'off'

  const now = new Date()
  const [eh, em] = window.end.split(':').map(Number)
  const shiftEnd = new Date(now)
  shiftEnd.setHours(eh, em, 0, 0)

  return now < shiftEnd ? 'pending' : 'absent'
}

export async function getTodayBoard(): Promise<Array<{
  staffUserId: string
  status: AttendanceStatus
  sessions: AttendanceSession[]
  shift: StaffShift | null
}>> {
  const today = new Date().toISOString().split('T')[0]
  const [allSessions, allShifts] = await Promise.all([
    findSessionsByDate(today, DEFAULT_OUTLET_ID),
    findShiftsByDate(today),
  ])

  // Group sessions by staff
  const sessionMap = new Map<string, AttendanceSession[]>()
  for (const s of allSessions) {
    const existing = sessionMap.get(s.staffUserId) ?? []
    existing.push(s)
    sessionMap.set(s.staffUserId, existing)
  }

  // Build board
  const staffIds = new Set([
    ...sessionMap.keys(),
    ...allShifts.map(s => s.staffUserId),
  ])

  const board: Array<{
    staffUserId: string
    status: AttendanceStatus
    sessions: AttendanceSession[]
    shift: StaffShift | null
  }> = []

  for (const staffUserId of staffIds) {
    const sessions = sessionMap.get(staffUserId) ?? []
    const shift = allShifts.find(s => s.staffUserId === staffUserId) ?? null
    const status = await getStaffStatus(staffUserId, shift, sessions)
    board.push({ staffUserId, status, sessions, shift })
  }

  // Sort: present → late → pending → absent → on_leave → off
  const statusOrder: Record<AttendanceStatus, number> = {
    present: 0, late: 1, pending: 2, absent: 3, on_leave: 4, off: 5,
  }
  board.sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

  return board
}

// ═══════════════════════════════════════════════════════════════════
// Re-exports
// ═══════════════════════════════════════════════════════════════════

export {
  getShiftWindow,
  findOpenSession as findOpenFromList,
  sessionHours,
  isLate,
  isWorkingShift,
  isClosable,
  canCloseSession,
} from './validation'
