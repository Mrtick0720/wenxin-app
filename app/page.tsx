import HeroCard from "./components/HeroCard"
import HomeRefresh from './components/HomeRefresh'
import HomeReservationsRealtime from './components/HomeReservationsRealtime'
import HomePurchaseRealtime from './components/HomePurchaseRealtime'
import HomeShiftRealtime from './components/HomeShiftRealtime'
import HomeBell from './components/HomeBell'
import StatusSummaryGrid from './components/home/StatusSummaryGrid'
import FinancialSnapshot from './components/home/FinancialSnapshot'
import BentoOpsCard from './components/home/BentoOpsCard'
import TodaysIssuesCard, { type IssueRow } from './components/home/TodaysIssuesCard'
import ShiftBoardCard from './components/home/ShiftBoardCard'
import MyShiftCard from './components/home/MyShiftCard'
import { findShiftByStaffAndDate } from '@/lib/attendance/repository'
import { buildShiftView } from '@/lib/attendance/shiftView'
import QuickAccessGrid from './components/home/QuickAccessGrid'
import KitchenHome from './components/home/KitchenHome'
import { canAccessPath, getHomeVisibility } from '@/lib/auth/permissions'
import { requireCurrentStaff } from '@/lib/auth/currentStaff'
import type { StaffRole } from '@/lib/auth/types'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readRelayDaily, readRelayMtd, readRelayWeek } from '@/lib/feedme/relayStore'
import { businessToday } from '@/lib/feedme/parseQueryResult'
import { todayLocalStr } from '@/lib/dateUtils'
import { getReservationSummary, EMPTY_RESERVATION_SUMMARY } from '@/lib/reservations/homeSummary'
import FrontDeskHome from './components/home/FrontDeskHome'
import { fetchCashDrawerSessionsAction, fetchLatestClosedSessionAction } from '@/app/cashier/actions'
import { computeCurrentCash, computeCurrentCashLive, selectBestSession } from '@/lib/cashDrawer/utils'

export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Restaurant Owner',
  manager: 'Manager',
  kitchen: 'Kitchen',
  front_desk: 'Front Desk',
  cashier: 'Cashier',
  packing: 'Packing',
  delivery: 'Delivery',
  other: 'Other',
}

type BentoOrder = {
  status: string
  amount: number
}

async function getStats(supabase: SupabaseClient, enabled: boolean) {
  if (!enabled) return null
  const today = todayLocalStr()
  const { data } = await supabase
    .from('daily_stats')
    .select('*')
    .eq('date', today)
    .single()
  return data
}

async function getBentoStats(supabase: SupabaseClient, role: StaffRole, showRevenue: boolean) {
  const today = todayLocalStr()
  const source = role === 'kitchen' ? 'bento_kitchen_orders' : 'bento_orders'
  const query = supabase.from(source)
  const { data } = showRevenue
    ? await query.select('status,amount').eq('date', today)
    : await query.select('status').eq('date', today)
  const orders = (data || []) as unknown as BentoOrder[]
  const total = orders.length
  const completed = orders.filter(o => o.status === 'completed').length
  const revenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0)
  return { total, completed, revenue }
}

async function getAnomalyCount(supabase: SupabaseClient, enabled: boolean) {
  if (!enabled) return 0
  const today = todayLocalStr()
  const { data } = await supabase
    .from('incidents')
    .select('id')
    .eq('date', today)
    .neq('status', 'resolved')
  return data?.length ?? 0
}

async function getPendingCount(supabase: SupabaseClient) {
  const today = todayLocalStr()
  const { data } = await supabase
    .from('tasks')
    .select('id')
    .eq('date', today)
    .eq('status', 'pending')
  return data?.length ?? 0
}

async function getPendingChecklistCount(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('purchase_checklist')
    .select('id')
    .eq('status', 'pending')
  return data?.length ?? 0
}

// Placeholder — real data will come from Supabase tables
async function getComplaintCount() { return 1 }

async function getReceivablesSummary(supabase: SupabaseClient) {
  const [recRes, bentoRes] = await Promise.all([
    supabase.from('receivables').select('original_amount, paid_amount').neq('status', 'paid'),
    // Completed-but-unpaid bento orders are money owed for meals already
    // delivered (e.g. postpaid schools), so fold them into the receivables total.
    supabase.from('bento_orders').select('amount').eq('status', 'completed').eq('paid', false),
  ])
  const rows = (recRes.data ?? []) as { original_amount: number; paid_amount: number }[]
  const bentoRows = (bentoRes.data ?? []) as { amount: number | null }[]
  const recBalance = rows.reduce((s, r) => s + Math.max(0, Number(r.original_amount) - Number(r.paid_amount)), 0)
  const bentoBalance = bentoRows.reduce((s, r) => s + Number(r.amount || 0), 0)
  return {
    totalBalance: recBalance + bentoBalance,
    openCount: rows.length + bentoRows.length,
  }
}

