// 2x2 Status Summary Grid — operational counts at a glance.
// Soft pastel cards (one fixed color per card type) so operational status reads
// at a glance through color, while the orange Revenue hero stays the strongest
// element. Sizing / typography / icon scale match the compact home layout
// (px-4 py-3, text-2xl number, 18px icons) — only the card coloring differs.

interface ToneStyle {
  bg: string
  title: string
  number: string
  icon: string
  status: string // status text color when NOT in the "Clear" state
}

// One fixed pastel tone per card type (color does not flip on count).
const RESERVATIONS: ToneStyle = { bg: 'bg-blue-50',   title: 'text-gray-700', number: 'text-blue-600',   icon: 'text-blue-500',   status: 'text-gray-500' }
const COMPLAINTS:   ToneStyle = { bg: 'bg-red-50',    title: 'text-gray-700', number: 'text-red-600',    icon: 'text-red-500',    status: 'text-red-500' }
const INCIDENTS:    ToneStyle = { bg: 'bg-orange-50', title: 'text-gray-700', number: 'text-orange-600', icon: 'text-orange-500', status: 'text-orange-500' }
const TASKS:        ToneStyle = { bg: 'bg-yellow-50', title: 'text-gray-700', number: 'text-yellow-700', icon: 'text-yellow-600', status: 'text-yellow-700' }

const CLEAR_STATUS = 'text-gray-400'

const calendarIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const alertIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

const clockIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)

interface StatusCard {
  title: string
  value: number
  status: string
  isClear: boolean
  tone: ToneStyle
  icon: React.ReactNode
}

interface StatusSummaryGridProps {
  reservations: number
  complaints: number
  incidents: number
  tasks: number
}

export default function StatusSummaryGrid({ reservations, complaints, incidents, tasks }: StatusSummaryGridProps) {
  const cards: StatusCard[] = [
    {
      title: 'Reservations',
      value: reservations,
      status: 'Today',
      isClear: false,
      tone: RESERVATIONS,
      icon: calendarIcon,
    },
    {
      title: 'Complaints',
      value: complaints,
      status: complaints > 0 ? '! Urgent' : 'Clear',
      isClear: complaints === 0,
      tone: COMPLAINTS,
      icon: alertIcon,
    },
    {
      title: 'Incidents',
      value: incidents,
      status: incidents > 0 ? `${incidents} Active` : 'Clear',
      isClear: incidents === 0,
      tone: INCIDENTS,
      icon: alertIcon,
    },
    {
      title: 'Tasks',
      value: tasks,
      status: tasks > 0 ? `${tasks} Pending` : 'Clear',
      isClear: tasks === 0,
      tone: TASKS,
      icon: clockIcon,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map((card) => (
        <div key={card.title} className={`${card.tone.bg} rounded-2xl px-4 py-3 overflow-hidden`}>
          <div className="flex items-start justify-between gap-2">
            <span className={`text-xs ${card.tone.title} truncate`}>{card.title}</span>
            <span className={`flex-shrink-0 ${card.tone.icon}`}>{card.icon}</span>
          </div>
          <div className={`text-2xl font-bold leading-tight mt-1 ${card.tone.number}`}>{card.value}</div>
          <div className={`text-[11px] font-medium mt-0.5 truncate ${card.isClear ? CLEAR_STATUS : card.tone.status}`}>{card.status}</div>
        </div>
      ))}
    </div>
  )
}
