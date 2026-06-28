// My Today's Shift — personal shift status card shown on the home screen for
// every non-owner role. Reflects the staff member's scheduled shift today
// (source: staff_shifts). The restaurant "Open" pill lives in the top-right of
// this card (moved out of the page header) so the header stays minimal.

import type { ShiftViewState } from '@/lib/attendance/shiftView'

export type { ShiftViewState }

interface MyShiftCardProps {
  // Staff display name — forms the card title "{name}'s Today's Shift".
  name: string
  // Role label shown as small text under the name (e.g. "Front Desk").
  roleLabel: string
  state: ShiftViewState
  // Working window label, e.g. "08:30 - 17:30". Null on off / leave days.
  timeLabel: string | null
  // 0–100, how far through the working window we are right now.
  progressPercent: number
  // Restaurant open status (was the header pill).
  isOpen: boolean
}

const STATE_CONFIG: Record<ShiftViewState, {
  label: string
  subtitle: string
  accent: string      // text color for the big label
  iconBg: string      // circle background
}> = {
  on_duty: {
    label: 'ON DUTY',
    subtitle: 'Status: Your Schedule is Active',
    accent: 'text-green-600',
    iconBg: 'bg-green-500',
  },
  off: {
    label: 'DAY OFF',
    subtitle: 'Enjoy your rest day',
    accent: 'text-gray-500',
    iconBg: 'bg-gray-400',
  },
  leave: {
    label: 'ON LEAVE',
    subtitle: 'Status: On approved leave',
    accent: 'text-orange-500',
    iconBg: 'bg-orange-400',
  },
}

function StateIcon({ state }: { state: ShiftViewState }) {
  if (state === 'on_duty') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )
  }
  if (state === 'leave') {
    // palm / rest icon → use a simple sun for "leave/rest"
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    )
  }
  // off — moon
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}

export default function MyShiftCard({ name, roleLabel, state, timeLabel, progressPercent, isOpen }: MyShiftCardProps) {
  const cfg = STATE_CONFIG[state]
  const showWorkingTime = state === 'on_duty' && timeLabel !== null
  const pct = Math.max(0, Math.min(100, progressPercent))

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

      <div className="flex items-stretch gap-4">
        {/* Status block */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className={`w-12 h-12 rounded-full ${cfg.iconBg} flex items-center justify-center flex-shrink-0`}>
            <StateIcon state={state} />
          </span>
          <div className="min-w-0">
            <div className={`text-2xl font-bold leading-tight ${cfg.accent}`}>{cfg.label}</div>
            <div className="text-xs text-gray-500 leading-tight mt-0.5">{cfg.subtitle}</div>
          </div>
        </div>

        {/* Working time block */}
        {showWorkingTime && (
          <div className="flex items-stretch gap-4 flex-shrink-0">
            <div className="w-px bg-gray-100" />
            <div className="flex flex-col justify-center">
              <div className="text-xs text-gray-500 leading-tight">Working Time:</div>
              <div className="text-lg font-bold text-gray-900 leading-tight whitespace-nowrap">{timeLabel}</div>
              <div className="mt-1.5 h-1.5 w-28 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
