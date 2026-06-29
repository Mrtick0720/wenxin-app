// ── Home duty-card attendance state ──
// Derives today's punch state for the Home duty card, shared by every
// non-owner role's Home (front desk, kitchen, manager, cashier, …) so they all
// show the same Clock In / Clock Out behaviour. No clock logic is duplicated —
// this only reads sessions via the attendance repository.

import { findSessionsByStaff } from './repository'

export type HomeAttendanceState =
  | 'not_clocked_in'
  | 'clocked_in'
  | 'clocked_out'
  | 'missing_punch_out'

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-MY', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kuching',
  })
}

export async function getHomeAttendance(
  staffId: string,
  bizToday: string,
): Promise<{ attendance: HomeAttendanceState; sinceLabel: string | null }> {
  const sessions = await findSessionsByStaff(staffId, 10) // newest-first
  const openAny = sessions.find((s) => s.clockOut === null)
  const todaySessions = sessions.filter((s) => s.businessDate === bizToday)

  // An open session from a previous business date is an unresolved punch-out.
  if (openAny && openAny.businessDate !== bizToday) {
    return { attendance: 'missing_punch_out', sinceLabel: null }
  }
  const openToday = todaySessions.find((s) => s.clockOut === null)
  if (openToday) return { attendance: 'clocked_in', sinceLabel: clockTime(openToday.clockIn) }
  if (todaySessions.length > 0) return { attendance: 'clocked_out', sinceLabel: null }
  return { attendance: 'not_clocked_in', sinceLabel: null }
}
