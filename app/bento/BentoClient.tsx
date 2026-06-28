'use client'

/* eslint-disable react-hooks/refs */

import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import BackButton from '../components/BackButton'
import { supabase } from '@/lib/supabase/client'
import { todayLocalStr, addDays, getMondayOfWeek } from '@/lib/dateUtils'
import { getBentoGestureAxis, getBentoPanelAction, getBentoPullState, getBentoSwipeThreshold, shouldShowBentoTodayShortcut } from '@/lib/bentoInteractionUtils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DatePicker from '../components/DatePicker'
import Dropdown from '../components/Dropdown'
import type { StaffRole } from '@/lib/auth/types'
import { useNavigation } from '../components/NavigationStack'
import { CenteredSpinner } from '../components/Spinner'

const NewBentoOrder    = lazy(() => import('@/app/bento/new/page'))
const UnpaidPage       = lazy(() => import('@/app/bento/unpaid/page'))
const WeeklyMenuPage   = lazy(() => import('@/app/bento/weekly-menu/page'))
const ProductionPage   = lazy(() => import('@/app/bento/production/page'))
const CustomersClient  = lazy(() => import('@/app/bento/customers/CustomersClient'))
const EditOrderPage    = lazy(() => import('@/app/bento/orders/[id]/edit/page'))

