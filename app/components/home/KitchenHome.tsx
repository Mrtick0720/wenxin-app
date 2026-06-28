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
import HomeShiftRealtime from '../HomeShiftRealtime'
import HomeBell from '../HomeBell'
import NavLink from '../NavLink'
import KitchenTasksWithPolling from './KitchenTasksWithPolling'
import KitchenCostRatioCard from './KitchenCostRatioCard'
import MyShiftCard from './MyShiftCard'
import { findShiftByStaffAndDate } from '@/lib/attendance/repository'
import { buildShiftView } from '@/lib/attendance/shiftView'

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

  const [bentoResult, pending, lowStock, kpi, complaints, tasksRes, myShift] = await Promise.all([
    safe(getBentoCount(supabase), { count: 0, forTomorrow: false }),
    safe(svc.listPendingVerification(staff.role), []),
    safe(findLowStockItems(), []),
    safe(computeKpi('kitchen'), null),
    safe(getComplaintCount(), 0),
    safe(listKitchenTasksAction(), { ok: false as const, error: 'load failed' }),
    safe(findShiftByStaffAndDate(staff.id, businessToday()), null),
  ])

  const initialTasks = tasksRes.ok ? tasksRes.data : []
  const { count: bentoCount, forTomorrow: bentoForTomorrow } = bentoResult

  const now = new Date()
  const todayStr = `${months[now.getMonth()]} ${now.getDate()} ${weekdays[now.getDay()]}`
  const shiftView = buildShiftView(myShift, now)
  const kpiToday = businessToday()

  const notificationCount = pending.length + (lowStock.length > 0 ? 1 : 0)

  const squares: {
    title: string; href: string; subtitle: string; hasAlert: boolean; tone: SquareTone; image?: string
  }[] = [
    {
      title: 'Bento', href: '/bento',
      subtitle: bentoCount > 0 ? `${bentoCount} to make · ${bentoForTomorrow ? 'Tomorrow' : 'Today'}` : 'None to make',
      hasAlert: bentoCount > 0, tone: TONE.blue, image: '/bento-card.webp',
    },
    {
      title: 'To Verify', href: '/purchase',
      subtitle: pending.length > 0 ? `${pending.length} item${pending.length !== 1 ? 's' : ''} · Check stock` : 'All clear',
      hasAlert: pending.length > 0, tone: TONE.amber, image: '/to-verify.webp',
    },
    {
      title: 'Low Stock', href: '/inventory',
      subtitle: lowStock.length > 0 ? `${lowStock.length} item${lowStock.length !== 1 ? 's' : ''} · Restock` : 'All good',
      hasAlert: lowStock.length > 0, tone: TONE.red, image: '/low-stock.webp',
    },
    {
      title: 'Complaints', href: '/complaints',
      subtitle: complaints > 0 ? `${complaints} to review` : 'Clear',
      hasAlert: complaints > 0, tone: TONE.red, image: '/Complaints.webp',
    },
  ]

  return (
    <HomeRefresh>
    <HomePurchaseRealtime />
    <HomeShiftRealtime />
    <main data-page-capture className="min-h-screen bg-gray-50 w-full mx-auto relative">
      {/* Header */}
      <div className="bg-white px-5 sm:px-8 pb-3 border-b border-gray-50" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{todayStr}</span>
          <div className="flex items-center gap-3">
            {/* "Open" status now lives in the My Today's Shift card below. */}
            <HomeBell baseCount={notificationCount} />
          </div>
        </div>
        {/* Name + role now live in the My Today's Shift card below. */}
      </div>

      <div className="px-5 sm:px-8 pt-4 pb-28 space-y-4">

        {/* ── My Today's Shift — personal shift status (carries the Open pill) ── */}
        <MyShiftCard
          name={staff.displayName}
          roleLabel="Kitchen"
          state={shiftView.state}
          timeLabel={shiftView.timeLabel}
          progressPercent={shiftView.progressPercent}
          isOpen={true}
        />

        {/* ── Hero: Purchase Cost Ratio — tappable, ratio-only for kitchen ── */}
        <KitchenCostRatioCard kpi={kpi} today={kpiToday} />

        {/* ── 2x2 module entry cards (same form as Front Desk Home) ── */}
        <div className="grid grid-cols-2 gap-3">
          {squares.map(card => (
            <NavLink
              key={card.title}
              href={card.href}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center overflow-hidden active:opacity-80"
            >
              {/* Image area */}
              <div className="w-full flex items-center justify-center pt-4 pb-1">
                {card.image && <img src={card.image} alt="" aria-hidden className="w-24 h-24 object-contain" />}
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

        {/* ── Today's work checklist ── */}
        <KitchenTasksWithPolling initialTasks={initialTasks} />

      </div>
    </main>
    </HomeRefresh>
  )
}
