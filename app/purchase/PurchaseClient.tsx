'use client'

import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { todayLocalStr } from '@/lib/dateUtils'
import DatePicker from '../components/DatePicker'
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
const COMMON_ITEMS = [
  'Chicken Thigh', 'Chicken Breast', 'Whole Chicken', 'Pork Belly', 'Pork Ribs', 'Pork Shoulder',
  'Beef', 'Lamb', 'Fish Fillet', 'Shrimp', 'Squid', 'Crab', 'Tofu', 'Eggs',
  'Garlic', 'Ginger', 'Green Onion', 'Cabbage', 'Bok Choy', 'Spinach', 'Potato', 'Tomato',
  'Mushroom', 'Bean Sprouts', 'Corn', 'Carrot', 'Celery', 'Eggplant',
  'Soy Sauce', 'Oyster Sauce', 'Cooking Oil', 'Salt', 'Sugar', 'Vinegar',
  'Cornstarch', 'Sesame Oil', 'Chili', 'Star Anise',
  'Rice', 'Noodles', 'Packaging Box', 'Disposable Gloves', 'Cling Wrap',
]

const CATEGORY_COLOR: Record<string, string> = {
  'Meat': '#ef4444', 'Seafood': '#3b82f6', 'Vegetables': '#22c55e',
  'Condiments': '#f59e0b', 'Staples': '#8b5cf6', 'Supplies': '#64748b', 'Other': '#9ca3af',
}
const CATEGORY_ORDER = ['Meat', 'Seafood', 'Vegetables', 'Condiments', 'Staples', 'Supplies', 'Other']

function getCatColor(cat: string) { return CATEGORY_COLOR[cat] ?? '#9ca3af' }

function sortItems(items: PurchaseItem[]) {
  return [...items].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category)
    const bi = CATEGORY_ORDER.indexOf(b.category)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
}

function fmtAmt(n: number | null | undefined) {
  if (n == null || n === 0) return 'RM —'
  return `RM ${Number(n).toFixed(2)}`
}

const emptyForm = { name: '', category: 'Vegetables', unit: 'kg', quantity: '', unit_price: '' }

