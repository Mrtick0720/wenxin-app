// Today's team attendance — derives each staff member's clock state for a
// business day from their attendance sessions + assigned shift. Pure and
// reusable so the Staff → Attendance board (client) and the owner Home glance
// card (ShiftBoardCard) compute identical numbers.
//
// States:
//   in     — has an open session right now (clocked in, not out)
//   out    — clocked in and out already today
//   absent — scheduled to work today but no clock-in
//   leave  — on approved leave today
//   off    — off day, or simply not scheduled (not expected in)

import type { ShiftType } from './types'

export type TeamAttendanceState = 'in' | 'out' | 'absent' | 'leave' | 'off'

export type StaffLite = { id: string; name: string; role: string }
export type SessionLite = { staff_user_id: string; clock_in: string; clock_out: string | null }
export type ShiftLite = { staff_id: string; shift_type: ShiftType }

export type TeamMemberAttendance = {
  id: string
  name: string
  role: string
  state: TeamAttendanceState
  firstIn: string | null   // earliest clock_in ISO today
  lastOut: string | null   // latest clock_out ISO today (null while still in)
  totalMs: number          // summed duration of CLOSED sessions today
}

export type TeamAttendanceSummary = {
  in: number
  out: number
  absent: number
  leave: number
  off: number
  /** Workers expected on shift today (in + out + absent). */
  expected: number
}

export type TeamAttendance = {
  members: TeamMemberAttendance[]
  summary: TeamAttendanceSummary
}

const WORKING_SHIFTS: ShiftType[] = ['morning', 'full_day', 'afternoon']

const STATE_ORDER: Record<TeamAttendanceState, number> = {
  in: 0, out: 1, absent: 2, leave: 3, off: 4,
}

export function computeTeamAttendance(
  staff: StaffLite[],
  sessions: SessionLite[],
  shifts: ShiftLite[],
): TeamAttendance {
  const shiftMap = new Map(shifts.map(s => [s.staff_id, s.shift_type]))
  const byStaff = new Map<string, SessionLite[]>()
  for (const s of sessions) {
    const arr = byStaff.get(s.staff_user_id) ?? []
    arr.push(s)
    byStaff.set(s.staff_user_id, arr)
  }

  const members: TeamMemberAttendance[] = staff
    // Owners aren't shift workers — never show them as "absent" on the board.
    .filter(p => p.role !== 'owner')
    .map(p => {
      const own = (byStaff.get(p.id) ?? []).slice().sort((a, b) => a.clock_in.localeCompare(b.clock_in))
      const shift = shiftMap.get(p.id) ?? null

      if (own.length > 0) {
        const open = own.some(s => s.clock_out === null)
        let totalMs = 0
        let lastOut: string | null = null
        for (const s of own) {
          if (s.clock_out) {
            totalMs += new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()
            if (!lastOut || s.clock_out > lastOut) lastOut = s.clock_out
          }
        }
        return {
          id: p.id, name: p.name, role: p.role,
          state: open ? 'in' : 'out',
          firstIn: own[0].clock_in,
          lastOut: open ? null : lastOut,
          totalMs,
        } as TeamMemberAttendance
      }

      // No sessions today — derive expectation from the assigned shift.
      let state: TeamAttendanceState
      if (shift === 'leave') state = 'leave'
      else if (shift && WORKING_SHIFTS.includes(shift)) state = 'absent'
      else state = 'off' // off day or unscheduled — not expected in
      return { id: p.id, name: p.name, role: p.role, state, firstIn: null, lastOut: null, totalMs: 0 }
    })

  members.sort((a, b) => {
    const o = STATE_ORDER[a.state] - STATE_ORDER[b.state]
    if (o !== 0) return o
    if (a.firstIn && b.firstIn) return a.firstIn.localeCompare(b.firstIn)
    return a.name.localeCompare(b.name)
  })

  const count = (s: TeamAttendanceState) => members.filter(m => m.state === s).length
  const summary: TeamAttendanceSummary = {
    in: count('in'), out: count('out'), absent: count('absent'),
    leave: count('leave'), off: count('off'), expected: 0,
  }
  summary.expected = summary.in + summary.out + summary.absent
  return { members, summary }
}

/** Clock time (HH:MM) in Malaysia time from an ISO timestamp. */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-MY', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuching',
  })
}

/** Worked duration: "7h 30m" / "45m". */
export function formatDurationMs(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.round((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
