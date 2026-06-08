import NavLink from "./components/NavLink"
import HeroCard from "./components/HeroCard"
import HomeRefresh from './components/HomeRefresh'
import BottomNav from './components/BottomNav'
import { canAccessPath, getHomeVisibility } from '@/lib/auth/permissions'
import { requireCurrentStaff } from '@/lib/auth/currentStaff'
import type { StaffRole } from '@/lib/auth/types'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

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

// Placeholders — real data will come from Supabase tables
async function getReservationCount() { return 8 }
async function getComplaintCount() { return 1 }

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
  const [stats, bentoStats, anomalyCount, pendingCount, reservationCount, complaintCount] = await Promise.all([
    getStats(supabase, visibility.revenue),
    getBentoStats(supabase, staff.role, visibility.revenue),
    getAnomalyCount(supabase, canAccessPath(staff.role, '/incidents')),
    getPendingCount(supabase),
    canAccessPath(staff.role, '/reservations') ? getReservationCount() : 0,
    canAccessPath(staff.role, '/complaints') ? getComplaintCount() : 0,
  ])

  const revenueTotal = stats?.revenue_total ?? 0
  const revenueDineIn = stats?.revenue_dine_in ?? 0
  const revenueBento = bentoStats.revenue
  const bentoOrders = bentoStats.total
  const bentoCompleted = bentoStats.completed
  const bentoPercent = bentoOrders > 0 ? Math.round((bentoCompleted / bentoOrders) * 100) : 0
  const issues = getTodayIssues(staff.role)
  const now = new Date()
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const todayStr = `${months[now.getMonth()]} ${now.getDate()} ${weekdays[now.getDay()]}`

  return (
    <HomeRefresh>
    <main data-page-capture className="min-h-screen bg-gray-50 w-full mx-auto relative">
      {/* Header — minimal: Avatar + Greeting + Bell only */}
      <div className="bg-white px-5 sm:px-8 pt-3 pb-2.5 border-b border-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-white font-semibold text-[11px] flex-shrink-0">
              B
            </div>
            <div className="flex items-center gap-0.5">
              <span className="text-sm font-medium text-gray-900">Hi, {staff.displayName}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
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

        {/* ═══ Alert Cards — 4 status cards with priority hints ═══ */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {canAccessPath(staff.role, '/reservations') && <NavLink href="/reservations" className="bg-blue-100 rounded-xl pl-5 pr-3.5 py-2 block overflow-hidden">
            <div className="flex items-start justify-between">
              <span className="text-xs font-medium text-gray-600 truncate">Reservations</span>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 flex-shrink-0">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div className="text-4xl font-bold text-blue-600 leading-none mt-1">{reservationCount}</div>
            <div className="text-[11px] text-gray-500 mt-0.5 truncate">Today</div>
          </NavLink>}
          {canAccessPath(staff.role, '/complaints') && <NavLink href="/complaints" className="bg-rose-100 rounded-xl pl-5 pr-3.5 py-2 block overflow-hidden">
            <div className="flex items-start justify-between">
              <span className="text-xs font-medium text-gray-600 truncate">Complaints</span>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-rose-600 flex-shrink-0">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/>
              </svg>
            </div>
            <div className="text-4xl font-bold text-rose-600 leading-none mt-1">{complaintCount}</div>
            <div className="text-[11px] text-rose-500 mt-0.5 truncate">! Urgent</div>
          </NavLink>}
          {canAccessPath(staff.role, '/incidents') && <NavLink href="/incidents" className="bg-orange-100 rounded-xl pl-5 pr-3.5 py-2 block overflow-hidden">
            <div className="flex items-start justify-between">
              <span className="text-xs font-medium text-gray-600 truncate">Incidents</span>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600 flex-shrink-0">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17"/>
              </svg>
            </div>
            <div className="text-4xl font-bold text-orange-600 leading-none mt-1">{anomalyCount}</div>
            <div className="text-[11px] text-gray-500 mt-0.5 truncate">{anomalyCount > 0 ? 'Open' : 'Clear'}</div>
          </NavLink>}
          <NavLink href="/tasks" className="bg-yellow-100 rounded-xl pl-5 pr-3.5 py-2 block overflow-hidden">
            <div className="flex items-start justify-between">
              <span className="text-xs font-medium text-gray-600 truncate">Tasks</span>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-700 flex-shrink-0">
                <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
              </svg>
            </div>
            <div className="text-4xl font-bold text-yellow-700 leading-none mt-1">{pendingCount}</div>
            <div className="text-[11px] text-yellow-700 mt-0.5 truncate">{pendingCount > 0 ? 'Overdue' : 'Clear'}</div>
          </NavLink>
        </div>

        {/* ═══ Today's Issues — Low Stock + Attendance only (Complaints shown in Alert Cards above) ═══ */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-800">Today&apos;s Issues</span>
            <span className="text-xs text-gray-400">{todayStr}</span>
          </div>
          {issues.length === 0 ? (
            <div className="text-sm text-green-500 font-medium py-2">✓ No Issues Today</div>
          ) : (
            <div className="space-y-2">
              {issues.map((issue, i) => (
                <NavLink key={i} href={issue.link} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs font-medium text-gray-700 flex-1">{issue.type}</span>
                  <span className="text-xs text-gray-400">{issue.detail}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* ═══ Shift Board — today's staffing ═══ */}
        {canAccessPath(staff.role, '/staff') && <NavLink href="/staff" className="bg-white rounded-2xl p-4 shadow-sm block">
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
        </NavLink>}

        {/* ═══ Quick Access — low-frequency but essential ═══ */}
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">Quick Access</div>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { href: '/inventory', label: 'Inventory', always: false, icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
              ) },
              { href: '/finance', label: 'Finance', always: false, icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
              ) },
              { href: '/bento/customers', label: 'Customers', always: false, icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              ) },
              { href: '/reports', label: 'Reports', always: false, icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
              ) },
              { href: '/suppliers', label: 'Suppliers', always: false, icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
              ) },
              { href: '/all', label: 'View All', always: true, icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
              ) },
            ].filter(item => item.always || canAccessPath(staff.role, item.href)).map(({ href, label, icon }) => (
              <NavLink key={href} href={href} className="bg-white rounded-xl py-3 px-1 border border-gray-100 text-center block overflow-hidden">
                <div className="flex justify-center mb-1.5 text-gray-400">{icon}</div>
                <div className="text-base font-medium text-gray-600 whitespace-nowrap">{label}</div>
              </NavLink>
            ))}</div>
        </div>
      </div>

      <BottomNav pendingCount={pendingCount} />
    </main>
    </HomeRefresh>
  )
}
