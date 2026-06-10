import HeroCard from "./components/HeroCard"
import HomeRefresh from './components/HomeRefresh'
import StatusSummaryGrid from './components/home/StatusSummaryGrid'
import FinancialSnapshot from './components/home/FinancialSnapshot'
import BentoOpsCard from './components/home/BentoOpsCard'
import TodaysIssuesCard, { type IssueRow } from './components/home/TodaysIssuesCard'
import ShiftBoardCard from './components/home/ShiftBoardCard'
import QuickAccessGrid from './components/home/QuickAccessGrid'
import { canAccessPath, getHomeVisibility } from '@/lib/auth/permissions'
import { requireCurrentStaff } from '@/lib/auth/currentStaff'
import type { StaffRole } from '@/lib/auth/types'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Restaurant Owner',
  manager: 'Manager',
  kitchen: 'Kitchen',
  front_desk: 'Front Desk',
  delivery: 'Delivery',
}

type BentoOrder = {
  status: string
  amount: number
}

async function getStats(supabase: SupabaseClient, enabled: boolean) {
  if (!enabled) return null
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('daily_stats')
    .select('*')
    .eq('date', today)
    .single()
  return data
}

async function getBentoStats(supabase: SupabaseClient, role: StaffRole, showRevenue: boolean) {
  const today = new Date().toISOString().split('T')[0]
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
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('incidents')
    .select('id')
    .eq('date', today)
    .neq('status', 'resolved')
  return data?.length ?? 0
}

async function getPendingCount(supabase: SupabaseClient) {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('tasks')
    .select('id')
    .eq('date', today)
    .eq('status', 'pending')
  return data?.length ?? 0
}

// Placeholder — real data will come from Supabase tables
async function getComplaintCount() { return 1 }

// Placeholder — no reservations data source yet; static UI count only.
async function getReservationCount() { return 8 }

// ── Today's Issues — placeholder logic ──
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
  const supabase = await createServerSupabaseClient()
  const visibility = getHomeVisibility(staff.role)
  const [stats, bentoStats, anomalyCount, pendingCount, complaintCount, reservationCount] = await Promise.all([
    getStats(supabase, visibility.revenue),
    getBentoStats(supabase, staff.role, visibility.revenue),
    getAnomalyCount(supabase, canAccessPath(staff.role, '/incidents')),
    getPendingCount(supabase),
    canAccessPath(staff.role, '/complaints') ? getComplaintCount() : 0,
    getReservationCount(),
  ])

  const revenueTotal = stats?.revenue_total ?? 0
  const revenueDineIn = stats?.revenue_dine_in ?? 0
  const revenueBento = bentoStats.revenue
  const bentoOrders = bentoStats.total
  const bentoCompleted = bentoStats.completed
  const bentoPercent = bentoOrders > 0 ? Math.round((bentoCompleted / bentoOrders) * 100) : 0
  const now = new Date()
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const todayStr = `${months[now.getMonth()]} ${now.getDate()} ${weekdays[now.getDay()]}`

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
            {/* Placeholder status pill — no opening-hours data source yet */}
            <span className="flex items-center gap-1.5 bg-green-50 text-green-600 text-xs font-medium rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Open
            </span>
            <div className="relative">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              {anomalyCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center leading-none">{anomalyCount}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2.5 min-w-0">
          <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-base flex-shrink-0">
            {staff.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-[17px] font-bold text-gray-900 leading-tight truncate">{staff.displayName}</div>
            <div className="text-xs text-gray-500 leading-tight mt-0.5">{ROLE_LABELS[staff.role]}</div>
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-8 pt-4 pb-28 space-y-4">
        {visibility.revenue && (
          <HeroCard
            revenueTotal={revenueTotal}
            revenueDineIn={revenueDineIn}
            revenueBento={revenueBento}
            bentoOrders={bentoOrders}
            bentoCompleted={bentoCompleted}
            bentoPercent={bentoPercent}
          />
        )}

        <StatusSummaryGrid
          reservations={reservationCount}
          complaints={complaintCount}
          incidents={anomalyCount}
          tasks={pendingCount}
        />

        {visibility.revenue && <FinancialSnapshot />}

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
