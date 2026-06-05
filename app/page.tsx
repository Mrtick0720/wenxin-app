import { supabase } from '@/lib/supabase'
import { todayLocalStr } from '@/lib/dateUtils'
import Link from 'next/link'
import HomeRefresh from './components/HomeRefresh'
import BottomNav from './components/BottomNav'
import FunctionLauncher from './components/FunctionLauncher'

export const dynamic = 'force-dynamic'

type BentoOrder = {
  status: string
  amount: number
}

async function getStats() {
  const today = todayLocalStr()
  const { data } = await supabase
    .from('daily_stats')
    .select('*')
    .eq('date', today)
    .single()
  return data
}

async function getBentoStats() {
  const today = todayLocalStr()
  const { data } = await supabase
    .from('bento_orders')
    .select('*')
    .eq('date', today)
    .neq('status', 'canceled')
  const orders = (data || []) as BentoOrder[]
  const total = orders.length
  const completed = orders.filter(o => o.status === 'completed').length
  const revenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0)
  return { total, completed, revenue }
}

async function getAnomalyCount() {
  const today = todayLocalStr()
  const { data } = await supabase
    .from('incidents')
    .select('id')
    .eq('date', today)
    .neq('status', 'resolved')
  return data?.length ?? 0
}

async function getPendingCount() {
  const today = todayLocalStr()
  const { data } = await supabase
    .from('tasks')
    .select('id')
    .eq('date', today)
    .eq('status', 'pending')
  return data?.length ?? 0
}

// Placeholders — real data will come from Supabase tables
async function getReservationCount() { return 8 }

// ── Today's Issues — placeholder logic ──
type Issue = { type: string; detail: string; link: string }
function getTodayIssues(): Issue[] {
  const issues: Issue[] = []
  // Complaint is already shown in Alert Cards above — only show operational issues here
  issues.push({ type: 'Low Stock', detail: 'Soy Sauce, Cooking Oil', link: '/inventory' })
  issues.push({ type: 'Attendance', detail: 'Lina missing punch-out', link: '/staff' })
  return issues
}

