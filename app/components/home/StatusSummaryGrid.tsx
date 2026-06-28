// 2x2 Status Summary Grid — operational counts at a glance.
// Soft pastel cards (one fixed color per card type) with a decorative image in
// the bottom-right (same treatment as the Kitchen Home cards). Number stays the
// strongest element; the image bleeds out of the card corner.

import NavLink from '@/app/components/NavLink'

interface ToneStyle {
  bg: string
  title: string
  number: string
  status: string // status text color when NOT in the "Clear" state
}

// One fixed pastel tone per card type (color does not flip on count).
const BENTO:        ToneStyle = { bg: 'bg-blue-50',   title: 'text-gray-700', number: 'text-blue-600',   status: 'text-blue-500' }
const COMPLAINTS:   ToneStyle = { bg: 'bg-red-50',    title: 'text-gray-700', number: 'text-red-600',    status: 'text-red-500' }
const INCIDENTS:    ToneStyle = { bg: 'bg-orange-50', title: 'text-gray-700', number: 'text-orange-600', status: 'text-orange-500' }
const RESERVATIONS: ToneStyle = { bg: 'bg-blue-50',   title: 'text-gray-700', number: 'text-blue-600',   status: 'text-gray-500' }

const CLEAR_STATUS = 'text-gray-400'

interface StatusCard {
  title: string
  href: string
  value: number
  status: string
  isClear: boolean
  tone: ToneStyle
  image: string
}

interface StatusSummaryGridProps {
  bentoOrders: number
  bentoCompleted: number
  complaints: number
  incidents: number
  reservations: number
  /** Date label for the nearest reservation count: "Today" | "Tomorrow" | "Jun 30" | "No upcoming". */
  reservationsLabel: string
  /** Reservations link, with ?date=YYYY-MM-DD when an upcoming date exists so the page opens focused there. */
  reservationsHref: string
}

export default function StatusSummaryGrid({ bentoOrders, bentoCompleted, complaints, incidents, reservations, reservationsLabel, reservationsHref }: StatusSummaryGridProps) {
  const bentoPending = bentoOrders - bentoCompleted
  const cards: StatusCard[] = [
    {
      title: 'Bento',
      href: '/bento',
      value: bentoOrders,
      status: bentoPending > 0 ? `${bentoPending} Pending` : bentoOrders > 0 ? 'All Done' : 'No Orders',
      isClear: bentoPending === 0,
      tone: BENTO,
      image: '/bento-card.webp',
    },
    {
      title: 'Quality Issues',
      href: '/complaints',
      value: complaints,
      status: complaints > 0 ? '! Urgent' : 'Clear',
      isClear: complaints === 0,
      tone: COMPLAINTS,
      image: '/Complaints.webp',
    },
    {
      title: 'Incidents',
      href: '/incidents',
      value: incidents,
      status: incidents > 0 ? `${incidents} Active` : 'Clear',
      isClear: incidents === 0,
      tone: INCIDENTS,
      image: '/incidents.webp',
    },
    {
      title: 'Reservations',
      href: reservationsHref,
      value: reservations,
      status: reservationsLabel,
      isClear: reservationsLabel === 'No upcoming',
      tone: RESERVATIONS,
      image: '/Reservations.webp',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map((card) => (
        <NavLink key={card.title} href={card.href} className={`${card.tone.bg} rounded-2xl px-4 py-3 overflow-hidden block relative`}>
          <img
            src={card.image}
            alt=""
            aria-hidden
            className="absolute bottom-1 right-2 w-[40%] aspect-square object-contain pointer-events-none opacity-90"
          />
          <span className={`text-xs ${card.tone.title} truncate block relative`}>{card.title}</span>
          <div className={`text-2xl font-bold leading-tight mt-1 relative ${card.tone.number}`}>{card.value}</div>
          <div className={`text-[11px] font-medium mt-0.5 truncate relative ${card.isClear ? CLEAR_STATUS : card.tone.status}`}>{card.status}</div>
        </NavLink>
      ))}
    </div>
  )
}
