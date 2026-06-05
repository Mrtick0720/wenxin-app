'use client'

import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { todayLocalStr } from '@/lib/dateUtils'
import DatePicker from '../components/DatePicker'
import BackButton from '../components/BackButton'

type PurchaseItem = {
  id: number
  date: string
  name: string
  category: string
  unit: string
  quantity: number
  unit_price: number
  total_price: number
  supplier: string
  note: string
  status: 'pending' | 'ordered' | 'receiving' | 'received'
  ordered_at: string | null
  received_at: string | null
  received_by: string | null
  actual_unit_price: number | null
  actual_total_price: number | null
}

type StatusTab = 'pending' | 'ordered' | 'receiving' | 'received'

const STATUS_TABS: { key: StatusTab; label: string; color: string; bg: string }[] = [
  { key: 'pending',   label: 'To Order',  color: '#f97316', bg: '#fff7ed' },
  { key: 'ordered',   label: 'Ordered',   color: '#3b82f6', bg: '#eff6ff' },
  { key: 'receiving', label: 'Receiving', color: '#8b5cf6', bg: '#f5f3ff' },
  { key: 'received',  label: 'Received',  color: '#22c55e', bg: '#f0fdf4' },
]

const CATEGORIES = ['Meat', 'Seafood', 'Vegetables', 'Condiments', 'Staples', 'Supplies', 'Other']
const UNITS = ['kg', 'g', 'pcs', 'pack', 'box', 'bottle', 'bag', 'portion']

// Category sort order and color
const CATEGORY_META: Record<string, { bg: string; border: string }> = {
  'Meat':        { bg: '#fff1f1', border: '#ef4444' },
  'Seafood':     { bg: '#eff6ff', border: '#3b82f6' },
  'Vegetables':  { bg: '#f0fdf4', border: '#22c55e' },
  'Condiments':  { bg: '#fffbeb', border: '#f59e0b' },
  'Staples':     { bg: '#faf5ff', border: '#8b5cf6' },
  'Supplies':    { bg: '#f8fafc', border: '#94a3b8' },
  'Other':       { bg: '#f9fafb', border: '#9ca3af' },
}
const CATEGORY_ORDER = ['Meat', 'Seafood', 'Vegetables', 'Condiments', 'Staples', 'Supplies', 'Other']

function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? { bg: '#f9fafb', border: '#9ca3af' }
}

function sortByCategory(items: PurchaseItem[]) {
  return [...items].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category)
    const bi = CATEGORY_ORDER.indexOf(b.category)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
}

const COMMON_ITEMS = [
  'Chicken Thigh', 'Chicken Breast', 'Whole Chicken', 'Pork Belly', 'Pork Ribs', 'Pork Shoulder',
  'Beef', 'Lamb', 'Fish Fillet', 'Shrimp', 'Squid', 'Crab', 'Tofu', 'Eggs',
  'Garlic', 'Ginger', 'Green Onion', 'Cabbage', 'Spinach', 'Potato', 'Tomato',
  'Mushroom', 'Bean Sprouts', 'Corn', 'Carrot', 'Celery', 'Eggplant',
  'Soy Sauce', 'Oyster Sauce', 'Cooking Oil', 'Salt', 'Sugar', 'Vinegar',
  'Cornstarch', 'Sesame Oil', 'Chili', 'Star Anise',
  'Rice', 'Noodles', 'Packaging Box', 'Disposable Gloves', 'Cling Wrap',
]