/** Delegates to the shared Payables server action so Home card and Payables
 *  detail page always show identical numbers from one query. */
async function getPayablesSummary() {
  const { fetchPayablesSummaryAction } = await import('@/app/payables/actions')
  const res = await fetchPayablesSummaryAction()
  if (!res.ok) return { totalBalance: 0, dueTodayCount: 0 }
  return res.data
}

// The Home Reservations card shows the nearest upcoming active-reservation date
// (today → +30 days), not just today's. The grouping/horizon logic is shared
// with the front_desk Home via lib/reservations/homeSummary.

// Per-request fault isolation: resolve to `fallback` instead of rejecting, so a
// single failed data source (FeedMe timeout, token-refresh failure, a flaky DB
// query) degrades only its own metric and never blocks or crashes the dashboard
// render. Errors are swallowed deliberately — never logged, to avoid leaking any
// token/credential carried in an error message.
async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p
  } catch {
    return fallback
  }
}

async function getCashBalance(businessDate: string): Promise<{ balance: number | null; note: string | null }> {
  const result = await fetchCashDrawerSessionsAction(businessDate)
  const sessions = result.ok ? result.data : []
  // Mirror the Cash Drawer detail page exactly so Home and the detail hero always
  // agree: pick the SAME session via selectBestSession (not just the first open
  // one in array order — that diverges when more than one drawer is open today),
  // then derive the hero value the same way (open → live estimate, closed →
  // closing float).
  if (sessions.length > 0) {
    const selected = selectBestSession(sessions)
    if (selected) {
      const balance = selected.closeTime === null
        ? computeCurrentCashLive(selected)
        : selected.closingFloat
      return { balance, note: balance !== null ? 'Cash Drawer' : null }
    }
  }
  // No sessions today → fall back to the latest previous closed session.
  const closedResult = await fetchLatestClosedSessionAction(businessDate)
  if (closedResult.ok && closedResult.data) {
    const s = closedResult.data
    const balance = s.closingFloat ?? computeCurrentCash(s)
    if (balance !== null) return { balance, note: 'Cash Drawer' }
  }
  return { balance: null, note: null }
}

// ── Action Required — placeholder logic ──
type Issue = { type: string; detail: string; link: string }
function getTodayIssues(role: StaffRole): Issue[] {
  const issues: Issue[] = []
  if (canAccessPath(role, '/inventory')) {
    issues.push({ type: 'Low Stock', detail: 'Soy Sauce, Cooking Oil', link: '/inventory' })
  }
  if (canAccessPath(role, '/staff')) {
    issues.push({ type: 'Attendance', detail: 'Lina - missing punch-out', link: '/staff' })
  }
  return issues
}

