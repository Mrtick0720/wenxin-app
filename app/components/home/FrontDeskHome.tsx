// ── Front Desk Operations Home ──
// Execution-first home for the front_desk role. NO owner/manager financial KPIs
// (revenue, growth, receivables, payables, profit/cost). Focus: shift status,
// the four module entry cards, compact next reservation, and action-required items.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireCurrentStaff } from '@/lib/auth/currentStaff'
import { todayLocalStr } from '@/lib/dateUtils'
import { businessToday } from '@/lib/feedme/parseQueryResult'
import { canAccessPath } from '@/lib/auth/permissions'
import * as purchaseSvc from '@/lib/purchaseLedger/service'
import { getReservationSummary, EMPTY_RESERVATION_SUMMARY } from '@/lib/reservations/homeSummary'
import { findShiftByStaffAndDate } from '@/lib/attendance/repository'
import { buildShiftView } from '@/lib/attendance/shiftView'
import { getHomeAttendance } from '@/lib/attendance/homeAttendance'

import HomeRefresh from '../HomeRefresh'
import HomeReservationsRealtime from '../HomeReservationsRealtime'
import HomePurchaseRealtime from '../HomePurchaseRealtime'
import HomeShiftRealtime from '../HomeShiftRealtime'
import HomeBell from '../HomeBell'
import NavLink from '../NavLink'
import FrontDeskShiftCard from './FrontDeskShiftCard'
import NextReservationCard from './NextReservationCard'
import BentoOpsCard from './BentoOpsCard'
import TodaysIssuesCard, { type IssueRow } from './TodaysIssuesCard'

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p } catch { return fallback }
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Complaints still run on app-wide seed data (no real table yet); mirror the
// placeholder the other Home variants use so counts stay consistent.
async function getComplaintCount(): Promise<number> { return 1 }

async function getBentoToday(supabase: SupabaseClient): Promise<{ total: number; completed: number }> {
  const { data } = await supabase
    .from('bento_orders')
    .select('status')
    .eq('date', todayLocalStr())
  const orders = (data ?? []) as { status: string }[]
  return { total: orders.length, completed: orders.filter(o => o.status === 'completed').length }
}

async function getIncidentCount(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from('incidents')
    .select('id')
    .eq('date', todayLocalStr())
    .neq('status', 'resolved')
  return data?.length ?? 0
}

type OpTone = { status: string }
const OP_TONE = {
  blue:  { status: 'text-blue-500' },
  amber: { status: 'text-amber-600' },
  red:   { status: 'text-red-500' },
} satisfies Record<string, OpTone>

// Front-desk-prioritised Quick Access shortcuts, in service order. Filtered by
// the user's actual route access so nothing they can't open is shown.
const QUICK_ACCESS: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: '/attendance', label: 'Attendance', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
  ) },
  { href: '/reservations', label: 'Reservations', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
  ) },
  { href: '/purchase', label: 'Purchase', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
  ) },
  { href: '/bento', label: 'Bento', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M12 6v12M3 12h18"/></svg>
  ) },
  { href: '/complaints', label: 'Quality Issues', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  ) },
  { href: '/bento/customers', label: 'Customers', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>
  ) },
  { href: '/all', label: 'View All', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
  ) },
]

