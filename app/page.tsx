import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import HomeRefresh from './components/HomeRefresh'
import BottomNav from './components/BottomNav'

export const dynamic = 'force-dynamic'

type BentoOrder = {
  status: string
}

async function getStats() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('daily_stats')
    .select('*')
    .eq('date', today)
    .single()
  return data
}

async function getBentoStats() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('bento_orders')
    .select('*')
    .eq('date', today)
  const orders = data || []
  const total = orders.length
  const completed = orders.filter((o: BentoOrder) => o.status === 'completed').length
  return { total, completed }
}

async function getAnomalyCount() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('incidents')
    .select('id')
    .eq('date', today)
    .neq('status', 'resolved')
  return data?.length ?? 0
}

async function getPendingCount() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('tasks')
    .select('id')
    .eq('date', today)
    .eq('status', 'pending')
  return data?.length ?? 0
}

// Placeholder — real data will come from Supabase `reservations` table
async function getReservationCount() {
  // TODO: Replace with Supabase query when reservations table is created
  return 8
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
  const bentoOrders = bentoStats.total
  const bentoCompleted = bentoStats.completed
  const bentoPercent = bentoOrders > 0 ? Math.round((bentoCompleted / bentoOrders) * 100) : 0

  return (
    <HomeRefresh>
    <main className="min-h-screen bg-gray-50 w-full mx-auto relative">
      {/* Header */}
      <div className="bg-white px-5 pt-4 pb-3 border-b border-gray-50">
        {/* Row 1: Avatar + Greeting ··· Bell */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              B
            </div>
            {/* Greeting */}
            <div className="flex items-center gap-1">
              <span className="text-base font-medium text-gray-900">Hi, Bruce</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </div>

          {/* Bell */}
          <div className="relative">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            {anomalyCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center leading-none">{anomalyCount}</span>
            )}
          </div>
        </div>

        {/* Row 2: Section title + Filter */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-400 tracking-wide">Business Summary</span>
          <button className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14"/>
              <line x1="4" y1="10" x2="4" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12" y2="3"/>
              <line x1="20" y1="21" x2="20" y2="16"/>
              <line x1="20" y1="12" x2="20" y2="3"/>
              <line x1="1" y1="14" x2="7" y2="14"/>
              <line x1="9" y1="8" x2="15" y2="8"/>
              <line x1="17" y1="16" x2="23" y2="16"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="px-5 py-4 pb-28 space-y-4">
        {/* Date + Status */}
        <div className="text-xs text-gray-400 flex items-center gap-1">
          {(() => {
            const now = new Date()
            const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            return `${months[now.getMonth()]} ${now.getDate()} ${weekdays[now.getDay()]}`
          })()}
          <span className="text-green-500 font-medium">· ● Open</span>
        </div>

        {/* Revenue Card */}
        <div className="py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-500">Today&apos;s Revenue</span>
            <span className="text-sm text-orange-500 font-medium">Reports →</span>
          </div>
          <div className="text-5xl font-bold tracking-tight">RM {revenueTotal.toLocaleString()}</div>
          <div className="text-sm text-gray-400 mt-2">
            Dine-in + Bento · <span className="text-green-500">● Open</span>
          </div>
        </div>

        {/* Alert Cards — Incidents / Reservations / Pending */}
        <div className="grid grid-cols-3 gap-2">
          <Link href="/incidents" className="bg-red-50 rounded-2xl p-3 text-center block">
            <div className="text-xs text-gray-500 mb-1">Incidents</div>
            <div className="text-2xl font-bold text-red-500">{anomalyCount}</div>
            <div className="text-xs text-gray-400">Items</div>
          </Link>
          <Link href="/reservations" className="bg-blue-50 rounded-2xl p-3 text-center block">
            <div className="text-xs text-gray-500 mb-1">Reservations</div>
            <div className="text-2xl font-bold text-blue-500">{reservationCount}</div>
            <div className="text-xs text-gray-400">Bookings</div>
          </Link>
          <Link href="/tasks" className="bg-orange-50 rounded-2xl p-3 text-center block">
            <div className="text-xs text-gray-500 mb-1">Pending</div>
            <div className="text-2xl font-bold text-orange-500">{pendingCount}</div>
            <div className="text-xs text-gray-400">Items</div>
          </Link>
        </div>

        {/* Core Business Cards — Dine-in / Bento */}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/dine-in" className="bg-white rounded-2xl p-4 shadow-sm block">
            <div className="text-sm font-semibold mb-1">Dine-in</div>
            <div className="text-xs text-green-500 mb-2">Open</div>
            <div className="text-lg font-bold">RM {revenueDineIn.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">→</div>
          </Link>
          <Link href="/bento" className="bg-white rounded-2xl p-4 shadow-sm block">
            <div className="text-sm font-semibold mb-1">Bento</div>
            <div className="text-xs text-green-500 mb-2">In Progress</div>
            <div className="text-lg font-bold">{bentoOrders} orders</div>
            <div className="text-xs text-orange-500 mt-1">{bentoPercent}% complete →</div>
          </Link>
        </div>

        {/* Quick Access */}
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">Quick Access</div>
          <div className="grid grid-cols-3 gap-2">
            <Link href="/reservations" className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 block">
              <div className="text-xs font-medium text-gray-700 mb-1">Reservation</div>
              <div className="text-xs text-gray-400">Today</div>
              <div className="text-sm font-semibold text-blue-500 mt-1">{reservationCount} Bookings</div>
            </Link>
            <Link href="/complaints" className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 block">
              <div className="text-xs font-medium text-gray-700 mb-1">Complaint</div>
              <div className="text-xs text-gray-400">1 Unresolved</div>
              <div className="text-sm font-semibold text-red-400 mt-1">→</div>
            </Link>
            <Link href="/procurement" className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 block">
              <div className="text-xs font-medium text-gray-700 mb-1">Procurement</div>
              <div className="text-xs text-gray-400">5 Pending</div>
              <div className="text-sm font-semibold text-orange-400 mt-1">→</div>
            </Link>
          </div>
        </div>

        {/* Today's Notes */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">Today&apos;s Notes</span>
            <span className="text-sm text-orange-500">All →</span>
          </div>
          <div className="space-y-2">
            {["Today's Special: Grilled Fish", "Soup of the Day: Winter Melon Pork Rib Soup", "15:00 Staff hygiene training"].map((item, i) => (
              <div key={i} className="text-sm text-gray-700 py-1 border-b border-gray-50 last:border-0">{item}</div>
            ))}
          </div>
        </div>
      </div>

      <button className="fixed bottom-20 right-6 w-12 h-12 bg-orange-500 rounded-full shadow-lg flex items-center justify-center text-white font-bold text-lg z-50">
        :::
      </button>

      <BottomNav pendingCount={pendingCount} />
    </main>
    </HomeRefresh>
  )
}
