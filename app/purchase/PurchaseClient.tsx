'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { todayLocalStr } from '@/lib/dateUtils'
import BackButton from '../components/BackButton'
import Link from 'next/link'

export type PurchaseItem = {
  id: number
  date: string
  name: string
  category: string
  unit: string
  quantity: number
  unit_price: number
  total_price: number
  supplier: string | null
  note: string | null
  purchase_method: string | null
  status: string
}

const CATEGORIES = ['Meat', 'Seafood', 'Vegetables', 'Condiments', 'Staples', 'Supplies', 'Other']
const UNITS = ['kg', 'g', 'pcs', 'pack', 'box', 'bottle', 'bag', 'portion']

const ITEM_CATEGORY: Record<string, string> = {
  'Chicken Thigh': 'Meat', 'Chicken Breast': 'Meat', 'Whole Chicken': 'Meat',
  'Pork Belly': 'Meat', 'Pork Ribs': 'Meat', 'Pork Shoulder': 'Meat',
  'Beef': 'Meat', 'Lamb': 'Meat',
  'Fish Fillet': 'Seafood', 'Shrimp': 'Seafood', 'Squid': 'Seafood', 'Crab': 'Seafood',
  'Tofu': 'Vegetables', 'Garlic': 'Vegetables', 'Ginger': 'Vegetables',
  'Green Onion': 'Vegetables', 'Cabbage': 'Vegetables', 'Bok Choy': 'Vegetables',
  'Spinach': 'Vegetables', 'Potato': 'Vegetables', 'Tomato': 'Vegetables',
  'Mushroom': 'Vegetables', 'Bean Sprouts': 'Vegetables', 'Corn': 'Vegetables',
  'Carrot': 'Vegetables', 'Celery': 'Vegetables', 'Eggplant': 'Vegetables',
  'Soy Sauce': 'Condiments', 'Oyster Sauce': 'Condiments', 'Cooking Oil': 'Condiments',
  'Salt': 'Condiments', 'Sugar': 'Condiments', 'Vinegar': 'Condiments',
  'Cornstarch': 'Condiments', 'Sesame Oil': 'Condiments', 'Chili': 'Condiments',
  'Star Anise': 'Condiments',
  'Rice': 'Staples', 'Noodles': 'Staples', 'Eggs': 'Staples',
  'Packaging Box': 'Supplies', 'Disposable Gloves': 'Supplies', 'Cling Wrap': 'Supplies',
}
const COMMON_ITEMS = Object.keys(ITEM_CATEGORY).concat(['Bread'])

const CATEGORY_COLOR: Record<string, string> = {
  'Meat': '#ef4444', 'Seafood': '#3b82f6', 'Vegetables': '#22c55e',
  'Condiments': '#f59e0b', 'Staples': '#8b5cf6', 'Supplies': '#64748b', 'Other': '#9ca3af',
}
const CATEGORY_BG: Record<string, string> = {
  'Meat': '#fff1f1', 'Seafood': '#eff6ff', 'Vegetables': '#f0fdf4',
  'Condiments': '#fffbeb', 'Staples': '#faf5ff', 'Supplies': '#f8fafc', 'Other': '#f9fafb',
}
const CATEGORY_ORDER = ['Meat', 'Seafood', 'Vegetables', 'Condiments', 'Staples', 'Supplies', 'Other']

function getCatColor(cat: string) { return CATEGORY_COLOR[cat] ?? '#9ca3af' }
function sortItems(items: PurchaseItem[]) {
  return [...items].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category), bi = CATEGORY_ORDER.indexOf(b.category)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
}