export default async function FrontDeskHome() {
  const staff = await requireCurrentStaff()
  const supabase = await createServerSupabaseClient()
  const bizToday = businessToday()

  const [shift, attendanceInfo, reservation, bento, pendingVerify, complaints, incidents] = await Promise.all([
    safe(findShiftByStaffAndDate(staff.id, bizToday), null),
    safe(getHomeAttendance(staff.id, bizToday), { attendance: 'not_clocked_in' as const, sinceLabel: null }),
    safe(getReservationSummary(supabase), EMPTY_RESERVATION_SUMMARY),
    safe(getBentoToday(supabase), { total: 0, completed: 0 }),
    safe(purchaseSvc.listPendingVerification(staff.role), []),
    safe(getComplaintCount(), 0),
    safe(getIncidentCount(supabase), 0),
  ])

  const now = new Date()
  const todayStr = `${months[now.getMonth()]} ${now.getDate()} ${weekdays[now.getDay()]}`
  const shiftView = buildShiftView(shift, now)
  const { attendance, sinceLabel } = attendanceInfo

  const bentoPending = Math.max(0, bento.total - bento.completed)
  const bentoPercent = bento.total > 0 ? Math.round((bento.completed / bento.total) * 100) : 0
  const verifyCount = pendingVerify.length
  const reservationHref = reservation.date ? `/reservations?date=${reservation.date}` : '/reservations'

  // ── Action Required — only items that actually need action ──
  const actions: IssueRow[] = []
  if (complaints > 0) {
    actions.push({ tone: 'red', title: 'Customer Quality Issues', detail: `${complaints} pending`, link: '/complaints' })
  }
  if (verifyCount > 0) {
    actions.push({ tone: 'yellow', title: 'Purchase to Verify', detail: `${verifyCount} item${verifyCount === 1 ? '' : 's'} to check`, link: '/purchase' })
  }
  if (bentoPending > 0) {
    actions.push({ tone: 'blue', title: 'Bento Pending', detail: `${bentoPending} order${bentoPending === 1 ? '' : 's'} today`, link: '/bento' })
  }
  if (attendance === 'missing_punch_out') {
    actions.push({ tone: 'yellow', title: 'Attendance', detail: 'Missing punch-out', link: '/attendance' })
  }
  if (reservation.pendingCount > 0) {
    actions.push({ tone: 'blue', title: 'Reservations', detail: `${reservation.pendingCount} pending confirmation`, link: reservationHref })
  }
  // Incidents surface ONLY when there's a real issue — never a permanent 0 card.
  if (incidents > 0) {
    actions.push({ tone: 'red', title: 'Incidents', detail: `${incidents} active`, link: '/incidents' })
  }

  const notificationCount = actions.length

  // ── Four module entry cards ──
  const opCards: { title: string; href: string; subtitle: string; hasAlert: boolean; tone: OpTone; image: string }[] = [
    {
      title: 'Reservations',
      href: reservationHref,
      subtitle: reservation.count > 0
        ? `${reservation.count} booking${reservation.count !== 1 ? 's' : ''} · ${reservation.label}`
        : 'No upcoming',
      hasAlert: reservation.count > 0,
      tone: OP_TONE.blue,
      image: '/Reservations.webp',
    },
    {
      title: 'Bento',
      href: '/bento',
      subtitle: bentoPending > 0 ? `${bentoPending} pending` : 'Clear',
      hasAlert: bentoPending > 0,
      tone: OP_TONE.blue,
      image: '/bento-card.webp',
    },
    {
      title: 'Purchase',
      href: '/purchase',
      subtitle: verifyCount > 0
        ? `${verifyCount} item${verifyCount !== 1 ? 's' : ''} · To Verify`
        : 'Clear',
      hasAlert: verifyCount > 0,
      tone: OP_TONE.amber,
      image: '/Purchase.webp',
    },
    {
      title: 'Quality Issues',
      href: '/complaints',
      subtitle: complaints > 0 ? `${complaints} urgent` : 'Clear',
      hasAlert: complaints > 0,
      tone: OP_TONE.red,
      image: '/Complaints.webp',
    },
  ]

  const quickAccess = QUICK_ACCESS.filter(i => i.href === '/all' || canAccessPath(staff.role, i.href))

  return (
    <HomeRefresh>
    <HomeReservationsRealtime />
    <HomePurchaseRealtime />
    <HomeShiftRealtime />
    <main data-page-capture className="min-h-screen bg-gray-50 w-full mx-auto relative">
      {/* Header — date + bell */}
      <div className="bg-white px-5 sm:px-8 pb-3 border-b border-gray-50" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{todayStr}</span>
          <div className="flex items-center gap-3">
            <HomeBell baseCount={notificationCount} />
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-8 pt-4 pb-28 space-y-4">

        {/* 1 — Shift status + attendance */}
        <FrontDeskShiftCard
          name={staff.displayName}
          roleLabel="Front Desk"
          shiftState={shiftView.state}
          timeLabel={shiftView.timeLabel}
          attendance={attendance}
          sinceLabel={sinceLabel}
          isOpen={true}
        />

        {/* 2 — Four module entry cards */}
        <div className="grid grid-cols-2 gap-3">
          {opCards.map(card => (
            <NavLink
              key={card.title}
              href={card.href}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center overflow-hidden active:opacity-80"
            >
              {/* Image area — swap src here when final custom images are ready */}
              <div className="w-full flex items-center justify-center pt-4 pb-1">
                <img src={card.image} alt="" aria-hidden className="w-24 h-24 object-contain" />
              </div>
              {/* Text area */}
              <div className="pb-3 px-3 text-center w-full">
                <div className="text-sm font-semibold text-gray-800">{card.title}</div>
                <div className={`text-xs mt-1 ${card.hasAlert ? card.tone.status : 'text-gray-400'}`}>
                  {card.subtitle}
                </div>
              </div>
            </NavLink>
          ))}
        </div>

        {/* 3 — Compact Next Reservation row */}
        <NextReservationCard next={reservation.next} dateLabel={reservation.label} />

        {/* 4 — Action Required (compact actionable list) */}
        <TodaysIssuesCard
          issues={actions}
          dateLabel={todayStr}
          title="Action Required"
          emptyLabel="✓ All clear — nothing needs action"
          compact
        />

        {/* 5 — Bento Operations — only when there's pending bento work today */}
        {bentoPending > 0 && (
          <BentoOpsCard orders={bento.total} revenue={0} percent={bentoPercent} showRevenue={false} />
        )}

        {/* 6 — Quick Access (front-desk priorities) */}
        <div>
          <div className="text-sm font-semibold text-gray-800 mb-2 px-1">Quick Access</div>
          <div className="grid grid-cols-4 gap-2">
            {quickAccess.map(({ href, label, icon }) => (
              <NavLink key={label} href={href} className="bg-white rounded-xl py-3 px-1 shadow-sm flex flex-col items-center gap-1.5 overflow-hidden">
                <span className="text-orange-500">{icon}</span>
                <span className="text-[11px] font-medium text-gray-600 text-center leading-tight line-clamp-2 w-full">{label}</span>
              </NavLink>
            ))}
          </div>
        </div>

      </div>
    </main>
    </HomeRefresh>
  )
}
