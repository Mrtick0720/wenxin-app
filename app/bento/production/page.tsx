'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback, useRef } from 'react'
import BackButton from '../../components/BackButton'
import { supabase } from '@/lib/supabase/client'
import { todayLocalStr } from '@/lib/dateUtils'
import { useStaff } from '@/app/components/StaffProvider'
import {
  aggregateProductionCards,
  updateProductionLineCompletion,
  type ProductionCard,
} from '@/lib/bentoProduction'
import {
  applyProductionOrderUpdate,
  type BentoOrderUpdatedDetail,
} from '@/lib/bentoProductionUpdate'

type Order = {
  id: number
  customer_name?: string
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
const RefreshIcon = (s?: number) => ico(<><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></>, s)
const ChevronIcon = (s?: number) => ico(<path d="M6 9l6 6 6-6" />, s)
const CheckIcon = (s?: number) => ico(<path d="M5 12l5 5L20 6" />, s)
const CircleIcon = (s?: number) => ico(<circle cx="12" cy="12" r="9" />, s)

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

  const roleRef = useRef(staff?.role)
  roleRef.current = staff?.role
  const selectedDateRef = useRef(selectedDate)
  selectedDateRef.current = selectedDate

  const loadData = useCallback(async (date: string) => {
    setLoading(true)
    const source = roleRef.current === 'kitchen' ? 'bento_kitchen_orders' : 'bento_orders'
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
  }, []) // stable — reads role via ref

  // Reload whenever date changes
  useEffect(() => {
    loadData(selectedDate)
  }, [loadData, selectedDate])

  // Single long-lived channel + listeners — never torn down on date change
  useEffect(() => {
    const channel = supabase
      .channel('production-orders')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bento_orders' },
        () => { loadData(selectedDateRef.current) }
      )
      .subscribe()

    function onOrderUpdated(e: Event) {
      const detail = (e as CustomEvent<BentoOrderUpdatedDetail<Order>>).detail
      const dates = detail?.dates ?? (detail?.date ? [detail.date] : [])
      const cur = selectedDateRef.current
      if (detail?.order) {
        setOrders(current => applyProductionOrderUpdate(current, cur, detail))
        setUpdatedAt(nowUpdatedStr())
        return
      }
      if (dates.length === 0 || dates.includes(cur)) loadData(cur)
    }
    function refreshVisible() {
      if (document.visibilityState === 'visible') loadData(selectedDateRef.current)
    }
    window.addEventListener('bento-order-updated', onOrderUpdated)
    window.addEventListener('focus', refreshVisible)
    document.addEventListener('visibilitychange', refreshVisible)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('bento-order-updated', onOrderUpdated)
      window.removeEventListener('focus', refreshVisible)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [loadData]) // runs once on mount

  const totalPortions = orders.reduce((s, o) => s + (o.quantity ?? 1), 0)
  const allProductionCards = aggregateProductionCards(orders)
  const completedCount = allProductionCards.filter(card => card.done).length
  const totalCount = allProductionCards.length

  // Production summary aggregated by bento name
  const summary = allProductionCards.map(card => ({ name: card.label, qty: card.totalQty }))

  async function toggleProductionCard(card: ProductionCard) {
    const nextDone = !card.done
    const updates = new Map<number, { bento_items: string; status: string }>()

    for (const customer of card.customers) {
      const order = orders.find(item => item.id === customer.orderId)
      if (!order) continue
      const result = updateProductionLineCompletion(order.bento_items, customer.lineKey, nextDone, order)
      updates.set(order.id, {
        bento_items: result.bentoItems,
        status: result.orderCompleted ? 'completed' : 'pending',
      })
    }

    setOrders(prev => prev.map(order => {
      const update = updates.get(order.id)
      return update ? { ...order, ...update } : order
    }))
    setUpdatedAt(nowUpdatedStr())

    const results = await Promise.all(
      Array.from(updates.entries()).map(([id, update]) =>
        supabase.from('bento_orders').update(update).eq('id', id)
      )
    )
    if (results.some(result => result.error)) {
      await loadData(selectedDate)
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

        {!loading && allProductionCards.map((card, index) => {
          const done = card.done
          const seqLabel = String.fromCharCode(65 + index)
          return (
            <div key={card.key} className="rounded-[10px] overflow-hidden mb-2.5"
              style={{ border: '1px solid #334155', background: done ? '#0d1f12' : '#1e293b', opacity: done ? 0.7 : 1 }}>
              <div style={{ padding: '12px 11px' }}>
                <div className="flex items-baseline justify-between gap-1.5 mb-1.5">
                  <span className="flex items-baseline gap-1.5 flex-1 min-w-0">
                    <span className="text-[17px] font-bold flex-shrink-0 w-5 text-center" style={{ color: '#f97316' }}>{seqLabel}</span>
                    <span className="text-[17px] font-semibold leading-tight" style={{ color: '#f1f5f9' }}>{card.compartment_a || card.label}</span>
                  </span>
                  <span className="text-[21px] font-medium whitespace-nowrap flex-shrink-0" style={{ color: '#f97316' }}>×{card.totalQty}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex flex-col gap-1">
                    {card.compartment_b && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] flex-shrink-0 w-5 text-center" aria-label="Vegetable">🥬</span>
                        <span className="text-[13px]" style={{ color: '#f1f5f9' }}>{card.compartment_b}</span>
                      </div>
                    )}
                    {card.compartment_c && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] flex-shrink-0 w-5 text-center" aria-label="Rice">🍚</span>
                        <span className="text-[13px]" style={{ color: '#f1f5f9' }}>{card.compartment_c}</span>
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {card.customers.map(customer => {
                        const order = orders.find(item => item.id === customer.orderId)
                        const service = order?.fulfillment_type === 'pickup' ? 'Pickup' : 'Delivery'
                        const time = order?.delivery_or_pickup_time?.slice(0, 5)
                        return (
                          <span key={`${customer.orderId}-${customer.lineKey}`} className="text-[12px]" style={{ color: '#94a3b8' }}>
                            {customer.customerName} ×{customer.qty} · {service}{time ? ` ${time}` : ''}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  <button onClick={() => toggleProductionCard(card)}
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
        <div className="h-4" />
      </div>
    </div>
  )
}
