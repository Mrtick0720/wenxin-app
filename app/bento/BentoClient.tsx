'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { todayLocalStr, addDays, getMondayOfWeek } from '@/lib/dateUtils'
import Link from 'next/link'
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

const AREAS = ['全部', 'Likas', 'Luyang', 'Lintas']
const MENU_TYPES = ['全部', '清单', '风味', '素食']
const TIME_SLOTS = ['全部', '午餐', '晚餐']

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekday}`
}

export default function BentoClient({ initialOrders }: { initialOrders: Order[] }) {
  const today = todayLocalStr()
  const [orders, setOrders] = useState(initialOrders)
  const [loading, setLoading] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState(today)
  const [portalMounted, setPortalMounted] = useState(false)
  const [filterArea, setFilterArea] = useState('全部')
  const [filterType, setFilterType] = useState('全部')
  const [filterTime, setFilterTime] = useState('全部')
  const [fetching, setFetching] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  useEffect(() => { setPortalMounted(true) }, [])

  const cache = useRef<Record<string, Order[]>>({ [today]: initialOrders })

  // ─── Panel slide via WAA ───
  const panelRef = useRef<HTMLDivElement>(null)
  const panelAnimRef = useRef<Animation | null>(null)
  const panelIsOpen = useRef(false)

  // Touch tracking (shared for both open and close gestures)
  const swipeStartX = useRef(0)
  const swipeStartY = useRef(0)
  const swipeActive = useRef(false)
  const swipeDir = useRef<'h' | 'v' | null>(null)

  // Set panel off-screen on mount
  useEffect(() => {
    const el = panelRef.current
    if (el) el.style.transform = `translateX(${window.innerWidth}px)`
  }, [])

  function getPanelCurrentX(): number {
    const el = panelRef.current
    if (!el) return window.innerWidth
    const m = new DOMMatrix(window.getComputedStyle(el).transform)
    return m.m41
  }

  function animatePanel(toX: number, onDone?: () => void) {
    const el = panelRef.current
    if (!el) return
    if (panelAnimRef.current) {
      try { panelAnimRef.current.commitStyles() } catch {}
      panelAnimRef.current.cancel()
      panelAnimRef.current = null
    }
    const fromX = getPanelCurrentX()
    const dist = Math.abs(toX - fromX)
    const duration = Math.max(180, Math.min(340, dist * 0.7))
    const anim = el.animate(
      [{ transform: `translateX(${fromX}px)` }, { transform: `translateX(${toX}px)` }],
      { duration, easing: 'cubic-bezier(0.3, 0, 0.1, 1)', fill: 'forwards' }
    )
    panelAnimRef.current = anim
    anim.onfinish = () => {
      if (panelAnimRef.current !== anim) return
      try { anim.commitStyles() } catch {}
      anim.cancel()
      panelAnimRef.current = null
      onDone?.()
    }
  }

  function openPanel() {
    const el = panelRef.current
    if (!el) return
    // If not yet positioned off-screen, force it
    const cur = getPanelCurrentX()
    if (cur < window.innerWidth * 0.5) el.style.transform = `translateX(${window.innerWidth}px)`
    panelIsOpen.current = true
    setDetailOpen(true)
    animatePanel(0)
  }

  function closePanel() {
    panelIsOpen.current = false
    animatePanel(window.innerWidth, () => setDetailOpen(false))
  }

  // ─── Lower area touch (swipe left to open) ───
  function onLowerTouchStart(e: React.TouchEvent) {
    if (panelIsOpen.current || panelAnimRef.current) return
    swipeStartX.current = e.touches[0].clientX
    swipeStartY.current = e.touches[0].clientY
    swipeActive.current = true
    swipeDir.current = null
  }

  function onLowerTouchMove(e: React.TouchEvent) {
    if (!swipeActive.current) return
    const dx = e.touches[0].clientX - swipeStartX.current
    const dy = e.touches[0].clientY - swipeStartY.current
    if (!swipeDir.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      swipeDir.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
    }
    if (swipeDir.current !== 'h') return
    // Move panel with finger (only when swiping left, dx < 0)
    const el = panelRef.current
    if (!el) return
    const x = Math.max(0, window.innerWidth + dx)
    el.style.transform = `translateX(${x}px)`
  }

  function onLowerTouchEnd(e: React.TouchEvent) {
    if (!swipeActive.current || swipeDir.current !== 'h') { swipeActive.current = false; return }
    swipeActive.current = false
    const dx = e.changedTouches[0].clientX - swipeStartX.current
    if (dx < -(window.innerWidth * 0.28)) {
      panelIsOpen.current = true
      setDetailOpen(true)
      animatePanel(0)
    } else {
      animatePanel(window.innerWidth)
    }
  }

  // ─── Detail panel touch (edge right-swipe to close) ───
  function onDetailTouchStart(e: React.TouchEvent) {
    // Only trigger from left edge (first 52px) — mimics native back gesture
    if (e.touches[0].clientX > 52) return
    swipeStartX.current = e.touches[0].clientX
    swipeStartY.current = e.touches[0].clientY
    swipeActive.current = true
    swipeDir.current = null
  }

  function onDetailTouchMove(e: React.TouchEvent) {
    if (!swipeActive.current) return
    const dx = e.touches[0].clientX - swipeStartX.current
    const dy = e.touches[0].clientY - swipeStartY.current
    if (!swipeDir.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      swipeDir.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
    }
    if (swipeDir.current !== 'h' || dx < 0) return
    const el = panelRef.current
    if (!el) return
    el.style.transform = `translateX(${dx}px)`
  }

  function onDetailTouchEnd(e: React.TouchEvent) {
    if (!swipeActive.current || swipeDir.current !== 'h') { swipeActive.current = false; return }
    swipeActive.current = false
    const dx = e.changedTouches[0].clientX - swipeStartX.current
    if (dx > window.innerWidth * 0.28) {
      closePanel()
    } else {
      animatePanel(0)
    }
  }

  // ─── Data ───
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
    const prevRep = addDays(addDays(monday, -7), idx)
    const nextRep = addDays(addDays(monday, 7), idx)
    if (!cache.current[prevRep]) fetchDate(prevRep)
    if (!cache.current[nextRep]) fetchDate(nextRep)
  }, [fetchDate])

  async function handleDateChange(date: string) {
    setSelectedDate(date)
    if (cache.current[date] !== undefined) {
      setOrders(cache.current[date])
    } else {
      setFetching(true)
      const result = await fetchDate(date)
      setOrders(result)
      setFetching(false)
    }
    prefetchAdjacent(date)
  }

  useEffect(() => { prefetchAdjacent(today) }, []) // eslint-disable-line

  async function toggleStatus(order: Order) {
    const newStatus = order.status === 'completed' ? 'pending' : 'completed'
    setLoading(order.id)
    await supabase.from('bento_orders').update({ status: newStatus }).eq('id', order.id)
    const updated = orders.map(o => o.id === order.id ? { ...o, status: newStatus } : o)
    setOrders(updated)
    cache.current[selectedDate] = updated
    setLoading(null)
  }

  async function togglePaid(order: Order) {
    const newPaid = !order.paid
    setLoading(order.id)
    await supabase.from('bento_orders').update({ paid: newPaid }).eq('id', order.id)
    const updated = orders.map(o => o.id === order.id ? { ...o, paid: newPaid } : o)
    setOrders(updated)
    cache.current[selectedDate] = updated
    setLoading(null)
  }

  const filtered = orders.filter(o => {
    const areaMatch = filterArea === '全部' || o.area === filterArea
    const typeMatch = filterType === '全部' || o.menu_type === filterType
    const timeMatch = filterTime === '全部' || o.time_slot === filterTime
    return areaMatch && typeMatch && timeMatch
  })

  const total = orders.length
  const completed = orders.filter(o => o.status === 'completed').length
  const pending = orders.filter(o => o.status === 'pending').length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  const totalAmount = orders.reduce((sum, o) => sum + (o.amount || 0), 0)
  const unpaidCount = orders.filter(o => !o.paid).length
  const isToday = selectedDate === today

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>

      {/* ── Header ── */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-500 text-xl">←</Link>
          <span className="font-semibold text-base tracking-wide">XIN BENTO</span>
        </div>
        <Link href="/bento/new" className="bg-orange-500 text-white text-sm px-3 py-1.5 rounded-full">
          + 新增
        </Link>
      </div>

      {/* ── DatePicker ── */}
      <div className="bg-white px-4 pt-4 pb-3" style={{ flexShrink: 0 }}>
        <DatePicker selectedDate={selectedDate} onDateChange={handleDateChange} />
      </div>

      {/* ── Lower area — swipe left anywhere here to open detail ── */}
      <div
        className="flex-1 px-4 pt-3 flex flex-col gap-3 overflow-hidden"
        style={{ touchAction: 'none' }}
        onTouchStart={onLowerTouchStart}
        onTouchMove={onLowerTouchMove}
        onTouchEnd={onLowerTouchEnd}
      >
        {/* Stats */}
        <div className="border-t border-gray-100 pt-3">
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{total}</div>
              <div className="text-xs text-gray-400 mt-0.5">总订单</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{completed}</div>
              <div className="text-xs text-gray-400 mt-0.5">已完成</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{pending}</div>
              <div className="text-xs text-gray-400 mt-0.5">待处理</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">{totalAmount > 0 ? totalAmount : '—'}</div>
              <div className="text-xs text-gray-400 mt-0.5">总金额</div>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className="text-xs text-gray-400 mt-1 text-right">完成 {percent}%</div>
        </div>

        {/* Quick links */}
        <div className="flex gap-2">
          <Link href="/bento/unpaid" className="flex-1 bg-white rounded-xl p-3 shadow-sm flex items-center gap-2 border border-gray-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
            </svg>
            <div>
              <div className="text-xs font-medium text-gray-700">未付款</div>
              <div className="text-xs text-gray-400">{unpaidCount > 0 ? `${unpaidCount} 单待付` : '全部已付'}</div>
            </div>
          </Link>
          <Link href="/bento/weekly-menu" className="flex-1 bg-white rounded-xl p-3 shadow-sm flex items-center gap-2 border border-gray-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2"/>
              <line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>
            </svg>
            <div>
              <div className="text-xs font-medium text-gray-700">周菜单</div>
              <div className="text-xs text-gray-400">本周菜品</div>
            </div>
          </Link>
        </div>

        {/* Open detail tap target */}
        <button
          onClick={openPanel}
          className="w-full flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm"
        >
          <span className="text-sm text-gray-600">
            {fetching ? '加载中...' : total > 0 ? `查看 ${formatDate(selectedDate)} 全部订单` : '暂无订单'}
          </span>
          <span className="text-gray-400 text-sm">→</span>
        </button>
      </div>

      {/* ── Detail Panel ── */}
      <div
        ref={panelRef}
        className="fixed inset-0 bg-white flex flex-col"
        style={{ zIndex: 20 }}
        onTouchStart={onDetailTouchStart}
        onTouchMove={onDetailTouchMove}
        onTouchEnd={onDetailTouchEnd}
      >
        {/* Detail header */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-b" style={{ flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <button onClick={closePanel} className="text-gray-500 text-xl">←</button>
            <span className="font-semibold text-base">{formatDate(selectedDate)}</span>
          </div>
          <Link href="/bento/new" className="bg-orange-500 text-white text-sm px-3 py-1.5 rounded-full">
            + 新增
          </Link>
        </div>

        {/* Filters */}
        <div className="px-4 pt-3 pb-2 flex gap-2" style={{ flexShrink: 0 }}>
          <Dropdown value={filterArea} onChange={setFilterArea} options={AREAS.map(a => ({ value: a, label: a === '全部' ? '全部地区' : a }))} />
          <Dropdown value={filterType} onChange={setFilterType} options={MENU_TYPES.map(t => ({ value: t, label: t === '全部' ? '全部类型' : t }))} />
          <Dropdown value={filterTime} onChange={setFilterTime} options={TIME_SLOTS.map(t => ({ value: t, label: t === '全部' ? '全时段' : t }))} />
        </div>

        <div className="px-4 pb-2" style={{ flexShrink: 0 }}>
          <span className="text-sm font-semibold text-gray-700">
            订单列表 {filtered.length > 0 && <span className="text-gray-400 font-normal">({filtered.length} 单)</span>}
          </span>
        </div>

        {/* Scrollable order list — touch-action pan-y so vertical scroll works */}
        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-3" style={{ touchAction: 'pan-y' }}>
          {fetching && <div className="text-center text-gray-400 py-4">加载中...</div>}
          {!fetching && filtered.length === 0 && <div className="text-center text-gray-400 py-8">暂无订单</div>}
          {!fetching && filtered.map((order) => {
            const isDelivery = !!order.address
            return (
              <div key={order.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="font-semibold text-gray-900">{order.customer_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${isDelivery ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-500'}`}>
                    {isDelivery ? '配送' : '自取'}
                  </span>
                  {order.menu_type && (
                    <span className="text-xs bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full">{order.menu_type}</span>
                  )}
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
                  <button
                    onClick={() => toggleStatus(order)}
                    disabled={loading === order.id}
                    className={`mt-3 w-full py-2 rounded-xl text-sm font-medium ${
                      order.status === 'completed' ? 'bg-gray-100 text-gray-500' : 'bg-orange-500 text-white'
                    }`}
                  >
                    {loading === order.id ? '更新中...' : order.status === 'completed' ? '✓ 已完成' : '标记完成'}
                  </button>
                )}
                <button
                  onClick={() => togglePaid(order)}
                  disabled={loading === order.id}
                  className={`mt-2 w-full py-2 rounded-xl text-sm font-medium border ${
                    order.paid ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-500 border-red-200'
                  }`}
                >
                  {order.paid ? '✓ 已付款' : '未付款 — 点击标记'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* TODAY button */}
      {portalMounted && selectedDate !== today && createPortal(
        <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'auto' }}>
          <button
            onClick={() => handleDateChange(today)}
            style={{ padding: '10px 40px', backgroundColor: '#60a5fa', color: '#fff', fontSize: 14, fontWeight: 600, borderRadius: 999, border: 'none', boxShadow: '0 4px 16px rgba(96,165,250,0.5)', cursor: 'pointer' }}
          >
            TODAY
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}