export default async function Home() {
  const [stats, bentoStats, anomalyCount, pendingCount, reservationCount] = await Promise.all([
    getStats(),
    getBentoStats(),
    getAnomalyCount(),
    getPendingCount(),
    getReservationCount(),
  ])

  const revenueTotal = stats?.revenue_total ?? 0
  const revenueDineIn = stats?.revenue_dine_in ?? 0
  const revenueBento = bentoStats.revenue
  const bentoOrders = bentoStats.total
  const bentoCompleted = bentoStats.completed
  const bentoPercent = bentoOrders > 0 ? Math.round((bentoCompleted / bentoOrders) * 100) : 0
  const issues = getTodayIssues()
  const now = new Date()
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const todayStr = `${months[now.getMonth()]} ${now.getDate()} ${weekdays[now.getDay()]}`

  return (
    <HomeRefresh>
    <main data-page-capture className="min-h-screen bg-gray-50 w-full mx-auto relative">
      <div className="bg-white px-4 pt-3 pb-2.5 border-b border-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-white font-semibold text-[11px] flex-shrink-0">
              W
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">Wenxin Ops</div>
              <div className="text-[11px] text-gray-400">Main Store · {todayStr} · Open</div>
            </div>
          </div>
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

      <div className="px-4 pt-4 pb-28 space-y-4">
        <div>
          <div className="text-xl font-semibold text-gray-900">Good morning, Bruce</div>
          <div className="mt-1 text-xs text-green-500 font-medium">● Operations normal</div>
        </div>

        <Link href="/reports" className="block">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Today&apos;s Revenue</span>
            <span className="text-xs text-orange-500">Reports →</span>
          </div>
          <div className="mt-2 text-5xl font-bold tracking-tight text-gray-900">RM {revenueTotal.toLocaleString()}</div>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span>Dine-in + Bento</span>
            <span className="text-green-500 font-medium">+12% vs yesterday</span>
          </div>
        </Link>

        <div className="grid grid-cols-4 gap-1.5">
          <Link href="/incidents" className="bg-red-50 rounded-xl p-2.5 text-center block overflow-hidden">
            <div className="text-[11px] text-gray-500 mb-0.5 truncate">Incidents</div>
            <div className="text-lg font-bold text-red-500">{anomalyCount}</div>
            <div className="text-[11px] text-red-400 mt-0.5 truncate">{anomalyCount > 0 ? 'Review' : 'Clear'}</div>
          </Link>
          <Link href="/tasks" className="bg-amber-50 rounded-xl p-2.5 text-center block overflow-hidden">
            <div className="text-[11px] text-gray-500 mb-0.5 truncate">Pending</div>
            <div className="text-lg font-bold text-amber-500">{pendingCount}</div>
            <div className="text-[11px] text-amber-400 mt-0.5 truncate">{pendingCount > 0 ? 'Approvals' : 'Clear'}</div>
          </Link>
          <Link href="/bento" className="bg-green-50 rounded-xl p-2.5 text-center block overflow-hidden">
            <div className="text-[11px] text-gray-500 mb-0.5 truncate">Bento</div>
            <div className="text-lg font-bold text-green-600">{bentoPercent}%</div>
            <div className="text-[11px] text-green-500 mt-0.5 truncate">In Progress</div>
          </Link>
          <Link href="/reservations" className="bg-blue-50 rounded-xl p-2.5 text-center block overflow-hidden">
            <div className="text-[11px] text-gray-500 mb-0.5 truncate">Booking</div>
            <div className="text-lg font-bold text-blue-500">{reservationCount}</div>
            <div className="text-[11px] text-gray-400 mt-0.5 truncate">Today</div>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link href="/dine-in" className="bg-white rounded-2xl p-4 shadow-sm block">
            <div className="text-sm font-semibold text-gray-900 mb-2">Dine-in</div>
            <div className="text-xl font-bold text-gray-900">RM {revenueDineIn.toLocaleString()}</div>
            <div className="mt-2 space-y-0.5">
              <div className="text-xs text-green-500 whitespace-nowrap">Open</div>
              <div className="text-xs text-gray-400 whitespace-nowrap">12 tables · Avg RM 106</div>
            </div>
          </Link>
          <Link href="/bento" className="bg-white rounded-2xl p-4 shadow-sm block">
            <div className="text-sm font-semibold text-gray-900 mb-2">Bento</div>
            <div className="text-xl font-bold text-gray-900">RM {revenueBento.toLocaleString()}</div>
            <div className="mt-2 space-y-0.5">
              <div className="text-xs text-gray-400 whitespace-nowrap">{bentoOrders} Orders</div>
              <div className="text-xs whitespace-nowrap text-orange-500">{bentoPercent}% Done</div>
            </div>
          </Link>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-800">Today&apos;s Agenda</span>
            <Link href="/tasks" className="text-xs text-orange-500">All →</Link>
          </div>
          <div className="mb-3 space-y-1.5 text-sm text-gray-600">
            <div>Feature dish: Grilled Fish</div>
            <div>Soup of the day: Winter Melon Pork Rib Soup</div>
            <div>15:00 Staff hygiene training</div>
          </div>
          {issues.length === 0 ? (
            <div className="text-sm text-green-500 font-medium py-2">No issues today</div>
          ) : (
            <div className="space-y-2">
              {issues.map((issue, i) => (
                <Link key={i} href={issue.link} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs font-medium text-gray-700 flex-1">{issue.type}</span>
                  <span className="text-xs text-gray-400">{issue.detail}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>

        <Link href="/staff" className="bg-white rounded-2xl p-4 shadow-sm block">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-800">Shift Board</span>
            <span className="text-xs text-orange-500">→</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            <span>4 on duty</span>
            <span className="text-gray-300">·</span>
            <span>Chef: Ah Ming</span>
            <span className="text-gray-300">·</span>
            <span>10:00–20:00</span>
          </div>
        </Link>
      </div>

      <FunctionLauncher />
      <BottomNav pendingCount={pendingCount} />
    </main>
    </HomeRefresh>
  )
}