const STATUS_NEXT: Record<StatusTab, StatusTab | null> = {
  pending: 'ordered', ordered: 'receiving', receiving: 'received', received: null,
}
const STATUS_NEXT_LABEL: Record<StatusTab, string> = {
  pending: 'Mark Ordered', ordered: 'Mark Receiving', receiving: 'Confirm Received', received: '',
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[d.getMonth()]} ${d.getDate()} ${weekdays[d.getDay()]}`
}

function fmtAmt(n: number | null | undefined) {
  if (n == null) return '—'
  return `RM ${Number(n).toFixed(2)}`
}

const emptyForm = {
  name: '', category: 'Vegetables', unit: 'kg',
  quantity: '', unit_price: '', supplier: '', note: '',
}

function InlinePicker({ value, options, onChange, label }: {
  value: string; options: string[]; onChange: (v: string) => void; label: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-left flex items-center justify-between bg-white"
        style={{ fontSize: 16 }}
      >
        <span className="text-gray-800">{value}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden">
          {options.map(opt => (
            <button key={opt} type="button"
              onClick={() => { onChange(opt); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 hover:bg-orange-50"
              style={{ fontSize: 16, color: opt === value ? '#f97316' : '#374151', fontWeight: opt === value ? 600 : 400 }}
            >{opt}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function NameInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const filtered = value.length > 0
    ? COMMON_ITEMS.filter(i => i.toLowerCase().includes(value.toLowerCase()))
    : COMMON_ITEMS
  return (
    <div className="relative">
      <label className="text-xs text-gray-400 mb-1 block">Item Name *</label>
      <input
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
        style={{ fontSize: 16 }}
        placeholder="Type or search..."
        value={value}
        autoFocus
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-y-auto" style={{ maxHeight: 160 }}>
          {filtered.map(item => (
            <button key={item} type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(item); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 hover:bg-orange-50"
              style={{ fontSize: 16, color: item === value ? '#f97316' : '#374151', fontWeight: item === value ? 600 : 400 }}
            >{item}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PurchaseClient({ initialItems, initialDate }: {
  initialItems: PurchaseItem[]; initialDate: string
}) {
  const today = todayLocalStr()
  const [items, setItems] = useState(initialItems)
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [activeTab, setActiveTab] = useState<StatusTab>('pending')
  const [fetching, setFetching] = useState(false)
  const [loading, setLoading] = useState<number | null>(null)
  const cache = useRef<Record<string, PurchaseItem[]>>({ [initialDate]: initialItems })

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [confirmItem, setConfirmItem] = useState<PurchaseItem | null>(null)
  const [actualPrice, setActualPrice] = useState('')
  const [receivedBy, setReceivedBy] = useState('')
  const [confirming, setConfirming] = useState(false)

  const fetchDate = useCallback(async (date: string): Promise<PurchaseItem[]> => {
    const { data } = await supabase.from('purchase_items').select('*').eq('date', date).order('id', { ascending: true })
    const result = (data || []) as PurchaseItem[]
    cache.current[date] = result
    return result
  }, [])

  async function handleDateChange(date: string) {
    setSelectedDate(date)
    if (cache.current[date] !== undefined) {
      setItems(cache.current[date])
    } else {
      setFetching(true)
      setItems(await fetchDate(date))
      setFetching(false)
    }
  }

  const filtered = sortByCategory(items.filter(i => i.status === activeTab))

  const totalAmount = items.filter(i => i.status === 'received').reduce((s, i) => s + (i.actual_total_price ?? i.total_price ?? 0), 0)
  const pendingAmt = items.filter(i => i.status !== 'received').reduce((s, i) => s + (i.total_price ?? 0), 0)
  const counts = {
    pending:   items.filter(i => i.status === 'pending').length,
    ordered:   items.filter(i => i.status === 'ordered').length,
    receiving: items.filter(i => i.status === 'receiving').length,
    received:  items.filter(i => i.status === 'received').length,
  }

  async function advanceStatus(item: PurchaseItem) {
    const next = STATUS_NEXT[item.status]
    if (!next) return
    if (next === 'received') {
      setConfirmItem(item)
      setActualPrice(item.unit_price ? String(item.unit_price) : '')
      setReceivedBy('')
      return
    }
    setLoading(item.id)
    const update: Partial<PurchaseItem> = { status: next }
    if (next === 'ordered') update.ordered_at = new Date().toISOString()
    await supabase.from('purchase_items').update(update).eq('id', item.id)
    const updated = items.map(i => i.id === item.id ? { ...i, ...update } : i)
    setItems(updated); cache.current[selectedDate] = updated; setLoading(null)
  }

  async function confirmReceive() {
    if (!confirmItem) return
    setConfirming(true)
    const qty = confirmItem.quantity ?? 0
    const ap = parseFloat(actualPrice) || (confirmItem.unit_price ?? 0)
    const update = {
      status: 'received' as StatusTab,
      received_at: new Date().toISOString(),
      received_by: receivedBy || null,
      actual_unit_price: ap,
      actual_total_price: ap * qty,
    }
    await supabase.from('purchase_items').update(update).eq('id', confirmItem.id)
    const updated = items.map(i => i.id === confirmItem.id ? { ...i, ...update } : i)
    setItems(updated); cache.current[selectedDate] = updated
    setConfirming(false); setConfirmItem(null)
  }

  async function handleAdd() {
    if (!form.name.trim()) return
    setSaving(true)
    const qty = parseFloat(form.quantity) || 0
    const up = parseFloat(form.unit_price) || 0
    const row = {
      date: selectedDate, name: form.name.trim(), category: form.category,
      unit: form.unit, quantity: qty, unit_price: up, total_price: qty * up,
      supplier: form.supplier.trim() || null, note: form.note.trim() || null, status: 'pending',
    }
    const { data, error } = await supabase.from('purchase_items').insert(row).select().single()
    if (data) {
      const updated = [...items, data as PurchaseItem]
      setItems(updated); cache.current[selectedDate] = updated
    } else {
      const tempItem = { ...row, id: Date.now(), ordered_at: null, received_at: null, received_by: null, actual_unit_price: null, actual_total_price: null } as PurchaseItem
      const updated = [...items, tempItem]
      setItems(updated); cache.current[selectedDate] = updated
      if (error) console.error('Insert error:', error)
    }
    setForm(emptyForm); setSaving(false); setShowAdd(false); setActiveTab('pending')
  }

  async function deleteItem(item: PurchaseItem) {
    if (!confirm(`Delete "${item.name}"?`)) return
    await supabase.from('purchase_items').delete().eq('id', item.id)
    const updated = items.filter(i => i.id !== item.id)
    setItems(updated); cache.current[selectedDate] = updated
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>

      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <BackButton href="/" />
          <span className="font-semibold text-base tracking-wide">Purchase</span>
        </div>
        <button
          onClick={() => { setShowAdd(true); setForm(emptyForm) }}
          className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      {/* DatePicker */}
      <div className="bg-white px-4 pt-4 pb-3 border-b" style={{ flexShrink: 0 }}>
        <DatePicker selectedDate={selectedDate} onDateChange={handleDateChange} />
      </div>

      {/* Stats */}
      <div className="bg-white px-4 py-3 border-b" style={{ flexShrink: 0 }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-gray-400">{formatDate(selectedDate)}</div>
            <div className="text-2xl font-bold text-gray-900 mt-0.5">{fmtAmt(totalAmount + pendingAmt)}</div>
            <div className="text-xs text-gray-400 mt-0.5">Received {fmtAmt(totalAmount)} · Pending {fmtAmt(pendingAmt)}</div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right">
            {STATUS_TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} className="text-xs"
                style={{ color: counts[t.key] > 0 ? t.color : '#9ca3af' }}>
                <span className="font-bold text-sm">{counts[t.key]}</span>
                <span className="ml-1">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="bg-white border-b flex" style={{ flexShrink: 0 }}>
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className="flex-1 py-2.5 text-xs font-medium relative"
            style={{ color: activeTab === t.key ? t.color : '#9ca3af' }}>
            {t.label}
            {counts[t.key] > 0 && (
              <span className="ml-1 text-xs px-1 py-0.5 rounded-full" style={{ background: t.bg, color: t.color }}>{counts[t.key]}</span>
            )}
            {activeTab === t.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: t.color }} />
            )}
          </button>
        ))}
      </div>

      {/* Item List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 pb-8">
        {fetching && <div className="text-center text-gray-400 py-8">Loading...</div>}
        {!fetching && filtered.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            <div className="text-4xl mb-3">
              {activeTab === 'pending' ? '🛒' : activeTab === 'ordered' ? '📋' : activeTab === 'receiving' ? '📦' : '✅'}
            </div>
            <div className="text-sm">No {STATUS_TABS.find(t => t.key === activeTab)?.label} items</div>
          </div>
        )}
        {!fetching && filtered.map(item => {
          const next = STATUS_NEXT[item.status]
          const { bg, border } = getCategoryMeta(item.category)
          return (
            <div key={item.id} className="rounded-xl overflow-hidden shadow-sm"
              style={{ background: bg, borderLeft: `3px solid ${border}` }}>
              <div className="px-3 py-2.5">
                {/* Row 1: name + delete */}
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-900 text-sm">{item.name}</span>
                  {item.status === 'pending' && (
                    <button onClick={() => deleteItem(item)} className="text-gray-300 text-base leading-none ml-2">×</button>
                  )}
                </div>
                {/* Row 2: unit price · qty · total */}
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{fmtAmt(item.unit_price)}/{item.unit}</span>
                  <span className="text-gray-300">·</span>
                  <span>{item.quantity} {item.unit}</span>
                  <span className="text-gray-300">·</span>
                  <span className="font-semibold text-gray-700">
                    {item.status === 'received' ? fmtAmt(item.actual_total_price) : fmtAmt(item.total_price)}
                  </span>
                </div>
                {/* Optional: supplier / note */}
                {(item.supplier || item.note) && (
                  <div className="text-xs text-gray-400 mt-1 truncate">
                    {item.supplier && <span>🏪 {item.supplier}</span>}
                    {item.supplier && item.note && <span className="mx-1">·</span>}
                    {item.note && <span>{item.note}</span>}
                  </div>
                )}
                {/* Received info */}
                {item.status === 'received' && item.received_at && (
                  <div className="text-xs text-gray-400 mt-1">
                    ✅ {new Date(item.received_at).toLocaleString('en-MY', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {item.received_by && ` · ${item.received_by}`}
                  </div>
                )}
                {/* Advance button */}
                {next && (
                  <button
                    onClick={() => advanceStatus(item)}
                    disabled={loading === item.id}
                    className="mt-2 w-full py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: 'rgba(255,255,255,0.7)', color: border, border: `1px solid ${border}`, opacity: loading === item.id ? 0.6 : 1 }}
                  >
                    {loading === item.id ? 'Updating...' : STATUS_NEXT_LABEL[item.status]}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Panel */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '88vh' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-4 pt-5 pb-3 flex items-center justify-between flex-shrink-0 border-b border-gray-100">
              <span className="font-semibold text-base">Add Item</span>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 text-lg">×</button>
            </div>
            <div className="px-4 py-4 overflow-y-auto flex-1 space-y-3">
              <NameInput value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
              <div className="grid grid-cols-2 gap-3">
                <InlinePicker label="Category" value={form.category} options={CATEGORIES} onChange={v => setForm(f => ({ ...f, category: v }))} />
                <InlinePicker label="Unit" value={form.unit} options={UNITS} onChange={v => setForm(f => ({ ...f, unit: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Qty</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
                    style={{ fontSize: 16 }} placeholder="0" type="number" inputMode="decimal"
                    value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Unit Price (RM)</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
                    style={{ fontSize: 16 }} placeholder="0.00" type="number" inputMode="decimal"
                    value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} />
                </div>
              </div>
              {form.quantity && form.unit_price && (
                <div className="text-xs text-gray-500 text-right">
                  Est. Total: RM {(parseFloat(form.quantity) * parseFloat(form.unit_price) || 0).toFixed(2)}
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Supplier</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
                  style={{ fontSize: 16 }} placeholder="e.g. KK Meat Supply"
                  value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Note</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
                  style={{ fontSize: 16 }} placeholder="e.g. For Bento"
                  value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              <button onClick={handleAdd} disabled={saving || !form.name.trim()}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-white"
                style={{ background: form.name.trim() ? '#f97316' : '#d1d5db' }}>
                {saving ? 'Saving...' : 'Add to To Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Confirm Panel */}
      {confirmItem && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setConfirmItem(null)}>
          <div className="bg-white rounded-t-3xl px-4 pt-5 pb-10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-base">Confirm Receipt</span>
              <button onClick={() => setConfirmItem(null)} className="text-gray-400 text-lg">×</button>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3 mb-4 text-sm">
              <div className="font-medium text-gray-900 mb-1">{confirmItem.name}</div>
              <div className="text-gray-500">
                Expected: {confirmItem.quantity} {confirmItem.unit} × RM {confirmItem.unit_price} = {fmtAmt(confirmItem.total_price)}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Actual Unit Price (RM/{confirmItem.unit})</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-green-400"
                  style={{ fontSize: 16 }} type="number" inputMode="decimal"
                  value={actualPrice} onChange={e => setActualPrice(e.target.value)} />
                {actualPrice && (
                  <div className="text-xs text-gray-400 mt-1 text-right">
                    Actual Total: RM {((parseFloat(actualPrice) || 0) * (confirmItem.quantity || 0)).toFixed(2)}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Received By</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-green-400"
                  style={{ fontSize: 16 }} placeholder="Optional"
                  value={receivedBy} onChange={e => setReceivedBy(e.target.value)} />
              </div>
              <button onClick={confirmReceive} disabled={confirming}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-white"
                style={{ background: '#22c55e' }}>
                {confirming ? 'Confirming...' : '✓ Confirm Received'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
