'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { todayLocalStr, addDays, getMondayOfWeek } from '@/lib/dateUtils'
import { getBentoGestureAxis, getBentoPanelAction, getBentoPullState, getBentoSwipeThreshold, shouldShowBentoTodayShortcut } from '@/lib/bentoInteractionUtils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DatePicker from '../components/DatePicker'
import Dropdown from '../components/Dropdown'

type Order = {
  id: number
  customer_name: string
  phone: string
  address: string
  area: string
  menu_type: string
  items: string
  note: string
  amount: number
  paid: boolean
  status: string
  date: string
  time_slot?: string
}

const ALL = 'all'
const AREAS = ['Likas', 'Luyang', 'Lintas']
const AREA_OPTIONS = [{ value: ALL, label: 'All Areas' }, ...AREAS.map(area => ({ value: area, label: area }))]
const MENU_TYPES = [
  { value: 'standard', label: 'Standard', aliases: ['standard', 'Standard', '清单'] },
  { value: 'signature', label: 'Signature', aliases: ['signature', 'Signature', '风味'] },
  { value: 'vegetarian', label: 'Vegetarian', aliases: ['vegetarian', 'Vegetarian', '素食'] },
]
const TIME_SLOTS = [
  { value: 'lunch', label: 'Lunch', aliases: ['lunch', 'Lunch', '午餐'] },
  { value: 'dinner', label: 'Dinner', aliases: ['dinner', 'Dinner', '晚餐'] },
]
const MENU_TYPE_OPTIONS = [
  { value: ALL, label: 'All Types' },
  ...MENU_TYPES.map(({ value, label }) => ({ value, label })),
]
const TIME_SLOT_OPTIONS = [
  { value: ALL, label: 'All Slots' },
  ...TIME_SLOTS.map(({ value, label }) => ({ value, label })),
]

function matchesOption(value: string | undefined, selected: string, options: typeof MENU_TYPES | typeof TIME_SLOTS) {
  if (selected === ALL) return true
  const option = options.find(o => o.value === selected)
  if (!option) return value === selected
  return option.aliases.includes(value || '')
}

function getMenuTypeLabel(value: string | undefined) {
  return MENU_TYPES.find(type => type.aliases.includes(value || ''))?.label || value
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]
  return `${month} ${d.getDate()} ${weekday}`
}

