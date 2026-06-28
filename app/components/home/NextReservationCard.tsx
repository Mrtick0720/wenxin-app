// Compact "Next Reservation" detail row for the front-desk Home.
//
// This is the OPERATIONAL companion to the Reservations summary card. The
// summary card answers "how many, when" (count + nearest date); this row answers
// "what's the next booking" in a single compact line:
//   Next Reservation
//   Today · 12:00 · 6 pax · Main Hall · Confirmed
//
// Deliberately small — no large typography that repeats the date already shown
// in the Reservations card. Tapping opens the Reservations page on that date.

import NavLink from '../NavLink'
import type { NextReservationDetail } from '@/lib/reservations/homeSummary'

const STATUS_PILL: Record<string, { label: string; bg: string; text: string }> = {
  confirmed: { label: 'Confirmed', bg: 'bg-green-100',  text: 'text-green-700' },
  pending:   { label: 'Pending',   bg: 'bg-orange-100', text: 'text-orange-700' },
}

function fmtTime(t: string): string {
  return t.slice(0, 5)
}

interface NextReservationCardProps {
  /** Nearest reservation detail, or null when none upcoming. */
  next: NextReservationDetail | null
  /** Date label for the reservation, e.g. "Today" / "Tomorrow" / "Jul 12". */
  dateLabel: string
}

export default function NextReservationCard({ next, dateLabel }: NextReservationCardProps) {
  if (!next) {
    return (
      <div className="bg-white rounded-2xl shadow-sm px-4 py-2.5 flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-500 flex-shrink-0">Next Reservation</span>
        <span className="text-gray-300">·</span>
        <span className="text-xs text-gray-400 truncate">No upcoming reservations</span>
      </div>
    )
  }

  const pill = STATUS_PILL[next.status] ?? STATUS_PILL.pending

  return (
    <NavLink
      href={`/reservations?date=${next.date}`}
      className="bg-white rounded-2xl shadow-sm px-4 py-2.5 block active:opacity-80"
    >
      <div className="text-xs font-semibold text-gray-500">Next Reservation</div>
      <div className="mt-1 flex items-center flex-wrap gap-x-1.5 gap-y-1 text-sm text-gray-600 min-w-0">
        <span className="font-semibold text-gray-900">{dateLabel}</span>
        <span className="text-gray-300">·</span>
        <span className="font-semibold text-orange-500 tabular-nums">{fmtTime(next.timeStart)}</span>
        <span className="text-gray-300">·</span>
        <span>{next.pax} pax</span>
        {next.tableArea && (
          <>
            <span className="text-gray-300">·</span>
            <span className="font-medium text-gray-700 truncate max-w-[8rem]">{next.tableArea}</span>
          </>
        )}
        <span className="text-gray-300">·</span>
        <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 leading-tight ${pill.bg} ${pill.text}`}>{pill.label}</span>
        {next.hasPreorder && (
          <>
            <span className="text-gray-300">·</span>
            <span className="text-blue-500 font-medium">Preorder</span>
          </>
        )}
      </div>
    </NavLink>
  )
}