export default async function Home() {
  const staff = await requireCurrentStaff()

  // Kitchen gets a dedicated execution-first command center, not the
  // owner/manager financial dashboard.
  if (staff.role === 'kitchen') {
    return <KitchenHome />
  }

  // Front desk gets an operations-first home (shift, reservations, action
  // items) with NO owner/manager financial KPIs. Cash Drawer there is gated on
  // explicit cashier permission, not on the front_desk role.
  if (staff.role === 'front_desk') {
    return <FrontDeskHome />
  }

  const supabase = await createServerSupabaseClient()
  const visibility = getHomeVisibility(staff.role)
  // Each source is wrapped in safe() so it resolves independently. The outer
  // Promise.all therefore never rejects — one failed metric falls back without
  // blocking the others or the page render. FeedMe metrics fall back to null,
  // which the UI renders as "—".
  const showPurchase = canAccessPath(staff.role, '/purchase')
  const bizToday = businessToday()
  const [stats, bentoStats, anomalyCount, pendingCount, pendingChecklist, complaintCount, nextReservation, feedMeRevenue, feedMeMtd, feedMe7Day, receivablesSummary, payablesSummary, cashDrawerBalance, myShift] = await Promise.all([
    safe(getStats(supabase, visibility.revenue), null),
    safe(getBentoStats(supabase, staff.role, visibility.revenue), { total: 0, completed: 0, revenue: 0 }),
    safe(getAnomalyCount(supabase, canAccessPath(staff.role, '/incidents')), 0),
    safe(getPendingCount(supabase), 0),
    safe(showPurchase ? getPendingChecklistCount(supabase) : Promise.resolve(0), 0),
    safe(canAccessPath(staff.role, '/complaints') ? getComplaintCount() : Promise.resolve(0), 0),
    safe(getReservationSummary(supabase), EMPTY_RESERVATION_SUMMARY),
    safe(visibility.revenue ? readRelayDaily() : Promise.resolve(null), null),
    safe(visibility.revenue ? readRelayMtd() : Promise.resolve(null), null),
    safe(visibility.revenue ? readRelayWeek() : Promise.resolve(null), null),
    safe(visibility.finance ? getReceivablesSummary(supabase) : Promise.resolve({ totalBalance: 0, openCount: 0 }), { totalBalance: 0, openCount: 0 }),
    safe(visibility.finance ? getPayablesSummary() : Promise.resolve({ totalBalance: 0, dueTodayCount: 0 }), { totalBalance: 0, dueTodayCount: 0 }),
    safe(staff.role === 'owner' ? getCashBalance(bizToday) : Promise.resolve({ balance: null, note: null }), { balance: null, note: null }),
    safe(staff.role !== 'owner' ? findShiftByStaffAndDate(staff.id, bizToday) : Promise.resolve(null), null),
  ])
  const notificationCount = anomalyCount + pendingChecklist

  // Today's Revenue is the LIVE FeedMe parser result (source of truth). If the
  // live call is unavailable, getFeedMeDailyRevenue() returns the last
  // successful cached value — never a fabricated demo value. Growth / vs
  // Yesterday remain disabled for now (null → "—").
  // FeedMe returns the latest COMPLETED business day. Today's Revenue is ONLY
  // that value when its date equals today's Malaysia (UTC+8) date. If FeedMe's
  // date is earlier (today not open yet), today is unknown → "—", and the FeedMe
  // value is the last business day's revenue → shown as "vs Yesterday". We never
  // fabricate today's revenue, and growth stays "—" for now.
  const feedMeDate = feedMeRevenue?.value.date ?? null
  const feedMeRevenueValue = feedMeRevenue?.value.revenue ?? null
  const revenueIsToday = feedMeDate !== null && feedMeDate === bizToday
  const revenueTotal = revenueIsToday ? feedMeRevenueValue : null

  // Yesterday revenue: prefer the 7-day range data (endDate = yesterday MYT).
  // The 7-day dailyList is sorted by date ascending; the last entry with
  // revenue > 0 on a date before today is yesterday's revenue.
  // Compute yesterday's date (YYYY-MM-DD) in MYT using UTC-safe arithmetic
  // to avoid timezone offsets affecting setDate/getDate on the Date object.
  const bizYesterday = (() => {
    const [y, m, d] = bizToday.split('-').map(Number)
    const prev = new Date(Date.UTC(y, m - 1, d - 1))
    return prev.toISOString().slice(0, 10)
  })()
  const yesterdayFromWeek = feedMe7Day?.dailyList?.find(d => d.date === bizYesterday)?.revenue ?? null
  // If today has data, use 7-day's yesterday value; otherwise FeedMe value IS the
  // latest completed business day (= yesterday).
  const revenueYesterday = revenueIsToday ? yesterdayFromWeek : feedMeRevenueValue

  // Growth vs yesterday — derived from the same today/yesterday values shown on
  // the card. Null when today is unknown or yesterday is 0/unavailable, so the
  // card renders "—" with no baseline rather than a fabricated figure.
  const growthPercent =
    revenueTotal !== null && revenueYesterday !== null && revenueYesterday !== 0
      ? ((revenueTotal - revenueYesterday) / revenueYesterday) * 100
      : null

  console.log('[dashboard] bizToday=', bizToday, 'bizYesterday=', bizYesterday,
    'feedMeDate=', feedMeDate,
    'revenueIsToday=', revenueIsToday,
    'revenueTotal=', revenueTotal,
    'revenueYesterday=', revenueYesterday,
    'yesterdayFromWeek=', yesterdayFromWeek,
    'feedMeSource=', feedMeRevenue?.source,
    'feedMeMtd=', feedMeMtd ? `${feedMeMtd.mtdRevenue} (${feedMeMtd.operatingDays}d)` : null,
    'feedMe7Day=', feedMe7Day ? `${feedMe7Day.totalRevenue} (${feedMe7Day.operatingDays}d)` : null)
  // Hero slide 2 — live month-to-date (FeedMe Daily Sales range). Null → "—".
  const mtdRevenue = feedMeMtd?.mtdRevenue ?? null
  const mtdAverage = feedMeMtd?.mtdAverage ?? null
  const bestDayRevenue = feedMeMtd?.bestDayRevenue ?? null
  const revenueBento = bentoStats.revenue
  const bentoOrders = bentoStats.total
  const bentoCompleted = bentoStats.completed
  const bentoPercent = bentoOrders > 0 ? Math.round((bentoCompleted / bentoOrders) * 100) : 0
  const now = new Date()
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const todayStr = `${months[now.getMonth()]} ${now.getDate()} ${weekdays[now.getDay()]}`

  // My Today's Shift card — shown for every non-owner role.
  const shiftView = buildShiftView(myShift, now)

  const issueRows: IssueRow[] = getTodayIssues(staff.role).map(issue => ({
    tone: issue.link === '/inventory' ? 'red' as const : 'yellow' as const,
    title: issue.type,
    detail: issue.detail,
    link: issue.link,
  }))
  if (canAccessPath(staff.role, '/complaints') && complaintCount > 0) {
    issueRows.push({
      tone: 'blue',
      title: 'Complaints',
      detail: `${complaintCount} customer complaint${complaintCount === 1 ? '' : 's'} pending`,
      link: '/complaints',
    })
  }

  return (
    <HomeRefresh>
    <HomeReservationsRealtime />
    <HomePurchaseRealtime />
    <HomeShiftRealtime />
    <main data-page-capture className="min-h-screen bg-gray-50 w-full mx-auto relative">
      {/* Header — status strip (date · pill · bell), identity row below.
          Top padding = iOS safe-area inset (notch / Dynamic Island) + 0.75rem;
          env() resolves to 0 on desktop so the layout there is unchanged. */}
      <div
        className="bg-white px-5 sm:px-8 pb-3 border-b border-gray-50"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{todayStr}</span>
          <div className="flex items-center gap-3">
            {/* Placeholder status pill — no opening-hours data source yet.
                Non-owner roles get the "Open" status inside their My Today's
                Shift card, so it's only shown in the header for the owner. */}
            {staff.role === 'owner' && (
              <span className="flex items-center gap-1.5 bg-green-50 text-green-600 text-xs font-medium rounded-full px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Open
              </span>
            )}
            <HomeBell baseCount={notificationCount} />
          </div>
        </div>
        {/* Identity row — only for the owner. Other roles see their name and
            role inside the My Today's Shift card, so the header stays compact. */}
        {staff.role === 'owner' && (
          <div className="mt-2.5 min-w-0">
            <div className="text-[17px] font-bold text-gray-900 leading-tight truncate">{staff.displayName}</div>
            <div className="text-xs text-gray-500 leading-tight mt-0.5">{ROLE_LABELS[staff.role]}</div>
          </div>
        )}
      </div>

      <div className="px-5 sm:px-8 pt-4 pb-28 space-y-4">
        {staff.role !== 'owner' && (
          <MyShiftCard
            name={staff.displayName}
            roleLabel={ROLE_LABELS[staff.role]}
            state={shiftView.state}
            timeLabel={shiftView.timeLabel}
            progressPercent={shiftView.progressPercent}
            isOpen={true}
          />
        )}

        {visibility.revenue && (
          <HeroCard
            revenueTotal={revenueTotal}
            revenueYesterday={revenueYesterday}
            growthPercent={growthPercent}
            mtdRevenue={mtdRevenue}
            mtdAverage={mtdAverage}
            bestDayRevenue={bestDayRevenue}
            revenueBento={revenueBento}
            bentoOrders={bentoOrders}
            bentoCompleted={bentoCompleted}
            bentoPercent={bentoPercent}
            feedMeRevenue={feedMeRevenue}
            feedMeMtd={feedMeMtd}
            feedMe7Day={feedMe7Day}
          />
        )}

        <StatusSummaryGrid
          bentoOrders={bentoOrders}
          bentoCompleted={bentoCompleted}
          complaints={complaintCount}
          incidents={anomalyCount}
          reservations={nextReservation.count}
          reservationsLabel={nextReservation.label}
          reservationsHref={nextReservation.date ? `/reservations?date=${nextReservation.date}` : '/reservations'}
        />

        {visibility.finance && (
          <FinancialSnapshot
            role={staff.role}
            receivablesTotal={receivablesSummary.totalBalance}
            receivablesOpenCount={receivablesSummary.openCount}
            payablesTotal={payablesSummary.totalBalance}
            payablesDueTodayCount={payablesSummary.dueTodayCount}
            cashBalance={cashDrawerBalance.balance ?? feedMeRevenue?.value?.payments?.find(p => p.method === 'CASH')?.amount ?? null}
            cashNote={cashDrawerBalance.note ?? (feedMeRevenue?.value?.payments?.find(p => p.method === 'CASH') ? 'Cash sales today' : null)}
          />
        )}

        {/* Bento metrics now live in the Hero carousel (slide 3) for roles that
            see the revenue Hero; keep the standalone card only for roles whose
            Hero is hidden, so they don't lose their Bento entry point. */}
        {!visibility.revenue && canAccessPath(staff.role, '/bento') && (
          <BentoOpsCard
            orders={bentoOrders}
            revenue={revenueBento}
            percent={bentoPercent}
            showRevenue={visibility.revenue}
          />
        )}

        <TodaysIssuesCard issues={issueRows} dateLabel={todayStr} />

        {canAccessPath(staff.role, '/staff') && <ShiftBoardCard />}

        <QuickAccessGrid role={staff.role} />
      </div>
    </main>
    </HomeRefresh>
  )
}
