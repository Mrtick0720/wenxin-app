'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback } from 'react'
import BackButton from '../../components/BackButton'
import { supabase } from '@/lib/supabase/client'
import { todayLocalStr } from '@/lib/dateUtils'
import { useStaff } from '@/app/components/StaffProvider'

type Order = {
  id: number
  date: string
  status: string
  quantity?: number
  bento_items?: string | null
  compartment_a?: string | null
  compartment_b?: string | null
  compartment_c?: string | null
  ready_by?: string | null
  fulfillment_type?: string | null
  delivery_or_pickup_time?: string | null
  // legacy fallbacks
  items?: string | null
  menu_type?: string | null
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDateFull(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAYS[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`
}

// "13:30" / "13:30:00" → "13:30" (24-hour format)
function fmtTime(t: string | null | undefined): string {
  if (!t) return ''
  const parts = t.split(':')
  const h = parts[0].padStart(2, '0')
  const m = (parts[1] ?? '00').padStart(2, '0')
  if (Number.isNaN(parseInt(h, 10))) return ''
  return `${h}:${m}`
}

function nowUpdatedStr(): string {
  const dt = new Date()
  const h = String(dt.getHours()).padStart(2, '0')
  const m = String(dt.getMinutes()).padStart(2, '0')
  return `Updated ${h}:${m}`
}

// ---- inline icons (no external font dependency) ----
const ico = (path: React.ReactNode, size = 14) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {path}
  </svg>
)
const ClockIcon = (s?: number) => ico(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, s)
const TruckIcon = (s?: number) => ico(<><path d="M3 17V6h11v11" /><path d="M14 9h4l3 3v5h-7" /><circle cx="7.5" cy="17.5" r="1.5" /><circle cx="17.5" cy="17.5" r="1.5" /></>, s)
const StoreIcon = (s?: number) => ico(<><path d="M4 9h16l-1-5H5L4 9Z" /><path d="M5 9v11h14V9" /><path d="M10 20v-5h4v5" /></>, s)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PackageIcon = (s?: number) => ico(<><path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" /><path d="M4 7l8 4 8-4" /><path d="M12 11v10" /></>, s)
const RefreshIcon = (s?: number) => ico(<><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></>, s)
const ChevronIcon = (s?: number) => ico(<path d="M6 9l6 6 6-6" />, s)
const CheckIcon = (s?: number) => ico(<path d="M5 12l5 5L20 6" />, s)
const CircleIcon = (s?: number) => ico(<circle cx="12" cy="12" r="9" />, s)

type Theme = {
  headerBg: string; border: string; label: string; time: string; ampm: string
  divider: string; infoIcon: string; infoText: string; infoTime: string
}
const ORANGE: Theme = { headerBg: '#431407', border: 'transparent', label: '#fdba74', time: '#f97316', ampm: '#fb923c', divider: '#7c2d12', infoIcon: '#fdba74', infoText: '#fed7aa', infoTime: '#fbbf24' }
const BLUE: Theme = { headerBg: '#0c1a2e', border: '#1e3a5f', label: '#93c5fd', time: '#60a5fa', ampm: '#3b82f6', divider: '#1e3a5f', infoIcon: '#93c5fd', infoText: '#bfdbfe', infoTime: '#7dd3fc' }
const GRAY: Theme = { headerBg: '#1e293b', border: '#334155', label: '#94a3b8', time: '#cbd5e1', ampm: '#64748b', divider: '#334155', infoIcon: '#94a3b8', infoText: '#cbd5e1', infoTime: '#cbd5e1' }

type Group = {
  key: string
  ready_by: string | null
  fulfillment_type: string | null
  delivery_or_pickup_time: string | null
  rows: Order[]
}

function defaultProductionDate(): string {
  const now = new Date()
  const today = todayLocalStr()
  if (now.getHours() >= 15) {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().slice(0, 10)
  }
  return today
}

export default function ProductionPage() {
  const staff = useStaff()
  const today = todayLocalStr()
  const [selectedDate, setSelectedDate] = useState(defaultProductionDate)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [updatedAt, setUpdatedAt] = useState('')

  const loadData = useCallback(async (date: string) => {
    setLoading(true)
    const source = staff?.role === 'kitchen' ? 'bento_kitchen_orders' : 'bento_orders'
    const { data } = await supabase
      .from(source)
      .select('*')
      .eq('date', date)
      .neq('status', 'canceled')
      .order('ready_by', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
    setOrders((data || []) as Order[])
    setUpdatedAt(nowUpdatedStr())
    setLoading(false)
  }, [staff?.role])

  useEffect(() => {
    loadData(selectedDate)

    // Always subscribe to bento_orders (the base table) — views are not replication targets
    const channelName = `production-${selectedDate}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bento_orders' },
        () => { loadData(selectedDate) }
      )
      .subscribe()

    // Also listen for in-app edit/new events (covers kitchen role where realtime RLS may block)
    function onOrderUpdated(e: Event) {
      const date = (e as CustomEvent<{ date?: string }>).detail?.date
      if (!date || date === selectedDate) loadData(selectedDate)
    }
    window.addEventListener('bento-order-updated', onOrderUpdated)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('bento-order-updated', onOrderUpdated)
    }
  }, [loadData, selectedDate])

  const bentoName = (o: Order) => {
    const raw = o.bento_items?.trim()
    // bento_items may now contain structured JSON — ignore it for display
    if (raw && !raw.startsWith('{')) return raw
    return o.items?.trim() || o.menu_type || 'Bento'
  }

  const totalPortions = orders.reduce((s, o) => s + (o.quantity ?? 1), 0)
  const completedCount = orders.filter(o => o.status === 'completed').length
  const totalCount = orders.length

  // Production summary aggregated by bento name
  const summary = (() => {
    const map = new Map<string, number>()
    for (const o of orders) {
      const name = bentoName(o)
      map.set(name, (map.get(name) ?? 0) + (o.quantity ?? 1))
    }
    return Array.from(map.entries()).map(([name, qty]) => ({ name, qty }))
  })()

  // Group rows into deadline blocks by (ready_by, fulfillment, times)
  const groups = (() => {
    const map = new Map<string, Group>()
    for (const o of orders) {
      const key = [o.ready_by ?? '', o.fulfillment_type ?? '', o.delivery_or_pickup_time ?? ''].join('|')
      let g = map.get(key)
      if (!g) {
        g = { key, ready_by: o.ready_by ?? null, fulfillment_type: o.fulfillment_type ?? null, delivery_or_pickup_time: o.delivery_or_pickup_time ?? null, rows: [] }
        map.set(key, g)
      }
      g.rows.push(o)
    }
    const arr = Array.from(map.values())
    arr.sort((a, b) => {
      if (a.ready_by && b.ready_by) return a.ready_by.localeCompare(b.ready_by)
      if (a.ready_by) return -1
      if (b.ready_by) return 1
      return 0
    })
    return arr
  })()

  async function toggleStatus(o: Order) {
    const next = o.status === 'completed' ? 'pending' : 'completed'
    setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: next } : x))
    setUpdatedAt(nowUpdatedStr())
    const { error } = await supabase.from('bento_orders').update({ status: next }).eq('id', o.id)
    if (error) {
      // revert on failure
      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: o.status } : x))
    }
  }

  // Date picker calendar state
  const calBase = new Date(selectedDate + 'T00:00:00')
  const [calYear, setCalYear] = useState(calBase.getFullYear())
  const [calMonth, setCalMonth] = useState(calBase.getMonth())
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDay = new Date(calYear, calMonth, 1).getDay()

  return (
    <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0f172a' }}>
      {/* Header */}
      <div style={{ background: '#1e293b', flexShrink: 0, borderBottom: '1px solid #334155' }} className="px-4 py-2.5 flex items-center gap-3">
        <BackButton href="/bento" />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-medium text-slate-100 leading-tight">Production sheet</div>
          <button onClick={() => setShowDatePicker(s => !s)} className="text-[13px] text-slate-400 leading-tight mt-0.5">
            {formatDateFull(selectedDate)} <span style={{ color: '#475569' }}>▾</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] whitespace-nowrap" style={{ color: '#64748b' }}>{updatedAt}</span>
          <button onClick={() => loadData(selectedDate)} aria-label="Refresh production data" style={{ color: '#94a3b8' }} className="p-0.5">
            {RefreshIcon(16)}
          </button>
        </div>
      </div>

      {/* Date picker dropdown */}
      {showDatePicker && (
        <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', flexShrink: 0 }} className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-lg" style={{ background: '#334155' }}>‹</button>
            <span className="text-white font-medium text-sm">{MONTHS_SHORT[calMonth]} {calYear}</span>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-lg" style={{ background: '#334155' }}>›</button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => <div key={d} className="text-center text-xs py-1" style={{ color: '#64748b' }}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isSel = dateStr === selectedDate
              const isToday = dateStr === today
              return (
                <div key={day} className="flex justify-center py-0.5">
                  <button onClick={() => { setSelectedDate(dateStr); setShowDatePicker(false) }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                    style={{ background: isSel ? '#f97316' : 'transparent', color: isSel ? '#fff' : isToday ? '#f97316' : '#cbd5e1', border: isToday && !isSel ? '1px solid #f97316' : 'none' }}>
                    {day}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="px-3 pt-2.5 flex gap-2" style={{ flexShrink: 0 }}>
        <button onClick={() => setShowSummary(s => !s)}
          style={{ background: '#1e293b', border: '1px solid #334155', minWidth: 80 }}
          className="rounded-[10px] px-3 py-2 text-center flex-shrink-0">
          <div className="text-[11px] mb-px" style={{ color: '#64748b' }}>Portions</div>
          <div className="text-[30px] font-medium leading-none" style={{ color: '#f97316' }}>{totalPortions}</div>
          <div className="flex items-center justify-center gap-0.5 mt-1" style={{ color: '#475569' }}>
            <span className="text-[11px]">Summary</span>
            <span style={{ transform: showSummary ? 'rotate(180deg)' : 'none', display: 'inline-flex' }}>{ChevronIcon(11)}</span>
          </div>
        </button>
        <div style={{ background: '#1e293b', border: '1px solid #334155' }} className="rounded-[10px] px-3 py-2 flex-1">
          <div className="text-[11px] mb-0.5" style={{ color: '#64748b' }}>Completed</div>
          <div className="text-[14px] font-medium leading-tight" style={{ color: completedCount === totalCount && totalCount > 0 ? '#22c55e' : '#f1f5f9' }}>
            {completedCount} / {totalCount} types
          </div>
          <div className="mt-1.5 rounded-[3px] h-[3px]" style={{ background: '#334155' }}>
            <div className="h-[3px] rounded-[3px]" style={{ width: `${totalCount ? Math.round(completedCount / totalCount * 100) : 0}%`, background: completedCount === totalCount && totalCount > 0 ? '#22c55e' : '#f97316' }} />
          </div>
        </div>
      </div>

      {/* Summary dropdown */}
      {showSummary && summary.length > 0 && (
        <div className="px-3 pt-2" style={{ flexShrink: 0 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155' }} className="rounded-[10px] overflow-hidden">
            <div className="px-3 py-1.5" style={{ borderBottom: '1px solid #334155' }}>
              <span className="text-[11px] font-medium" style={{ color: '#94a3b8' }}>Today&apos;s production summary</span>
            </div>
            <div className="px-3 py-1.5">
              {summary.map(s => (
                <div key={s.name} className="flex items-baseline gap-1 py-1">
                  <span className="text-[13px] whitespace-nowrap" style={{ color: '#cbd5e1' }}>{s.name}</span>
                  <span className="flex-1 mb-0.5" style={{ borderBottom: '1px dotted #475569' }} />
                  <span className="text-[16px] font-medium" style={{ color: '#f97316' }}>{s.qty}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Scrollable production list */}
      <div className="flex-1 overflow-y-auto px-3 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-sm" style={{ color: '#64748b' }}>Loading…</div>
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-sm" style={{ color: '#64748b' }}>No production for this date</div>
          </div>
        )}

        {!loading && groups.map((g, gi) => {
          const theme: Theme = g.ready_by ? (gi === 0 ? ORANGE : BLUE) : GRAY
          const isPickup = g.fulfillment_type === 'pickup'
          return (
            <div key={g.key} className="rounded-[10px] overflow-hidden"
              style={{ border: `1px solid ${theme.border === 'transparent' ? '#334155' : theme.border}`, marginBottom: gi === groups.length - 1 ? 4 : 11 }}>
              {/* Compact single-line header — two equal halves */}
              <div className="flex items-center px-3 py-2" style={{ background: theme.headerBg }}>
                <div className="flex items-center gap-1.5 flex-1">
                  <span style={{ color: theme.time, flexShrink: 0 }}>{ClockIcon(13)}</span>
                  <span className="text-[11px] font-medium tracking-wide flex-shrink-0" style={{ color: theme.label }}>READY BY</span>
                  <span className="text-[14px] font-semibold" style={{ color: theme.time }}>{g.ready_by ? fmtTime(g.ready_by) : '—'}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-1">
                  <span style={{ color: theme.infoIcon, flexShrink: 0 }}>{isPickup ? StoreIcon(13) : TruckIcon(13)}</span>
                  <span className="text-[13px] capitalize" style={{ color: theme.infoText }}>{g.fulfillment_type || 'Delivery'}</span>
                  {g.delivery_or_pickup_time && <span className="text-[13px] font-medium" style={{ color: theme.infoTime }}>{fmtTime(g.delivery_or_pickup_time)}</span>}
                </div>
              </div>

              {/* Bento order rows */}
              {g.rows.map((o, ri) => {
                const done = o.status === 'completed'
                const seq = groups.slice(0, gi).reduce((s, gg) => s + gg.rows.length, 0) + ri + 1
                const seqLabel = String.fromCharCode(64 + seq)
                return (
                  <div key={o.id} style={{ background: done ? '#0d1f12' : '#1e293b', opacity: done ? 0.7 : 1, borderTop: `1px solid ${theme.divider}` }}>
                    <div style={{ padding: '10px 11px' }}>
                      <div className="flex items-baseline justify-between gap-1.5 mb-1.5">
                        <span className="flex items-baseline gap-1.5 flex-1 min-w-0">
                          <span className="text-[17px] font-bold flex-shrink-0 w-5 text-center" style={{ color: '#f97316' }}>{seqLabel}</span>
                          <span className="text-[17px] font-semibold leading-tight" style={{ color: '#f1f5f9' }}>{o.compartment_a?.trim() || bentoName(o)}</span>
                        </span>
                        <span className="text-[21px] font-medium whitespace-nowrap flex-shrink-0" style={{ color: '#f97316' }}>×{o.quantity ?? 1}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex flex-col gap-1">
                          {o.compartment_b && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[14px] flex-shrink-0 w-5 text-center" aria-label="Vegetable">🥬</span>
                              <span className="text-[13px]" style={{ color: '#f1f5f9' }}>{o.compartment_b}</span>
                            </div>
                          )}
                          {o.compartment_c && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[14px] flex-shrink-0 w-5 text-center" aria-label="Rice">🍚</span>
                              <span className="text-[13px]" style={{ color: '#f1f5f9' }}>{o.compartment_c}</span>
                            </div>
                          )}
                          {!o.compartment_a && !o.compartment_b && !o.compartment_c && o.items && (
                            <span className="text-[13px]" style={{ color: '#94a3b8' }}>{o.items}</span>
                          )}
                        </div>
                        <button onClick={() => toggleStatus(o)}
                          className="flex-shrink-0 rounded-[8px] flex flex-col items-center gap-0.5"
                          style={{ background: done ? '#052e16' : '#0f172a', border: `1px solid ${done ? '#14532d' : '#2d3748'}`, padding: '8px 10px', minWidth: 58 }}>
                          <span style={{ color: done ? '#22c55e' : '#475569' }}>{done ? CheckIcon(18) : CircleIcon(18)}</span>
                          <span className="text-[11px]" style={{ color: done ? '#22c55e' : '#475569' }}>{done ? 'Done' : 'Pending'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
        <div className="h-4" />
      </div>
    </div>
  )
}