function InlinePicker({ value, options, onChange, label }: {
  value: string; options: string[]; onChange: (v: string) => void; label: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-left flex items-center justify-between bg-white"
        style={{ fontSize: 16 }}>
        <span className="text-gray-800">{value}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden">
          {options.map(opt => (
            <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 hover:bg-orange-50"
              style={{ fontSize: 16, color: opt === value ? '#f97316' : '#374151', fontWeight: opt === value ? 600 : 400 }}>
              {opt}
            </button>
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
        style={{ fontSize: 16 }} placeholder="Type or search..."
        value={value} autoFocus
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-y-auto" style={{ maxHeight: 160 }}>
          {filtered.map(item => (
            <button key={item} type="button" onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(item); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 hover:bg-orange-50"
              style={{ fontSize: 16, color: item === value ? '#f97316' : '#374151', fontWeight: item === value ? 600 : 400 }}>
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

export default function PurchaseClient({ initialItems, initialDate }: {
  initialItems: PurchaseItem[]; initialDate: string
}) {
  const today = todayLocalStr()
  const [items, setItems] = useState(initialItems)
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [fetching, setFetching] = useState(false)
  const [toggling, setToggling] = useState<number | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const cache = useRef<Record<string, PurchaseItem[]>>({ [initialDate]: initialItems })

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

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

  async function toggleComplete(item: PurchaseItem) {
    const newStatus = item.status === 'completed' ? 'pending' : 'completed'
    setToggling(item.id)
    await supabase.from('purchase_items').update({ status: newStatus }).eq('id', item.id)
    const updated = items.map(i => i.id === item.id ? { ...i, status: newStatus } : i)
    setItems(updated); cache.current[selectedDate] = updated; setToggling(null)
  }

  async function handleAdd() {
    if (!form.name.trim()) return
    setSaving(true)
    const qty = parseFloat(form.quantity) || 0
    const up = parseFloat(form.unit_price) || 0
    const row = {
      date: selectedDate, name: form.name.trim(), category: form.category,
      unit: form.unit, quantity: qty, unit_price: up, total_price: qty * up,
      status: 'pending', purchase_method: 'Supplier Delivery',
    }
    const { data, error } = await supabase.from('purchase_items').insert(row).select().single()
    if (data) {
      const updated = [...items, data as PurchaseItem]
      setItems(updated); cache.current[selectedDate] = updated
    } else {
      const temp = { ...row, id: Date.now(), supplier: null, note: null, purchase_method: 'Supplier Delivery' } as PurchaseItem
      const updated = [...items, temp]
      setItems(updated); cache.current[selectedDate] = updated
      if (error) console.error(error)
    }
    setForm(emptyForm); setSaving(false); setShowAdd(false)
  }

  const isCompleted = (i: PurchaseItem) => i.status === 'completed'
  const pending = sortItems(items.filter(i => !isCompleted(i)))
  const completed = sortItems(items.filter(i => isCompleted(i)))

  const totalAmt = items.reduce((s, i) => s + (i.total_price ?? 0), 0)
  const pendingAmt = pending.reduce((s, i) => s + (i.total_price ?? 0), 0)

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>

      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <BackButton href="/" />
          <span className="font-semibold text-base">Purchase</span>
        </div>
        <button onClick={() => { setShowAdd(true); setForm(emptyForm) }}
          className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center">
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
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold text-gray-900">{fmtAmt(totalAmt)}</div>
            <div className="text-xs text-gray-400 mt-0.5">Pending {fmtAmt(pendingAmt)}</div>
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <div className="text-xl font-bold text-orange-500">{pending.length}</div>
              <div className="text-xs text-gray-400">Pending</div>
            </div>
            <div>
              <div className="text-xl font-bold text-green-500">{completed.length}</div>
              <div className="text-xs text-gray-400">Done</div>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto" style={{ background: '#fff' }}>
        {fetching && <div className="text-center text-gray-400 py-8 text-sm">Loading...</div>}

        {/* Pending items */}
        {!fetching && pending.length > 0 && (
          <>
            <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b">
              To Order ({pending.length})
            </div>
            {pending.map((item, idx) => (
              <ItemRow key={item.id} item={item} isLast={idx === pending.length - 1}
                toggling={toggling === item.id} onToggle={() => toggleComplete(item)} />
            ))}
          </>
        )}

        {!fetching && pending.length === 0 && completed.length === 0 && (
          <div className="text-center text-gray-400 py-16">
            <div className="text-4xl mb-3">🛒</div>
            <div className="text-sm">No items for this date</div>
          </div>
        )}

        {/* Completed items */}
        {!fetching && completed.length > 0 && (
          <>
            <button
              onClick={() => setShowCompleted(s => !s)}
              className="w-full px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-t flex items-center justify-between"
            >
              <span>Done ({completed.length})</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: showCompleted ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showCompleted && completed.map((item, idx) => (
              <ItemRow key={item.id} item={item} isLast={idx === completed.length - 1}
                toggling={toggling === item.id} onToggle={() => toggleComplete(item)} />
            ))}
          </>
        )}
      </div>

      {/* Add Panel */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '88vh' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-4 pt-5 pb-3 flex items-center justify-between flex-shrink-0 border-b border-gray-100">
              <span className="font-semibold text-base">Add Item</span>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 text-xl leading-none">×</button>
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
              <button onClick={handleAdd} disabled={saving || !form.name.trim()}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-white"
                style={{ background: form.name.trim() ? '#f97316' : '#d1d5db' }}>
                {saving ? 'Saving...' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, isLast, toggling, onToggle }: {
  item: PurchaseItem; isLast: boolean; toggling: boolean; onToggle: () => void
}) {
  const done = item.status === 'completed'
  const catColor = getCatColor(item.category)
  const total = item.total_price ?? 0
  const unitPrice = item.unit_price ?? 0

  return (
    <div className={`flex items-center px-4 py-2.5 ${!isLast ? 'border-b border-gray-100' : ''}`}
      style={{ borderLeft: `3px solid ${done ? '#e5e7eb' : catColor}`, minHeight: 52 }}>
      {/* Checkbox */}
      <button onClick={onToggle} disabled={toggling}
        className="flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center mr-3 transition-all"
        style={{
          borderColor: done ? '#9ca3af' : catColor,
          background: done ? '#9ca3af' : 'transparent',
          color: '#fff',
          opacity: toggling ? 0.5 : 1,
        }}>
        {done && <CheckIcon />}
      </button>

      {/* Name → detail link */}
      <Link href={`/purchase/${item.id}`} className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm truncate" style={{ color: done ? '#9ca3af' : '#111827', textDecoration: done ? 'line-through' : 'none' }}>
            {item.name}
          </span>
          <span className="text-sm font-semibold flex-shrink-0" style={{ color: done ? '#9ca3af' : '#111827' }}>
            {total > 0 ? `RM ${total.toFixed(2)}` : '—'}
          </span>
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          {unitPrice > 0 ? `RM${unitPrice}/${item.unit}` : '—'} · {item.quantity > 0 ? `${item.quantity} ${item.unit}` : '—'}
        </div>
      </Link>
    </div>
  )
}