// ── Simple date button with calendar popup ──
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function SimpleDatePicker({ selectedDate, onDateChange }: { selectedDate: string; onDateChange: (d: string) => void }) {
  const today = todayLocalStr()
  const [show, setShow] = useState(false)
  const [visible, setVisible] = useState(false)
  const [calYear, setCalYear] = useState(() => new Date(selectedDate + 'T00:00:00').getFullYear())
  const [calMonth, setCalMonth] = useState(() => new Date(selectedDate + 'T00:00:00').getMonth())
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  function open() {
    const d = new Date(selectedDate + 'T00:00:00')
    setCalYear(d.getFullYear()); setCalMonth(d.getMonth())
    setShow(true); requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
  }
  function close() { setVisible(false); setTimeout(() => setShow(false), 300) }

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDay = new Date(calYear, calMonth, 1).getDay()

  const modal = show && (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.45)', opacity: visible ? 1 : 0, transition: 'opacity 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 24, padding: '20px 16px 28px', width: '100%', maxWidth: 380, boxShadow: '0 24px 60px rgba(0,0,0,0.25)', transform: visible ? 'translateY(0)' : 'translateY(80px)', transition: 'transform 0.35s cubic-bezier(0.3,0,0.1,1), opacity 0.25s', opacity: visible ? 1 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }}
            style={{ width: 40, height: 40, borderRadius: '50%', background: '#f3f4f6', border: 'none', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <span style={{ fontWeight: 600, fontSize: 17, color: '#111' }}>{MONTHS[calMonth]} {calYear}</span>
          <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }}
            style={{ width: 40, height: 40, borderRadius: '50%', background: '#f3f4f6', border: 'none', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 8 }}>
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
            const isSel = dateStr === selectedDate, isTod = dateStr === today
            return (
              <div key={day} style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                <button onClick={() => { onDateChange(dateStr); close() }} style={{ width: 38, height: 38, borderRadius: '50%', border: isTod && !isSel ? '1.5px solid #60a5fa' : 'none', background: isSel ? '#60a5fa' : 'transparent', color: isSel ? '#fff' : isTod ? '#60a5fa' : '#374151', fontWeight: isSel || isTod ? 700 : 400, fontSize: 16, cursor: 'pointer' }}>{day}</button>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button onClick={() => { onDateChange(today); close() }} style={{ flex: 1, padding: 12, background: '#60a5fa', color: '#fff', border: 'none', borderRadius: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Today</button>
          <button onClick={close} style={{ flex: 1, padding: 12, background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 14, fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <button onClick={open} className="flex items-center gap-2 active:opacity-60 transition-opacity">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span className="text-sm font-medium text-gray-700">{formatDateLabel(selectedDate)}</span>
      </button>
      {mounted && createPortal(modal, document.body)}
    </>
  )
}

// ── Donut chart ──
function DonutChart({ items }: { items: PurchaseItem[] }) {
  const total = items.reduce((s, i) => s + (i.total_price ?? 0), 0)
  if (total === 0) return <div className="text-center text-gray-400 text-sm py-8">No data</div>
  const r = 58, cx = 80, cy = 80, strokeW = 22, circ = 2 * Math.PI * r
  const catData = CATEGORY_ORDER.map(cat => ({
    cat, color: CATEGORY_COLOR[cat] ?? '#9ca3af',
    amt: items.filter(i => i.category === cat).reduce((s, i) => s + (i.total_price ?? 0), 0),
  })).filter(d => d.amt > 0)
  let cumLen = 0
  const segments = catData.map(d => {
    const segLen = (d.amt / total) * circ
    const seg = { ...d, dashoffset: -cumLen, segLen }
    cumLen += segLen; return seg
  })
  return (
    <div className="flex flex-col items-center">
      <svg width={160} height={160} viewBox="0 0 160 160">
        <g transform={`rotate(-90, ${cx}, ${cy})`}>
          {segments.map((seg, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={strokeW}
              strokeDasharray={`${seg.segLen} ${circ}`} strokeDashoffset={seg.dashoffset} />
          ))}
        </g>
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="11" fill="#9ca3af">Total</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="15" fontWeight="700" fill="#111">{`RM ${total.toFixed(0)}`}</text>
      </svg>
      <div className="w-full space-y-2 mt-2 px-2">
        {catData.map(d => (
          <div key={d.cat} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="text-gray-700">{d.cat}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-xs">{Math.round(d.amt / total * 100)}%</span>
              <span className="font-semibold text-gray-900">RM {d.amt.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Supplier list ──
function SupplierList({ items }: { items: PurchaseItem[] }) {
  const map: Record<string, { items: PurchaseItem[]; total: number }> = {}
  for (const item of items) {
    const key = item.supplier?.trim() || '(No Supplier)'
    if (!map[key]) map[key] = { items: [], total: 0 }
    map[key].items.push(item); map[key].total += item.total_price ?? 0
  }
  const suppliers = Object.entries(map).sort((a, b) => b[1].total - a[1].total)
  if (suppliers.length === 0) return null
  return (
    <div className="space-y-3">
      {suppliers.map(([name, data]) => (
        <div key={name} className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-900 text-sm">🏪 {name}</span>
            <span className="font-bold text-gray-900 text-sm">RM {data.total.toFixed(2)}</span>
          </div>
          <div className="space-y-1">
            {data.items.map(i => (
              <div key={i.id} className="flex justify-between text-xs text-gray-500">
                <span>{i.name} · {i.quantity} {i.unit}</span>
                <span>RM {(i.total_price ?? 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Inline picker & name input ──
function InlinePicker({ value, options, onChange, label }: { value: string; options: string[]; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-left flex items-center justify-between bg-white" style={{ fontSize: 16 }}>
        <span className="text-gray-800">{value}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden">
          {options.map(opt => (
            <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false) }} className="w-full text-left px-3 py-2.5 hover:bg-orange-50"
              style={{ fontSize: 16, color: opt === value ? '#f97316' : '#374151', fontWeight: opt === value ? 600 : 400 }}>{opt}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function NameInput({ value, onChange, onCategoryChange }: { value: string; onChange: (v: string) => void; onCategoryChange: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  const filtered = value.length > 0 ? COMMON_ITEMS.filter(i => i.toLowerCase().includes(value.toLowerCase())) : COMMON_ITEMS
  return (
    <div className="relative">
      <label className="text-xs text-gray-400 mb-1 block">Item Name *</label>
      <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400" style={{ fontSize: 16 }} placeholder="Type or search..." value={value} autoFocus
        onChange={e => { onChange(e.target.value); setOpen(true); const auto = ITEM_CATEGORY[e.target.value]; if (auto) onCategoryChange(auto) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-y-auto" style={{ maxHeight: 160 }}>
          {filtered.map(item => (
            <button key={item} type="button" onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(item); setOpen(false); const auto = ITEM_CATEGORY[item]; if (auto) onCategoryChange(auto) }}
              className="w-full text-left px-3 py-2.5 hover:bg-orange-50 flex items-center justify-between"
              style={{ fontSize: 16, color: item === value ? '#f97316' : '#374151', fontWeight: item === value ? 600 : 400 }}>
              <span>{item}</span>
              {ITEM_CATEGORY[item] && <span className="text-xs text-gray-400 ml-2">{ITEM_CATEGORY[item]}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function usePullToRefresh(scrollRef: React.RefObject<HTMLDivElement | null>, onRefresh: () => Promise<void>) {
  const startY = useRef(0), pulling = useRef(false)
  const [pullDist, setPullDist] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const THRESHOLD = 60
  useEffect(() => {
    const el = scrollRef.current; if (!el) return
    const onStart = (e: TouchEvent) => { if (el.scrollTop <= 0) { startY.current = e.touches[0].clientY; pulling.current = true } }
    const onMove = (e: TouchEvent) => { if (!pulling.current || refreshing) return; const dist = e.touches[0].clientY - startY.current; if (dist > 0) { e.preventDefault(); setPullDist(Math.min(dist * 0.45, THRESHOLD + 20)) } }
    const onEnd = async () => { if (!pulling.current) return; pulling.current = false; if (pullDist >= THRESHOLD && !refreshing) { setRefreshing(true); setPullDist(THRESHOLD); await onRefresh(); setRefreshing(false) } setPullDist(0) }
    el.addEventListener('touchstart', onStart, { passive: true }); el.addEventListener('touchmove', onMove, { passive: false }); el.addEventListener('touchend', onEnd, { passive: true })
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); el.removeEventListener('touchend', onEnd) }
  }, [pullDist, refreshing, onRefresh, scrollRef])
  return { pullDist, refreshing, THRESHOLD }
}

type Filter = 'all' | 'pending' | 'done'

export default function PurchaseClient({ initialItems, initialDate }: { initialItems: PurchaseItem[]; initialDate: string }) {
  const [items, setItems] = useState(initialItems)
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [fetching, setFetching] = useState(false)
  const [toggling, setToggling] = useState<number | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const cache = useRef<Record<string, PurchaseItem[]>>({ [initialDate]: initialItems })
  const scrollRef = useRef<HTMLDivElement>(null)

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'Vegetables', unit: 'kg', quantity: '', unit_price: '' })
  const [saving, setSaving] = useState(false)

  // Panel
  const panelRef = useRef<HTMLDivElement>(null)
  const panelAnimRef = useRef<Animation | null>(null)
  const panelIsOpen = useRef(false)
  const [panelOpen, setPanelOpen] = useState(false)

  const setPanelRefCb = useCallback((el: HTMLDivElement | null) => {
    panelRef.current = el; if (el) el.style.transform = `translateX(${window.innerWidth}px)`
  }, [])

  function getPanelX() {
    const el = panelRef.current; if (!el) return window.innerWidth
    const t = el.style.transform; if (t && t !== 'none') { const m = t.match(/translateX\(([-\d.]+)px\)/); if (m) return parseFloat(m[1]) }
    const mat = window.getComputedStyle(el).transform; return (!mat || mat === 'none') ? 0 : new DOMMatrix(mat).m41
  }
  function animatePanel(toX: number, onDone?: () => void) {
    const el = panelRef.current; if (!el) return
    if (panelAnimRef.current) { panelAnimRef.current.cancel(); panelAnimRef.current = null; el.style.transform = `translateX(${getPanelX()}px)` }
    const fromX = getPanelX(), dist = Math.abs(toX - fromX)
    if (dist < 1) { el.style.transform = `translateX(${toX}px)`; onDone?.(); return }
    const anim = el.animate([{ transform: `translateX(${fromX}px)` }, { transform: `translateX(${toX}px)` }], { duration: Math.max(200, Math.min(320, dist * 0.7)), easing: 'cubic-bezier(0.3,0,0.1,1)', fill: 'none' })
    panelAnimRef.current = anim
    anim.onfinish = () => { if (panelAnimRef.current !== anim) return; panelAnimRef.current = null; el.style.transform = `translateX(${toX}px)`; onDone?.() }
  }
  function openPanel() { if (panelIsOpen.current) return; panelIsOpen.current = true; setPanelOpen(true); animatePanel(0) }
  function closePanel() { panelIsOpen.current = false; setPanelOpen(false); animatePanel(window.innerWidth) }

  useEffect(() => {
    let sx = 0, sy = 0, axis: 'h' | 'v' | null = null, tracking = false, mode: 'open' | 'close' | null = null
    function onStart(e: TouchEvent) {
      const t = e.touches[0]; sx = t.clientX; sy = t.clientY; axis = null; tracking = false; mode = null
      if (panelIsOpen.current) { tracking = true; mode = 'close'; return }
      if (panelAnimRef.current) return
      tracking = true; mode = 'open'
    }
    function onMove(e: TouchEvent) {
      if (!tracking) return
      const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy
      if (!axis && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      if (axis !== 'h') return
      const el = panelRef.current
      if (mode === 'open' && dx < 0) { e.preventDefault(); if (el) el.style.transform = `translateX(${Math.max(0, window.innerWidth + dx)}px)` }
      else if (mode === 'close') { e.preventDefault(); if (dx > 0 && el) el.style.transform = `translateX(${Math.max(0, dx)}px)` }
    }
    function onEnd(e: TouchEvent) {
      if (!tracking) return; tracking = false; if (axis !== 'h') return
      const dx = e.changedTouches[0].clientX - sx, thresh = window.innerWidth * 0.22
      if (mode === 'open' && dx < -thresh) openPanel()
      else if (mode === 'open' && dx < 0) animatePanel(window.innerWidth)
      else if (mode === 'close' && dx > thresh) closePanel()
      else if (mode === 'close') animatePanel(0)
    }
    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd, { passive: true })
    return () => { document.removeEventListener('touchstart', onStart); document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onEnd) }
  }, []) // eslint-disable-line

  const fetchDate = useCallback(async (date: string): Promise<PurchaseItem[]> => {
    const { data } = await supabase.from('purchase_items').select('*').eq('date', date).order('id', { ascending: true })
    const result = (data || []) as PurchaseItem[]; cache.current[date] = result; return result
  }, [])

  const doRefresh = useCallback(async () => { setItems(await fetchDate(selectedDate)) }, [fetchDate, selectedDate])
  const { pullDist, refreshing, THRESHOLD } = usePullToRefresh(scrollRef, doRefresh)

  async function handleDateChange(date: string) {
    setSelectedDate(date)
    if (cache.current[date] !== undefined) setItems(cache.current[date])
    else { setFetching(true); setItems(await fetchDate(date)); setFetching(false) }
  }

  async function toggleComplete(item: PurchaseItem) {
    const newStatus = item.status === 'completed' ? 'pending' : 'completed'
    const updated = items.map(i => i.id === item.id ? { ...i, status: newStatus } : i)
    setItems(updated); cache.current[selectedDate] = updated; setToggling(item.id)
    const { error } = await supabase.from('purchase_items').update({ status: newStatus }).eq('id', item.id)
    if (error) { const rev = items.map(i => i.id === item.id ? { ...i, status: item.status } : i); setItems(rev); cache.current[selectedDate] = rev }
    setToggling(null)
  }

  async function handleAdd() {
    if (!form.name.trim()) return; setSaving(true)
    const qty = parseFloat(form.quantity) || 0, up = parseFloat(form.unit_price) || 0
    const row = { date: selectedDate, name: form.name.trim(), category: form.category, unit: form.unit, quantity: qty, unit_price: up, total_price: qty * up, status: 'pending' }
    const { data, error } = await supabase.from('purchase_items').insert(row).select().single()
    if (data) { const upd = [...items, data as PurchaseItem]; setItems(upd); cache.current[selectedDate] = upd }
    else { const temp = { ...row, id: Date.now(), supplier: null, note: null, purchase_method: null } as PurchaseItem; const upd = [...items, temp]; setItems(upd); cache.current[selectedDate] = upd; if (error) console.error(error) }
    setForm({ name: '', category: 'Vegetables', unit: 'kg', quantity: '', unit_price: '' }); setSaving(false); setShowAdd(false)
  }

  const pendingItems = sortItems(items.filter(i => i.status !== 'completed'))
  const doneItems = sortItems(items.filter(i => i.status === 'completed'))
  const displayItems = filter === 'pending' ? pendingItems : filter === 'done' ? doneItems : [...pendingItems, ...doneItems]
  const totalAmt = items.reduce((s, i) => s + (i.total_price ?? 0), 0)

  function toggleFilter(f: Filter) { setFilter(prev => prev === f ? 'all' : f) }

  return (
    <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>

      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <BackButton href="/" />
          <span className="font-semibold text-base">Purchase</span>
        </div>
        <button onClick={() => setShowAdd(true)} className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      {/* Stats card (dine-in style) */}
      <div className="px-4 pt-4 pb-3" style={{ flexShrink: 0 }}>
        <div className="flex justify-center mb-3">
          <SimpleDatePicker selectedDate={selectedDate} onDateChange={handleDateChange} />
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-3xl font-bold text-gray-900 mb-3">RM {totalAmt.toFixed(2)}</div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => toggleFilter('pending')} className="text-center rounded-xl py-2 transition-all"
              style={{ background: filter === 'pending' ? '#fff7ed' : '#f9fafb' }}>
              <div className="text-xl font-bold text-orange-500">{pendingItems.length}</div>
              <div className="text-xs mt-0.5" style={{ color: filter === 'pending' ? '#f97316' : '#9ca3af' }}>Pending</div>
            </button>
            <button onClick={() => toggleFilter('done')} className="text-center rounded-xl py-2 transition-all"
              style={{ background: filter === 'done' ? '#f0fdf4' : '#f9fafb' }}>
              <div className="text-xl font-bold text-green-500">{doneItems.length}</div>
              <div className="text-xs mt-0.5" style={{ color: filter === 'done' ? '#22c55e' : '#9ca3af' }}>Done</div>
            </button>
          </div>
        </div>
        {filter !== 'all' && (
          <div className="text-xs text-center text-gray-400 mt-2">
            Showing {filter} · <button onClick={() => setFilter('all')} className="text-orange-500">Show all</button>
          </div>
        )}
      </div>

      {/* List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ background: '#fff' }}>
        <div style={{ height: refreshing ? THRESHOLD : pullDist, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: refreshing || pullDist === 0 ? 'height 0.3s ease' : 'none', overflow: 'hidden' }}>
          {(pullDist > 5 || refreshing) && (
            <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2.5px solid #f97316', borderTopColor: 'transparent', animation: refreshing ? 'ptr-spin 0.7s linear infinite' : 'none', transform: !refreshing ? `rotate(${(pullDist / THRESHOLD) * 300}deg)` : undefined }} />
          )}
        </div>
        <style>{`@keyframes ptr-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

        {fetching && <div className="text-center text-gray-400 py-8 text-sm">Loading...</div>}
        {!fetching && displayItems.length === 0 && (
          <div className="text-center text-gray-400 py-16">
            <div className="text-4xl mb-3">🛒</div>
            <div className="text-sm">{filter === 'all' ? 'No items — tap + to add' : `No ${filter} items`}</div>
          </div>
        )}
        {!fetching && displayItems.map((item, idx) => (
          <ItemRow key={item.id} item={item} isLast={idx === displayItems.length - 1}
            toggling={toggling === item.id} onToggle={() => toggleComplete(item)} />
        ))}
      </div>

      {/* Stats Panel */}
      <div ref={setPanelRefCb} className="fixed inset-0 bg-gray-50 flex flex-col" style={{ zIndex: 20 }}>
        <div className="bg-white px-4 py-3 flex items-center gap-3 border-b" style={{ flexShrink: 0 }}>
          <button onClick={closePanel} className="text-gray-500">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span className="font-semibold text-base">Purchase Summary</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <div className="text-xs text-gray-400 mb-1">{formatDateLabel(selectedDate)}</div>
            <div className="text-3xl font-bold text-gray-900">RM {totalAmt.toFixed(2)}</div>
            <div className="text-xs text-gray-400 mt-1">{items.length} items · {doneItems.length} done</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-3">Category Breakdown</div>
            {panelOpen && <DonutChart items={items} />}
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-3">Suppliers</div>
            {panelOpen && <SupplierList items={items} />}
          </div>
        </div>
      </div>

      {/* Add Panel */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
            <div className="px-4 pt-5 pb-3 flex items-center justify-between flex-shrink-0 border-b border-gray-100">
              <span className="font-semibold text-base">Add Item</span>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 text-xl leading-none">×</button>
            </div>
            <div className="px-4 py-4 overflow-y-auto flex-1 space-y-3">
              <NameInput value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} onCategoryChange={c => setForm(f => ({ ...f, category: c }))} />
              <div className="grid grid-cols-2 gap-3">
                <InlinePicker label="Category" value={form.category} options={CATEGORIES} onChange={v => setForm(f => ({ ...f, category: v }))} />
                <InlinePicker label="Unit" value={form.unit} options={UNITS} onChange={v => setForm(f => ({ ...f, unit: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Qty</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400" style={{ fontSize: 16 }} placeholder="0" type="number" inputMode="decimal" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Unit Price (RM)</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400" style={{ fontSize: 16 }} placeholder="0.00" type="number" inputMode="decimal" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} />
                </div>
              </div>
              {form.quantity && form.unit_price && (
                <div className="text-xs text-gray-500 text-right">Est. Total: RM {(parseFloat(form.quantity) * parseFloat(form.unit_price) || 0).toFixed(2)}</div>
              )}
              <button onClick={handleAdd} disabled={saving || !form.name.trim()} className="w-full py-3 rounded-2xl text-sm font-semibold text-white" style={{ background: form.name.trim() ? '#f97316' : '#d1d5db' }}>
                {saving ? 'Saving...' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, isLast, toggling, onToggle }: { item: PurchaseItem; isLast: boolean; toggling: boolean; onToggle: () => void }) {
  const done = item.status === 'completed'
  const catColor = getCatColor(item.category)
  return (
    <div className={`flex items-center px-4 py-2.5 ${!isLast ? 'border-b border-gray-100' : ''}`}
      style={{ borderLeft: `3px solid ${done ? '#e5e7eb' : catColor}`, minHeight: 52 }}>
      <button onClick={onToggle} disabled={toggling} className="flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center mr-3"
        style={{ borderColor: done ? '#9ca3af' : catColor, background: done ? '#9ca3af' : 'transparent', color: '#fff', opacity: toggling ? 0.5 : 1 }}>
        {done && <CheckIcon />}
      </button>
      <Link href={`/purchase/${item.id}`} className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm truncate" style={{ color: done ? '#9ca3af' : '#111827', textDecoration: done ? 'line-through' : 'none' }}>{item.name}</span>
          <span className="text-sm font-semibold flex-shrink-0" style={{ color: done ? '#9ca3af' : '#111827' }}>
            {(item.total_price ?? 0) > 0 ? `RM ${(item.total_price ?? 0).toFixed(2)}` : '—'}
          </span>
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          {(item.unit_price ?? 0) > 0 ? `RM${item.unit_price}/${item.unit}` : '—'} · {(item.quantity ?? 0) > 0 ? `${item.quantity} ${item.unit}` : '—'}
        </div>
      </Link>
    </div>
  )
}