export default function BentoClient({ initialOrders }: { initialOrders: Order[] }) {
  const router = useRouter()
  const today = todayLocalStr()
  const [orders, setOrders] = useState(initialOrders)
  const [loading, setLoading] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState(today)
  const [filterArea, setFilterArea] = useState(ALL)
  const [filterType, setFilterType] = useState(ALL)
  const [filterTime, setFilterTime] = useState(ALL)
  const [fetching, setFetching] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [mainPullOffset, setMainPullOffsetState] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const cache = useRef<Record<string, Order[]>>({ [today]: initialOrders })
  const datepickerAreaRef = useRef<HTMLDivElement>(null)
  const mainPullOffsetRef = useRef(0)
  const pullRefreshThreshold = 70

  const setMainPullOffset = useCallback((offset: number) => {
    mainPullOffsetRef.current = offset
    setMainPullOffsetState(offset)
  }, [])

  // ── Panel: always rendered, starts hidden via inline style ──
  const panelRef = useRef<HTMLDivElement>(null)
  const panelAnimRef = useRef<Animation | null>(null)
  const panelIsOpen = useRef(false)
  // Ref callback sets off-screen BEFORE first paint, avoiding Android blank flash
  const setPanelRef = useCallback((el: HTMLDivElement | null) => {
    panelRef.current = el
    if (el) el.style.transform = `translateX(${window.innerWidth}px)`
  }, [])

  // No body/html locking here. The Bento shell handles main-page gestures,
  // while the detail list keeps its own native scroll.

  // ── Panel animation ──
  function getPanelX(): number {
    const el = panelRef.current
    if (!el) return window.innerWidth
    const t = el.style.transform
    if (t && t !== 'none') {
      const m = t.match(/translateX\(([-\d.]+)px\)/)
      if (m) return parseFloat(m[1])
    }
    return new DOMMatrix(window.getComputedStyle(el).transform).m41
  }

  function animatePanel(toX: number, onDone?: () => void) {
    const el = panelRef.current
    if (!el) return
    if (panelAnimRef.current) {
      const mid = getPanelX()
      panelAnimRef.current.cancel()
      panelAnimRef.current = null
      el.style.transform = `translateX(${mid}px)`
    }
    const fromX = getPanelX()
    const dist = Math.abs(toX - fromX)
    if (dist < 1) { el.style.transform = `translateX(${toX}px)`; onDone?.(); return }
    const anim = el.animate(
      [{ transform: `translateX(${fromX}px)` }, { transform: `translateX(${toX}px)` }],
      { duration: Math.max(200, Math.min(350, dist * 0.75)), easing: 'cubic-bezier(0.3,0,0.1,1)', fill: 'none' }
    )
    panelAnimRef.current = anim
    anim.onfinish = () => {
      if (panelAnimRef.current !== anim) return
      panelAnimRef.current = null
      el.style.transform = `translateX(${toX}px)`
      onDone?.()
    }
  }

  function openPanel() {
    if (panelIsOpen.current) return
    panelIsOpen.current = true
    setDetailOpen(true)
    animatePanel(0)
  }

  function closePanel() {
    panelIsOpen.current = false
    setDetailOpen(false)
    animatePanel(window.innerWidth)
  }

  // ── Data ──
  const fetchDate = useCallback(async (date: string): Promise<Order[]> => {
    const { data } = await supabase.from('bento_orders').select('*').eq('date', date).order('id', { ascending: true })
    const result = data || []
    cache.current[date] = result
    return result
  }, [])

  const prefetchAdjacent = useCallback((date: string) => {
    const monday = getMondayOfWeek(date)
    const d = new Date(date + 'T00:00:00')
    const idx = d.getDay() === 0 ? 6 : d.getDay() - 1
    if (!cache.current[addDays(addDays(monday, -7), idx)]) fetchDate(addDays(addDays(monday, -7), idx))
    if (!cache.current[addDays(addDays(monday, 7), idx)]) fetchDate(addDays(addDays(monday, 7), idx))
  }, [fetchDate])

  async function handleDateChange(date: string) {
    setSelectedDate(date)
    if (cache.current[date] !== undefined) {
      setOrders(cache.current[date])
    } else {
      setFetching(true)
      setOrders(await fetchDate(date))
      setFetching(false)
    }
    prefetchAdjacent(date)
  }

  useEffect(() => { prefetchAdjacent(today) }, []) // eslint-disable-line

  const refreshSelectedDate = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    const result = await fetchDate(selectedDate)
    setOrders(result)
    router.refresh()
    await new Promise(resolve => setTimeout(resolve, 350))
    setRefreshing(false)
  }, [fetchDate, refreshing, router, selectedDate])

  // ── Gesture listeners on document ──
  useEffect(() => {
    let sx = 0, sy = 0
    let axis: 'h' | 'v' | null = null
    let tracking = false
    let mode: 'open' | 'close' | 'datepicker' | null = null

    function isInDatePicker(clientY: number) {
      const dp = datepickerAreaRef.current
      if (!dp) return false
      const r = dp.getBoundingClientRect()
      return clientY >= r.top && clientY <= r.bottom
    }

    function finishMainPull(dy: number) {
      const pullState = getBentoPullState({ dy, threshold: pullRefreshThreshold })
      if (pullState.shouldRefresh) {
        setMainPullOffset(pullRefreshThreshold)
        void refreshSelectedDate().finally(() => setMainPullOffset(0))
      } else {
        setMainPullOffset(0)
      }
    }

    function onStart(e: TouchEvent) {
      const t = e.touches[0]
      sx = t.clientX; sy = t.clientY
      axis = null; tracking = false; mode = null

      if (panelIsOpen.current) {
        tracking = true; mode = 'close'
        return
      }
      if (panelAnimRef.current) return

      tracking = true
      mode = isInDatePicker(t.clientY) ? 'datepicker' : 'open'
    }

    function onMove(e: TouchEvent) {
      if (!tracking) return
      const dx = e.touches[0].clientX - sx
      const dy = e.touches[0].clientY - sy
      if (!axis) axis = getBentoGestureAxis({ dx, dy })
      if (!axis) return

      if (axis === 'v') {
        if (mode === 'close') return
        e.preventDefault()
        setMainPullOffset(getBentoPullState({ dy, threshold: pullRefreshThreshold }).offset)
        return
      }

      if (mode === 'datepicker') return

      const el = panelRef.current
      if (mode === 'open' && dx < 0) {
        e.preventDefault()
        if (el) el.style.transform = `translateX(${Math.max(0, window.innerWidth + dx)}px)`
      } else if (mode === 'close') {
        e.preventDefault()
        if (dx > 0 && el) {
          const inScroll = !!(e.target as Element | null)?.closest('[data-scroll]')
          if (!inScroll) el.style.transform = `translateX(${Math.max(0, dx)}px)`
        }
      }
    }

    function onEnd(e: TouchEvent) {
      if (!tracking) return
      tracking = false

      const dx = e.changedTouches[0].clientX - sx
      const dy = e.changedTouches[0].clientY - sy

      if (axis === 'v' && mode !== 'close') {
        finishMainPull(dy)
        return
      }
      if (axis !== 'h' || mode === 'datepicker') return

      const action = getBentoPanelAction({
        dx,
        dy,
        threshold: getBentoSwipeThreshold(window.innerWidth),
        mode: mode === 'close' ? 'close' : 'open',
      })

      if (action === 'open') openPanel()
      else if (action === 'reset-closed') animatePanel(window.innerWidth)
      else if (action === 'close') closePanel()
      else if (action === 'reset-open') animatePanel(0)
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }
  }, [refreshSelectedDate, setMainPullOffset]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleStatus(order: Order) {
    const newStatus = order.status === 'completed' ? 'pending' : 'completed'
    setLoading(order.id)
    await supabase.from('bento_orders').update({ status: newStatus }).eq('id', order.id)
    const updated = orders.map(o => o.id === order.id ? { ...o, status: newStatus } : o)
    setOrders(updated); cache.current[selectedDate] = updated; setLoading(null)
  }

  async function togglePaid(order: Order) {
    const newPaid = !order.paid
    setLoading(order.id)
    await supabase.from('bento_orders').update({ paid: newPaid }).eq('id', order.id)
    const updated = orders.map(o => o.id === order.id ? { ...o, paid: newPaid } : o)
    setOrders(updated); cache.current[selectedDate] = updated; setLoading(null)
  }

  const filtered = orders.filter(o =>
    (filterArea === ALL || o.area === filterArea) &&
    matchesOption(o.menu_type, filterType, MENU_TYPES) &&
    matchesOption(o.time_slot, filterTime, TIME_SLOTS)
  )
  const total = orders.length
  const completed = orders.filter(o => o.status === 'completed').length
  const pending = orders.filter(o => o.status === 'pending').length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  const totalAmount = orders.reduce((sum, o) => sum + (o.amount || 0), 0)
  const unpaidCount = orders.filter(o => !o.paid).length
  const isToday = selectedDate === today
  const showTodayShortcut = shouldShowBentoTodayShortcut(selectedDate, today, detailOpen)
  const mainPullActive = mainPullOffset !== 0 || refreshing

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', overscrollBehavior: 'none', background: '#f9fafb' }}>
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 0,
          right: 0,
          height: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: mainPullActive ? 1 : 0,
          transform: `translateY(${Math.min(mainPullOffset, pullRefreshThreshold) - 28}px)`,
          transition: mainPullOffset === 0 || refreshing ? 'transform 0.25s ease, opacity 0.2s ease' : 'none',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        <span
          aria-label={refreshing ? 'Refreshing' : 'Pull to refresh'}
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: '2.5px solid #f97316',
            borderTopColor: 'transparent',
            animation: mainPullActive ? 'bento-refresh-spin 0.75s linear infinite' : 'none',
          }}
        />
      </div>

      <style>{`
        @keyframes bento-refresh-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          transform: `translateY(${mainPullOffset}px)`,
          transition: mainPullOffset === 0 || refreshing ? 'transform 0.28s cubic-bezier(0.2,0,0,1)' : 'none',
          willChange: 'transform',
        }}
      >
        <div className="bg-white px-4 py-3 flex items-center justify-between border-b" style={{ flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-500 text-xl">←</Link>
            <span className="font-semibold text-base tracking-wide">XIN BENTO</span>
          </div>
          <Link href="/bento/new" className="bg-orange-500 text-white text-sm px-3 py-1.5 rounded-full">+ New</Link>
        </div>

        <div ref={datepickerAreaRef} className="bg-white px-4 pt-4 pb-3" style={{ flexShrink: 0 }}>
          <DatePicker selectedDate={selectedDate} onDateChange={handleDateChange} />
        </div>

        <div className="flex-1 px-4 pt-3 flex flex-col gap-3 overflow-hidden">
          <div className="border-t border-gray-100 pt-3">
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { val: total, label: 'Orders', color: 'text-gray-900' },
                { val: completed, label: 'Done', color: 'text-green-500' },
                { val: pending, label: 'Pending', color: 'text-orange-500' },
                { val: totalAmount > 0 ? totalAmount : '—', label: 'Amount', color: 'text-blue-500' },
              ].map(({ val, label, color }) => (
                <div key={label} className="text-center">
                  <div className={`text-2xl font-bold ${color}`}>{val}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${percent}%` }} />
            </div>
            <div className="text-xs text-gray-400 mt-1 text-right">{percent}% complete</div>
          </div>

          <div className="flex gap-2">
            <Link href="/bento/unpaid" className="flex-1 bg-white rounded-xl p-3 shadow-sm flex items-center gap-2 border border-gray-100">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
              </svg>
              <div>
                <div className="text-xs font-medium text-gray-700">Unpaid</div>
                <div className="text-xs text-gray-400">{unpaidCount > 0 ? `${unpaidCount} pending` : 'All paid'}</div>
              </div>
            </Link>
            <Link href="/bento/weekly-menu" className="flex-1 bg-white rounded-xl p-3 shadow-sm flex items-center gap-2 border border-gray-100">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2"/>
                <line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>
              </svg>
              <div>
                <div className="text-xs font-medium text-gray-700">Weekly Menu</div>
                <div className="text-xs text-gray-400">This week</div>
              </div>
            </Link>
          </div>

          <button onClick={openPanel} className="w-full flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm">
            <span className="text-sm text-gray-600">
              {fetching ? 'Loading...' : total > 0 ? `View all orders for ${formatDate(selectedDate)}` : 'No orders'}
            </span>
            <span className="text-gray-400 text-sm">→</span>
          </button>
        </div>
      </div>

      {/* Detail Panel */}
      <div ref={setPanelRef} className="fixed inset-0 bg-white flex flex-col" style={{ zIndex: 20 }}>
        <div className="bg-white px-4 py-3 flex items-center justify-between border-b" style={{ flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <button onClick={closePanel} className="text-gray-500 text-xl">←</button>
            <span className="font-semibold text-base">{formatDate(selectedDate)}</span>
          </div>
          <Link href="/bento/new" className="bg-orange-500 text-white text-sm px-3 py-1.5 rounded-full">+ New</Link>
        </div>

        <div className="px-4 pt-3 pb-2 flex gap-2" style={{ flexShrink: 0 }}>
          <Dropdown value={filterArea} onChange={setFilterArea} options={AREA_OPTIONS} />
          <Dropdown value={filterType} onChange={setFilterType} options={MENU_TYPE_OPTIONS} />
          <Dropdown value={filterTime} onChange={setFilterTime} options={TIME_SLOT_OPTIONS} />
        </div>

        <div className="px-4 pb-2" style={{ flexShrink: 0 }}>
          <span className="text-sm font-semibold text-gray-700">
            Orders {filtered.length > 0 && <span className="text-gray-400 font-normal">({filtered.length})</span>}
          </span>
        </div>

        <div data-scroll className="flex-1 overflow-y-auto px-4 pb-8 space-y-3" style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' }}>
          {fetching && <div className="text-center text-gray-400 py-4">Loading...</div>}
          {!fetching && filtered.length === 0 && <div className="text-center text-gray-400 py-8">No orders</div>}
          {!fetching && filtered.map((order) => {
            const isDelivery = !!order.address
            return (
              <div key={order.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="font-semibold text-gray-900">{order.customer_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${isDelivery ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-500'}`}>
                    {isDelivery ? 'Delivery' : 'Pickup'}
                  </span>
                  {order.menu_type && <span className="text-xs bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full">{getMenuTypeLabel(order.menu_type)}</span>}
                </div>
                {order.area && <div className="text-xs text-gray-400 mb-1">📍 {order.area}</div>}
                <div className="text-sm text-gray-600 mb-1">📦 {order.items}</div>
                {order.note && <div className="text-sm text-orange-500 mb-1">📝 {order.note}</div>}
                {order.address && <div className="text-sm text-gray-400 mb-1">{order.address}</div>}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-gray-400">📞 {order.phone}</span>
                  <span className="font-semibold text-gray-900">RM {order.amount}</span>
                </div>
                {isToday && (
                  <button onClick={() => toggleStatus(order)} disabled={loading === order.id}
                    className={`mt-3 w-full py-2 rounded-xl text-sm font-medium ${order.status === 'completed' ? 'bg-gray-100 text-gray-500' : 'bg-orange-500 text-white'}`}>
                    {loading === order.id ? 'Updating...' : order.status === 'completed' ? '✓ Completed' : 'Mark Completed'}
                  </button>
                )}
                <button onClick={() => togglePaid(order)} disabled={loading === order.id}
                  className={`mt-2 w-full py-2 rounded-xl text-sm font-medium border ${order.paid ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-500 border-red-200'}`}>
                  {order.paid ? '✓ Paid' : 'Unpaid — tap to mark'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {showTodayShortcut && (
        <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 30, pointerEvents: 'auto' }}>
          <button onClick={() => handleDateChange(today)}
            style={{ padding: '10px 40px', backgroundColor: '#60a5fa', color: '#fff', fontSize: 14, fontWeight: 600, borderRadius: 999, border: 'none', boxShadow: '0 4px 16px rgba(96,165,250,0.5)', cursor: 'pointer' }}>
            TODAY
          </button>
        </div>
      )}
    </div>
  )
}
