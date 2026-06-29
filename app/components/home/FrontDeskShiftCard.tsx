// Shared Home duty card for every non-owner role (front desk, kitchen,
// manager, cashier, …).
//
// Combines the scheduled shift (ON DUTY / DAY OFF / ON LEAVE) with today's
// real attendance punch state, and links Clock In / Clock Out to the existing
// geofenced attendance flow at /attendance (no clock logic is duplicated here).

import NavLink from '../NavLink'
import type { ShiftViewState } from '@/lib/attendance/shiftView'
import type { HomeAttendanceState } from '@/lib/attendance/homeAttendance'

export type AttendanceState = HomeAttendanceState

interface FrontDeskShiftCardProps {
  name: string
  roleLabel: string
  shiftState: ShiftViewState
  timeLabel: string | null
  attendance: AttendanceState
  /** Clock-in time (HH:MM) when currently clocked in. */
  sinceLabel: string | null
  isOpen: boolean
}

const SHIFT_CONFIG: Record<ShiftViewState, { label: string; subtitle: string; accent: string; iconBg: string }> = {
  on_duty: { label: 'ON DUTY', subtitle: 'Your schedule is active', accent: 'text-green-600', iconBg: 'bg-green-500' },
  off:     { label: 'DAY OFF', subtitle: 'Enjoy your rest day',     accent: 'text-gray-500',  iconBg: 'bg-gray-400' },
  leave:   { label: 'ON LEAVE', subtitle: 'On approved leave',      accent: 'text-orange-500', iconBg: 'bg-orange-400' },
}

const ATTENDANCE_CONFIG: Record<AttendanceState, { label: string; tone: string; cta: 'in' | 'out' | null }> = {
  not_clocked_in:    { label: 'Not clocked in',  tone: 'text-gray-500',   cta: 'in' },
  clocked_in:        { label: 'Clocked in',      tone: 'text-green-600',  cta: 'out' },
  clocked_out:       { label: 'Clocked out',     tone: 'text-gray-400',   cta: null },
  missing_punch_out: { label: 'Missing punch-out', tone: 'text-red-500',  cta: 'out' },
}

function ShiftIcon({ state }: { state: ShiftViewState }) {
  if (state === 'on_duty') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )
  }
  if (state === 'leave') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}

export default function FrontDeskShiftCard({
  name, roleLabel, shiftState, timeLabel, attendance, isOpen,
}: FrontDeskShiftCardProps) {
  const cfg = SHIFT_CONFIG[shiftState]
  const att = ATTENDANCE_CONFIG[attendance]
  // On a day off / leave we keep the card compact and skip the work-oriented
  // attendance row — unless there's an urgent missing punch-out to resolve.
  const showAttendance = shiftState === 'on_duty' || attendance === 'missing_punch_out'

  return (
    <div className="bg-white rounded-2xl shadow-sm px-5 py-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-base font-bold text-gray-900 leading-tight truncate">{name}&apos;s Today&apos;s Shift</div>
          <div className="text-xs text-gray-500 leading-tight mt-0.5">{roleLabel}</div>
        </div>
        <span className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 ${
          isOpen ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${isOpen ? 'bg-green-500' : 'bg-gray-400'}`} />
          {isOpen ? 'Open' : 'Closed'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className={`w-12 h-12 rounded-full ${cfg.iconBg} flex items-center justify-center flex-shrink-0`}>
          <ShiftIcon state={shiftState} />
        </span>
        <div className="min-w-0 flex-1">
          <div className={`text-xl sm:text-2xl font-bold leading-tight whitespace-nowrap ${cfg.accent}`}>{cfg.label}</div>
          {/* Sub-line: just the working time (or rest-day subtitle). The Clock
              In / Clock Out button already conveys the attendance state, so no
              status text here — it only got truncated on narrow screens. */}
          <div className="text-xs leading-tight mt-0.5 truncate">
            {shiftState === 'on_duty' ? (
              <span className="text-gray-500">{timeLabel ?? cfg.subtitle}</span>
            ) : attendance === 'missing_punch_out' ? (
              <span className={`font-medium ${att.tone}`}>{att.label}</span>
            ) : (
              <span className="text-gray-500">{cfg.subtitle}</span>
            )}
          </div>
        </div>

        {/* Clock In / Clock Out — on the same row as the status, right-aligned. */}
        {showAttendance && att.cta && (
          <NavLink
            href="/attendance"
            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold text-white active:opacity-80 ${
              att.cta === 'out' ? 'bg-orange-500' : 'bg-gray-900'
            }`}
          >
            {att.cta === 'out' ? 'Clock Out' : 'Clock In'}
          </NavLink>
        )}
      </div>
    </div>
  )
}
