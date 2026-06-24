// ── Kitchen Command Center ──
// Execution-first home for the kitchen role. Hero = Purchase Cost Ratio (no
// amounts — kitchen sees the % and band only). Below: a 2x2 at-a-glance grid
// (Bento / Verify / Low Stock / Complaints) and today's work checklist.
// Production detail lives on the Bento page; here it's just a count.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireCurrentStaff } from '@/lib/auth/currentStaff'
import { todayLocalStr } from '@/lib/dateUtils'
import { findLowStockItems } from '@/lib/inventory/repository'
import * as svc from '@/lib/purchaseLedger/service'
import { computeKpi } from '@/lib/purchaseLedger/kpi'
import { businessToday } from '@/lib/purchaseLedger/time'
import { listKitchenTasksAction } from '@/app/kitchen/dailyTasksActions'
import HomeRefresh from '../HomeRefresh'
import HomePurchaseRealtime from '../HomePurchaseRealtime'
import HomeBell from '../HomeBell'
import NavLink from '../NavLink'
import KitchenTasksWithPolling from './KitchenTasksWithPolling'
import KitchenCostRatioCard from './KitchenCostRatioCard'

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p } catch { return fallback }
}

function isBentoTomorrow(): boolean {
  return new Date().getHours() >= 15
}

async function getBentoCount(supabase: SupabaseClient): Promise<{ count: number; forTomorrow: boolean }> {
  const tomorrow = isBentoTomorrow()
  const date = tomorrow
    ? (() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
    : todayLocalStr()
  const { data } = await supabase
    .from('bento_kitchen_orders')
    .select('quantity')
    .eq('date', date)
  const count = (data ?? []).reduce((sum, row) => sum + (row.quantity ?? 1), 0)
  return { count, forTomorrow: tomorrow }
}

// Complaints still run on seed data app-wide (no real table yet); mirror the
// placeholder the main home uses so counts stay consistent until it's real.
async function getComplaintCount(): Promise<number> { return 1 }

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type SquareTone = { bg: string; number: string; status: string }
const TONE = {
  blue:   { bg: 'bg-blue-50',   number: 'text-blue-600',   status: 'text-blue-500' },
  amber:  { bg: 'bg-amber-50',  number: 'text-amber-600',  status: 'text-amber-600' },
  red:    { bg: 'bg-red-50',    number: 'text-red-600',    status: 'text-red-500' },
} satisfies Record<string, SquareTone>

export default async function KitchenHome() {
  const staff = await requireCurrentStaff()
  const supabase = await createServerSupabaseClient()

  const [bentoResult, pending, lowStock, kpi, complaints, tasksRes] = await Promise.all([
    safe(getBentoCount(supabase), { count: 0, forTomorrow: false }),
    safe(svc.listPendingVerification(staff.role), []),
    safe(findLowStockItems(), []),
    safe(computeKpi('kitchen'), null),
    safe(getComplaintCount(), 0),
    safe(listKitchenTasksAction(), { ok: false as const, error: 'load failed' }),
  ])

  const initialTasks = tasksRes.ok ? tasksRes.data : []
  const { count: bentoCount, forTomorrow: bentoForTomorrow } = bentoResult

  const now = new Date()
  const todayStr = `${months[now.getMonth()]} ${now.getDate()} ${weekdays[now.getDay()]}`
  const kpiToday = businessToday()

  const notificationCount = pending.length + (lowStock.length > 0 ? 1 : 0)

  const squares: {
    title: string; href: string; value: number; status: string; tone: SquareTone; image?: string
  }[] = [
    { title: 'Bento', href: '/bento', value: bentoCount, status: bentoForTomorrow ? 'To make tomorrow' : 'To make today', tone: TONE.blue, image: '/bento-card.webp' },
    { title: 'To Verify', href: '/purchase', value: pending.length, status: pending.length > 0 ? 'Check stock' : 'All clear', tone: TONE.amber, image: '/to-verify.webp' },
    { title: 'Low Stock', href: '/inventory', value: lowStock.length, status: lowStock.length > 0 ? 'Restock' : 'All good', tone: TONE.red, image: '/low-stock.webp' },
    { title: 'Complaints', href: '/complaints', value: complaints, status: complaints > 0 ? '! Review' : 'Clear', tone: TONE.red, image: '/complaints.webp' },
  ]

  return (
    <HomeRefresh>
    <HomePurchaseRealtime />
    <main data-page-capture className="min-h-screen bg-gray-50 w-full mx-auto relative">
      {/* Header */}
      <div className="bg-white px-5 sm:px-8 pb-3 border-b border-gray-50" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{todayStr}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 bg-green-50 text-green-600 text-xs font-medium rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Open
            </span>
            <HomeBell baseCount={notificationCount} />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2.5 min-w-0">
          <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-base flex-shrink-0">
            {staff.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-[17px] font-bold text-gray-900 leading-tight truncate">{staff.displayName}</div>
            <div className="text-xs text-gray-500 leading-tight mt-0.5">Kitchen</div>
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-8 pt-4 pb-28 space-y-4">

        {/* ── Hero: Purchase Cost Ratio — tappable, ratio-only for kitchen ── */}
        <KitchenCostRatioCard kpi={kpi} today={kpiToday} />

        {/* ── 2x2 at-a-glance grid ── */}
        <div className="grid grid-cols-2 gap-2">
          {squares.map(card => (
            <NavLink key={card.title} href={card.href} className={`${card.tone.bg} rounded-2xl px-4 py-3 overflow-hidden block relative`}>
              {card.image && (
                <img
                  src={card.image}
                  alt=""
                  aria-hidden
                  className="absolute bottom-0 right-0 w-[52%] aspect-square object-contain pointer-events-none opacity-90"
                />
              )}
              <span className="text-xs text-gray-700 truncate block relative">{card.title}</span>
              <div className={`text-2xl font-bold leading-tight mt-1 relative ${card.tone.number}`}>{card.value}</div>
              <div className={`text-[11px] font-medium mt-0.5 truncate relative ${card.value === 0 ? 'text-gray-400' : card.tone.status}`}>{card.status}</div>
            </NavLink>
          ))}
        </div>

        {/* ── Today's work checklist ── */}
        <KitchenTasksWithPolling initialTasks={initialTasks} />

      </div>
    </main>
    </HomeRefresh>
  )
}