type Order = {
  id: number
  customer_name: string
  phone?: string
  address: string
  area: string
  fulfillment_type?: string
  menu_type: string
  items: string
  compartment_a?: string | null
  note: string
  amount?: number
  paid?: boolean
  status: string
  date: string
  time_slot?: string
  quantity?: number
  customer_id?: number | null
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

type PanelMode = 'orders' | 'portions' | 'pending' | 'done'

export default function BentoClient({
  initialOrders,
  role,
}: {
  initialOrders: Order[]
  role: StaffRole
}) {
  const router = useRouter()
  const { push, currentPath } = useNavigation()
  const isKitchen = role === 'kitchen'
  const isOwner = role === 'owner'
  const canViewFinancialDetails = role !== 'kitchen'
  const canManageCustomers = role !== 'kitchen'
  const canOpenProduction = role !== 'front_desk'
  const today = todayLocalStr()
  const defaultDate = new Date().getHours() >= 15 ? addDays(today, 1) : today
  const pageFallback = <div style={{ position: 'fixed', inset: 0, background: '#f9fafb' }} />
  const [orders, setOrders] = useState(initialOrders)
  const [loading, setLoading] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null)
  const [selectedDate, setSelectedDate] = useState(defaultDate)
  const [filterArea, setFilterArea] = useState(ALL)
  const [filterType, setFilterType] = useState(ALL)
  const [filterTime, setFilterTime] = useState(ALL)
  const [fetching, setFetching] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [panelMode, setPanelMode] = useState<PanelMode>('orders')
  const [mainPullOffset, setMainPullOffsetState] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const cache = useRef<Record<string, Order[]>>({ [today]: initialOrders })
  const rootRef = useRef<HTMLDivElement>(null)
  const datepickerAreaRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const mainPullOffsetRef = useRef(0)
  const pullRefreshThreshold = 70

  const setMainPullOffset = useCallback((offset: number) => {
    mainPullOffsetRef.current = offset
    setMainPullOffsetState(offset)
  }, [])

  // ── Panel: always rendered; React state controls its resting position ──
  const panelRef = useRef<HTMLDivElement>(null)
  const panelIsOpen = useRef(false)

  // No body/html locking here. The Bento shell handles main-page gestures,
  // while the detail list keeps its own native scroll.

  function snapPanel(open: boolean) {
    const el = panelRef.current
    if (!el) return
    el.style.transition = 'transform 0.28s cubic-bezier(0.3,0,0.1,1)'
    el.style.transform = open ? 'translateX(0)' : 'translateX(100%)'
  }

  function openPanel(mode: PanelMode = 'orders') {
    if (panelIsOpen.current) return
    setPanelMode(mode)
    panelIsOpen.current = true
    setDetailOpen(true)
    requestAnimationFrame(() => snapPanel(true))
  }

  function closePanel() {
    panelIsOpen.current = false
    setDetailOpen(false)
    requestAnimationFrame(() => snapPanel(false))
  }

  // ── Data ──
  const fetchDate = useCallback(async (date: string): Promise<Order[]> => {
    const source = isKitchen ? 'bento_kitchen_orders' : 'bento_orders'
    const { data } = await supabase.from(source).select('*').eq('date', date).neq('status', 'canceled').order('id', { ascending: true })
    const result = (data || []) as Order[]
    cache.current[date] = result
    return result
  }, [isKitchen])

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

  // Invalidate cache and re-fetch when an edit/new order completes
  useEffect(() => {
    function onOrderUpdated(e: Event) {
      const date = (e as CustomEvent<{ date?: string }>).detail?.date ?? selectedDate
      delete cache.current[date]
      fetchDate(date).then(data => {
        cache.current[date] = data
        if (date === selectedDate) setOrders(data)
      })
    }
    window.addEventListener('bento-order-updated', onOrderUpdated)
    return () => window.removeEventListener('bento-order-updated', onOrderUpdated)
  }, [fetchDate, selectedDate])

  // Self-fetch today's orders when rendered via navigation stack (initialOrders will be empty)
  useEffect(() => {
    if (defaultDate !== today) {
      // After 15:00 the default view is tomorrow — fetch it, and also pre-fetch today
      fetchDate(defaultDate).then(data => { setOrders(data); cache.current[defaultDate] = data })
      fetchDate(today).then(data => { cache.current[today] = data })
    } else if (initialOrders.length === 0) {
      fetchDate(today).then(data => { setOrders(data); cache.current[today] = data })
    }
    prefetchAdjacent(defaultDate)
    // Preload edit page chunk so it opens instantly
    import('@/app/bento/orders/[id]/edit/page')
  }, []) // eslint-disable-line

  const refreshSelectedDate = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    const result = await fetchDate(selectedDate)
    setOrders(result)
    router.refresh()
    await new Promise(resolve => setTimeout(resolve, 350))
    setRefreshing(false)
  }, [fetchDate, refreshing, router, selectedDate])

  // ── Gesture system ──
  // Key architecture for Android compatibility:
  // 1. When panel is CLOSED → Bento-root touchmove for main-page gestures
  // 2. When panel is OPEN   → NO root touchmove (avoids Android scroll deadlock)
  // 3. Scroll area touchmove is stopped at source → browser scrolls natively
  // 4. Panel touchmove handles swipe-to-close from header/filter areas
  useEffect(() => {
    const rootEl = rootRef.current
    if (!rootEl) return

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

      tracking = true
      mode = isInDatePicker(t.clientY) ? 'datepicker' : 'open'
    }

    function onMove(e: TouchEvent) {
      if (!tracking) return
      const dx = e.touches[0].clientX - sx
      const dy = e.touches[0].clientY - sy

      if (mode === 'close') {
        if (dx > 20 && dx > Math.abs(dy) * 1.5) {
          e.preventDefault()
          const el = panelRef.current
          if (el) {
            el.style.transition = 'none'
            el.style.transform = `translateX(${dx}px)`
          }
        }
        return
      }

      if (!axis) {
        axis = getBentoGestureAxis({ dx, dy })
      }
      if (!axis) return

      if (axis === 'v') {
        e.preventDefault()
        setMainPullOffset(getBentoPullState({ dy, threshold: pullRefreshThreshold }).offset)
        return
      }

      if (mode === 'datepicker') return

      const el = panelRef.current
      if (mode === 'open' && dx < 0) {
        e.preventDefault()
        if (el) {
          el.style.transition = 'none'
          el.style.transform = `translateX(${Math.max(0, window.innerWidth + dx)}px)`
        }
      }
    }

    function onEnd(e: TouchEvent) {
      if (!tracking) return
      tracking = false

      const dx = e.changedTouches[0].clientX - sx
      const dy = e.changedTouches[0].clientY - sy

      if (mode === 'close') {
        const threshold = getBentoSwipeThreshold(window.innerWidth)
        if (dx > threshold) {
          closePanel()
        } else {
          snapPanel(true)
        }
        return
      }

      if (axis === 'v') {
        finishMainPull(dy)
        return
      }
      if (axis !== 'h' || mode === 'datepicker') return

      const action = getBentoPanelAction({
        dx,
        dy,
        threshold: getBentoSwipeThreshold(window.innerWidth),
        mode: 'open',
      })

      if (action === 'open') openPanel()
      else if (action === 'reset-closed') snapPanel(false)
    }

    // ── Attach listeners to the RIGHT elements ──
    // Scope gesture tracking to Bento itself. Stack pages pushed above Bento are
    // siblings, so their native scrolling cannot be cancelled by these handlers.
    rootEl.addEventListener('touchstart', onStart, { passive: true })
    rootEl.addEventListener('touchend', onEnd, { passive: true })

    const panelEl = panelRef.current
    const scrollEl = scrollAreaRef.current

    // Stop touchmove on the scroll area → browser handles vertical scroll
    // natively without any JS ancestor seeing the event.
    function stopMove(e: TouchEvent) { e.stopPropagation() }

    if (detailOpen && panelEl) {
      // Panel open: touchmove on panel (not root) + stopMove on scroll area
      panelEl.addEventListener('touchmove', onMove, { passive: false })
      if (scrollEl) scrollEl.addEventListener('touchmove', stopMove, { passive: false })
    } else {
      // Panel closed: touchmove on the Bento root for main-page gestures
      rootEl.addEventListener('touchmove', onMove, { passive: false })
    }

    // Cleanup always tries all attachment points (removeEventListener on
    // a non-attached target is a safe no-op).
    return () => {
      rootEl.removeEventListener('touchstart', onStart)
      rootEl.removeEventListener('touchend', onEnd)
      rootEl.removeEventListener('touchmove', onMove)
      if (panelEl) panelEl.removeEventListener('touchmove', onMove)
      if (scrollEl) scrollEl.removeEventListener('touchmove', stopMove)
    }
  }, [refreshSelectedDate, setMainPullOffset, detailOpen]) // eslint-disable-line

  async function toggleStatus(order: Order) {
    const newStatus = order.status === 'completed' ? 'pending' : 'completed'
    setError(null)

    // Optimistic: update local state immediately
    const optimistic = orders.map(o => o.id === order.id ? { ...o, status: newStatus } : o)
    setOrders(optimistic); cache.current[selectedDate] = optimistic

    try {
      let result: { error?: { message?: string } | null }
      if (isKitchen) {
        result = await supabase.rpc('set_bento_order_status', {
          order_id: order.id,
          next_status: newStatus,
        })
      } else {
        result = await supabase.from('bento_orders').update({ status: newStatus }).eq('id', order.id)
      }
      if (result.error) {
        setError(result.error.message || 'Failed to update order status.')
        // Rollback
        const reverted = orders.map(o => o.id === order.id ? { ...o, status: order.status } : o)
        setOrders(reverted); cache.current[selectedDate] = reverted
      }
    } catch {
      setError('Network error. Please check your connection.')
      const reverted = orders.map(o => o.id === order.id ? { ...o, status: order.status } : o)
      setOrders(reverted); cache.current[selectedDate] = reverted
    }
  }

  async function togglePaid(order: Order) {
    if (!canViewFinancialDetails) return
    const newPaid = !order.paid
    setError(null)

    // Optimistic: update local state immediately
    const optimistic = orders.map(o => o.id === order.id ? { ...o, paid: newPaid } : o)
    setOrders(optimistic); cache.current[selectedDate] = optimistic

    try {
      const { error: paidError } = await supabase.from('bento_orders').update({ paid: newPaid }).eq('id', order.id)
      if (paidError) {
        setError(paidError.message || 'Failed to update payment status.')
        // Rollback
        const reverted = orders.map(o => o.id === order.id ? { ...o, paid: order.paid } : o)
        setOrders(reverted); cache.current[selectedDate] = reverted
      }
    } catch {
      setError('Network error. Please check your connection.')
      const reverted = orders.map(o => o.id === order.id ? { ...o, paid: order.paid } : o)
      setOrders(reverted); cache.current[selectedDate] = reverted
    }
  }

  // Owner-only: permanently delete an order. Unlinks it from any subscription
  // day first so the FK never blocks the delete. If the order is still PENDING
  // (not yet made) and belongs to a package member, its portions are refunded
  // back to the package — a completed order is already made, so it is not.
  async function confirmDeleteOrder() {
    const order = deleteTarget
    if (!order || !isOwner) return
    setDeleteTarget(null)
    setLoading(order.id)
    setError(null)
    try {
      if (order.status !== 'completed') {
        const { data: custs } = await supabase
          .from('bento_customers')
          .select('id, used_portions, total_portions')
          .ilike('name', order.customer_name)
          .limit(1)
        const cust = custs?.[0]
        if (cust && cust.total_portions > 0) {
          const refunded = Math.max(0, (cust.used_portions ?? 0) - (order.quantity ?? 0))
          await supabase.from('bento_customers').update({ used_portions: refunded }).eq('id', cust.id)
        }
      }
      await supabase.from('bento_subscription_days').update({ order_id: null }).eq('order_id', order.id)
      const { error: delError } = await supabase.from('bento_orders').delete().eq('id', order.id)
      if (delError) {
        setError(delError.message || 'Failed to delete order.')
        setLoading(null)
        return
      }
      const updated = orders.filter(o => o.id !== order.id)
      setOrders(updated); cache.current[selectedDate] = updated
    } catch {
      setError('Network error. Please check your connection.')
    }
    setLoading(null)
  }

  const filtered = orders.filter(o =>
    (filterArea === ALL || o.area === filterArea) &&
    matchesOption(o.menu_type, filterType, MENU_TYPES) &&
    matchesOption(o.time_slot, filterTime, TIME_SLOTS)
  )
  const total = orders.length
  const totalPortions = orders.reduce((sum, o) => sum + (o.quantity ?? 1), 0)
  const completed = orders.filter(o => o.status === 'completed').length
  const pending = orders.filter(o => o.status === 'pending').length
  const totalAmount = orders.reduce((sum, o) => sum + (o.amount || 0), 0)
  const unpaidCount = orders.filter(o => o.paid === false).length

  const portionsBreakdown = (() => {
    const groups: Record<string, { qty: number; items: Order[]; menuLabel: string; slotLabel: string }> = {}
    for (const o of orders) {
      const mt = MENU_TYPES.find(t => t.aliases.includes(o.menu_type || ''))
      const ts = TIME_SLOTS.find(t => t.aliases.includes(o.time_slot || ''))
      const key = `${mt?.value ?? 'other'}__${ts?.value ?? 'other'}`
      if (!groups[key]) groups[key] = { qty: 0, items: [], menuLabel: mt?.label ?? (o.menu_type || 'Other'), slotLabel: ts?.label ?? (o.time_slot || '') }
      groups[key].qty += (o.quantity ?? 1)
      groups[key].items.push(o)
    }
    return Object.values(groups).sort((a, b) => b.qty - a.qty)
  })()
  const isToday = selectedDate === today
  const showTodayShortcut = shouldShowBentoTodayShortcut(selectedDate, today, detailOpen)
  const mainPullActive = mainPullOffset !== 0 || refreshing

  return (
    <div ref={rootRef} style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', overscrollBehavior: 'none', background: '#f9fafb' }}>
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
            <BackButton href="/" />
            <span className="font-semibold text-base tracking-wide">XIN BENTO</span>
          </div>
          {!isKitchen && <button onClick={() => push('/bento/new', <Suspense fallback={pageFallback}><NewBentoOrder initialDate={selectedDate} /></Suspense>)} className="bg-orange-500 text-white text-xl leading-none w-9 h-9 rounded-full flex items-center justify-center" aria-label="New order">+</button>}
        </div>

        <div ref={datepickerAreaRef} className="bg-white px-4 pt-4 pb-3" style={{ flexShrink: 0 }}>
          <DatePicker selectedDate={selectedDate} onDateChange={handleDateChange} />
        </div>

        <div className="flex-1 px-4 pt-3 flex flex-col gap-3 overflow-hidden">
          <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ flexShrink: 0 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-500">{isKitchen ? (selectedDate > today ? 'Tomorrow Production' : 'Daily Production') : 'Bento Revenue'}</div>
              <div className={`text-xs font-medium ${pending > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                ● {pending > 0 ? 'In Progress' : 'All Done'}
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-3">
              {isKitchen ? `${totalPortions} portions` : `RM ${totalAmount > 0 ? totalAmount.toFixed(2) : '0.00'}`}
            </div>
            {isKitchen ? null : (
            <div className="grid grid-cols-4 gap-2">
              {([
                { mode: 'portions' as PanelMode, val: totalPortions, label: 'Portions', color: 'text-blue-500' },
                { mode: 'orders' as PanelMode, val: total, label: 'Orders', color: 'text-gray-700' },
                { mode: 'pending' as PanelMode, val: pending, label: 'Pending', color: 'text-orange-500' },
                { mode: 'done' as PanelMode, val: completed, label: 'Done', color: 'text-green-500' },
              ]).map(({ mode, val, label, color }) => (
                <button key={mode} onClick={() => openPanel(mode)} className="text-center rounded-xl py-1.5 active:bg-gray-50 transition-colors">
                  <div className={`text-xl font-bold ${color}`}>{val}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{label}</div>
                </button>
              ))}
            </div>
            )}
          </div>

          {/* Kitchen: large cards for Weekly Menu + Production */}
          {isKitchen ? (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => push('/bento/weekly-menu', <Suspense fallback={pageFallback}><WeeklyMenuPage /></Suspense>)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-5 px-3"
                style={{ transition: 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)', WebkitTapHighlightColor: 'transparent' }}
                onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
                onPointerUp={e => (e.currentTarget.style.transform = '')}
                onPointerLeave={e => (e.currentTarget.style.transform = '')}
              >
                <img src="/weekly-menu.webp" alt="" aria-hidden width={158} height={158} className="object-contain" />
                <span className="text-sm font-semibold text-gray-800 mt-3">Weekly Menu</span>
              </button>
              <button onClick={() => push('/bento/production', <Suspense fallback={pageFallback}><ProductionPage initialDate={selectedDate} /></Suspense>)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-5 px-3"
                style={{ transition: 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)', WebkitTapHighlightColor: 'transparent' }}
                onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
                onPointerUp={e => (e.currentTarget.style.transform = '')}
                onPointerLeave={e => (e.currentTarget.style.transform = '')}
              >
                <img src="/production.webp" alt="" aria-hidden width={158} height={158} className="object-contain" />
                <span className="text-sm font-semibold text-gray-800 mt-3">Production</span>
              </button>
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-2">
            {canViewFinancialDetails && <button onClick={() => push('/bento/unpaid', <Suspense fallback={pageFallback}><UnpaidPage /></Suspense>)} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-2 border border-gray-100 text-left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
              </svg>
              <div>
                <div className="text-xs font-medium text-gray-700">Unpaid</div>
                <div className="text-xs text-gray-400">{unpaidCount > 0 ? `${unpaidCount} pending` : 'All paid'}</div>
              </div>
            </button>}
            <button onClick={() => push('/bento/weekly-menu', <Suspense fallback={pageFallback}><WeeklyMenuPage /></Suspense>)} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-2 border border-gray-100 text-left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2"/>
                <line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>
              </svg>
              <div>
                <div className="text-xs font-medium text-gray-700">Weekly Menu</div>
                <div className="text-xs text-gray-400">This week</div>
              </div>
            </button>
            {canManageCustomers && <button onClick={() => push('/bento/customers', <Suspense fallback={pageFallback}><CustomersClient /></Suspense>)} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-2 border border-gray-100 text-left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <div>
                <div className="text-xs font-medium text-gray-700">Customers</div>
                <div className="text-xs text-gray-400">Subscriptions</div>
              </div>
            </button>}
            {canOpenProduction && <button onClick={() => push('/bento/production', <Suspense fallback={pageFallback}><ProductionPage initialDate={selectedDate} /></Suspense>)} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-2 border border-gray-100 text-left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/><path d="M12 8v4l3 3"/>
              </svg>
              <div>
                <div className="text-xs font-medium text-gray-700">Production</div>
                <div className="text-xs text-gray-400">Kitchen sheet</div>
              </div>
            </button>}
          </div>
          )}

          <button onClick={() => openPanel('orders')} className="w-full flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm">
            <span className="text-sm text-gray-600">
              {fetching ? 'Loading...' : total > 0 ? `View all orders for ${formatDate(selectedDate)}` : 'No orders'}
            </span>
            <span className="text-gray-400 text-sm">→</span>
          </button>
        </div>
      </div>

      {/* Detail Panel */}
      <div
        ref={panelRef}
        className="fixed inset-0 bg-white"
        style={{
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: detailOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.3,0,0.1,1)',
          willChange: 'transform',
        }}
      >
        <div className="bg-white px-4 py-3 flex items-center justify-between border-b" style={{ flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <button onClick={closePanel} className="flex items-center text-gray-500"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
            <span className="font-semibold text-base">
              {panelMode === 'portions' ? 'Portions Breakdown' :
               panelMode === 'pending' ? 'Pending Orders' :
               panelMode === 'done' ? 'Completed Orders' :
               `All Orders · ${formatDate(selectedDate)}`}
            </span>
          </div>
        </div>

        {panelMode !== 'portions' && (
          <div className="px-4 pt-3 pb-2 flex gap-2" style={{ flexShrink: 0 }}>
            <Dropdown value={filterArea} onChange={setFilterArea} options={AREA_OPTIONS} />
            <Dropdown value={filterType} onChange={setFilterType} options={MENU_TYPE_OPTIONS} />
            <Dropdown value={filterTime} onChange={setFilterTime} options={TIME_SLOT_OPTIONS} />
          </div>
        )}

        <div ref={scrollAreaRef} data-scroll className="flex-1 min-h-0 overflow-y-auto px-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 144px)', overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2 mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{error}</span>
            </div>
          )}
          {fetching && <CenteredSpinner />}

          {/* Portions breakdown */}
          {!fetching && panelMode === 'portions' && (
            <div className="pt-4 space-y-3">
              {portionsBreakdown.length === 0 && <div className="text-center text-gray-400 py-8">No orders</div>}
              {portionsBreakdown.map((group) => (
                <div key={`${group.menuLabel}-${group.slotLabel}`} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-semibold text-gray-900">{group.menuLabel}</span>
                      {group.slotLabel && <span className="text-xs text-gray-400 ml-2">· {group.slotLabel}</span>}
                    </div>
                    <span className="text-2xl font-bold text-blue-500">{group.qty}</span>
                  </div>
                  {group.items.filter(o => o.note).map(o => (
                    <div key={o.id} className="text-xs text-orange-500 bg-orange-50 rounded-lg px-3 py-1.5 mb-1">
                      📝 {o.customer_name}: {o.note}
                    </div>
                  ))}
                  <div className="text-xs text-gray-400 mt-2">
                    {group.items.map(o => o.customer_name).join(' · ')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Orders / Pending / Done */}
          {!fetching && panelMode !== 'portions' && (() => {
            const panelOrders = panelMode === 'pending'
              ? filtered.filter(o => o.status !== 'completed')
              : panelMode === 'done'
              ? filtered.filter(o => o.status === 'completed')
              : filtered
            return (
              <div className="pt-3 space-y-3">
                {panelOrders.length === 0 && <div className="text-center text-gray-400 py-8">No orders</div>}
                {panelOrders.map((order) => {
                  const isDelivery = order.fulfillment_type ? order.fulfillment_type === 'delivery' : !!order.address
                  const isMember = !!order.customer_id
                  const rawMainDish = order.compartment_a || order.items?.split(',')[0]?.replace(/\s*x\d+\s*$/, '').trim() || order.items
                  const mainDish = rawMainDish === order.customer_name ? (order.items?.split(',')[1]?.trim() ?? rawMainDish) : rawMainDish
                  return (
                    <div key={order.id} className="bg-white rounded-2xl p-4 shadow-sm">
                      {/* Row 1: name + Edit */}
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-semibold ${isMember ? 'text-amber-500' : 'text-gray-900'}`}>
                          {isMember ? '⭐ ' : ''}{order.customer_name}
                        </span>
                        <button onClick={() => push(`/bento/orders/${order.id}/edit`, <Suspense fallback={pageFallback}><EditOrderPage orderId={order.id} order={order as unknown as Record<string, unknown>} /></Suspense>)}
                          className="text-xs text-blue-500 active:text-blue-700 font-medium px-2 py-1">Edit</button>
                      </div>
                      {/* Row 2: Delivery/Pickup + area */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isDelivery ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-500'}`}>
                          {isDelivery ? 'Delivery' : 'Pickup'}
                        </span>
                        {order.area && <span className="text-xs text-gray-400">{order.area}</span>}
                      </div>
                      {/* Row 3: main dish */}
                      <div className="text-sm text-gray-700 mb-1">{mainDish}</div>
                      {/* Row 4: menu type tag + qty + amount */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {order.menu_type && <span className="text-xs bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full">{getMenuTypeLabel(order.menu_type)}</span>}
                          {(order.quantity ?? 1) > 1 && <span className="text-xs bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">×{order.quantity}</span>}
                        </div>
                        {canViewFinancialDetails && (
                          <span className="font-semibold text-gray-900 text-sm">RM {order.amount ?? 0}</span>
                        )}
                      </div>
                      {order.note && <div className="text-sm text-orange-500 mb-1">📝 {order.note}</div>}
                      {isToday && (
                        <button onClick={() => toggleStatus(order)}
                          className={`mt-3 w-full py-2 rounded-xl text-sm font-medium ${order.status === 'completed' ? 'bg-gray-100 text-gray-500' : 'bg-orange-500 text-white'}`}>
                          {order.status === 'completed' ? '✓ Completed' : 'Mark Completed'}
                        </button>
                      )}
                      {canViewFinancialDetails && <button onClick={() => togglePaid(order)}
                        className={`mt-2 w-full py-2 rounded-xl text-sm font-medium border ${order.paid ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-500 border-red-200'}`}>
                        {order.paid ? '✓ Paid' : 'Unpaid — tap to mark'}
                      </button>}
                      {isOwner && <button onClick={() => setDeleteTarget(order)} disabled={loading === order.id}
                        className="mt-2 w-full py-2 rounded-xl text-sm font-medium text-red-400 bg-red-50 active:opacity-80">
                        {loading === order.id ? '…' : 'Delete order'}
                      </button>}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>

      {showTodayShortcut && (
        <div style={{ position: 'fixed', bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)', zIndex: 30, pointerEvents: 'auto' }}>
          <button onClick={() => handleDateChange(today)}
            style={{ padding: '10px 40px', backgroundColor: '#60a5fa', color: '#fff', fontSize: 14, fontWeight: 600, borderRadius: 999, border: 'none', boxShadow: '0 4px 16px rgba(96,165,250,0.5)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            TODAY
          </button>
        </div>
      )}

      {/* Delete-order confirmation — in-app styled dialog */}
      {deleteTarget && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 flex items-center justify-center px-8"
          style={{ zIndex: 2147483647, background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-base font-semibold text-gray-900 mb-1">Delete order?</div>
            <div className="text-sm text-gray-500 mb-5 leading-relaxed">
              Delete {deleteTarget.customer_name}&apos;s order? This can&apos;t be undone.
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 active:opacity-80">
                Cancel
              </button>
              <button type="button" onClick={confirmDeleteOrder}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white active:opacity-80"
                style={{ background: '#ef4444' }}>
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* FAB — visible in detail panels only (slides with BentoClient StackLayer) */}
      {!isKitchen && detailOpen && (
        <button
          onClick={() => push('/bento/new', <Suspense fallback={pageFallback}><NewBentoOrder initialDate={selectedDate} /></Suspense>)}
          aria-label="New order"
          className="fixed z-[290] w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:opacity-80"
          style={{ background: '#f97316', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)', left: '50%', transform: 'translateX(-50%)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}
    </div>
  )
}
