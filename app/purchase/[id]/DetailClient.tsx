'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BackButton from '../../components/BackButton'

type PurchaseItem = {
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
const PURCHASE_METHODS = ['Supplier Delivery', 'Self Purchase']

const CATEGORY_COLOR: Record<string, string> = {
  'Meat': '#ef4444', 'Seafood': '#3b82f6', 'Vegetables': '#22c55e',
  'Condiments': '#f59e0b', 'Staples': '#8b5cf6', 'Supplies': '#64748b', 'Other': '#9ca3af',
}

function InlinePicker({ value, options, onChange, label }: {
  value: string; options: string[]; onChange: (v: string) => void; label: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full text-left flex items-center justify-between py-3 border-b border-gray-100">
        <span className="text-xs text-gray-400 w-28 flex-shrink-0">{label}</span>
        <span className="flex-1 text-gray-900" style={{ fontSize: 16 }}>{value}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden" style={{ top: '100%' }}>
          {options.map(opt => (
            <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false) }}
              className="w-full text-left px-4 py-3 hover:bg-orange-50 border-b border-gray-50 last:border-0"
              style={{ fontSize: 16, color: opt === value ? '#f97316' : '#374151', fontWeight: opt === value ? 600 : 400 }}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center py-3 border-b border-gray-100">
      <span className="text-xs text-gray-400 w-28 flex-shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

export default function DetailClient({ itemId }: { itemId?: number }) {
  const params = useParams()
  const router = useRouter()
  const id = itemId ? String(itemId) : params?.id as string

  const [item, setItem] = useState<PurchaseItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [form, setForm] = useState({
    name: '', category: 'Vegetables', unit: 'kg',
    quantity: '', unit_price: '',
    supplier: '', purchase_method: 'Supplier Delivery', note: '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase.from('purchase_items').select('*').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true)
        } else {
          const it = data as PurchaseItem
          setItem(it)
          setForm({
            name: it.name ?? '',
            category: it.category ?? 'Vegetables',
            unit: it.unit ?? 'kg',
            quantity: String(it.quantity ?? ''),
            unit_price: String(it.unit_price ?? ''),
            supplier: it.supplier ?? '',
            purchase_method: it.purchase_method ?? 'Supplier Delivery',
            note: it.note ?? '',
          })
        }
        setLoading(false)
      })
  }, [id])

  const qty = parseFloat(form.quantity) || 0
  const up = parseFloat(form.unit_price) || 0
  const total = qty * up
  const catColor = CATEGORY_COLOR[form.category] ?? '#9ca3af'
  const isDone = item?.status === 'completed'

  async function handleSave() {
    if (!item) return
    setSaving(true)
    await supabase.from('purchase_items').update({
      name: form.name.trim(),
      category: form.category,
      unit: form.unit,
      quantity: qty,
      unit_price: up,
      total_price: total,
      supplier: form.supplier.trim() || null,
      purchase_method: form.purchase_method,
      note: form.note.trim() || null,
    }).eq('id', item.id)
    setSaving(false)
    router.push('/purchase')
  }

  async function handleDelete() {
    if (!item) return
    setDeleting(true)
    await supabase.from('purchase_items').delete().eq('id', item.id)
    router.push('/purchase')
  }

  async function toggleStatus() {
    if (!item) return
    const newStatus = isDone ? 'pending' : 'completed'
    await supabase.from('purchase_items').update({ status: newStatus }).eq('id', item.id)
    router.push('/purchase')
  }

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f9fafb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div className="text-gray-400 text-sm">Item not found</div>
        <button onClick={() => router.push('/purchase')}
          className="text-orange-500 text-sm font-medium">← Back to Purchase</button>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>

      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <BackButton href="/purchase" />
          <span className="font-semibold text-base">Item Detail</span>
        </div>
        <button onClick={handleSave} disabled={saving || !form.name.trim()}
          className="text-sm font-semibold px-4 py-1.5 rounded-full"
          style={{ background: form.name.trim() ? '#f97316' : '#e5e7eb', color: form.name.trim() ? '#fff' : '#9ca3af' }}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div style={{ height: 4, background: catColor }} />

        <div className="bg-white px-4">
          <FieldRow label="Name">
            <input className="w-full outline-none text-gray-900 font-medium" style={{ fontSize: 16 }}
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Item name" />
          </FieldRow>

          <InlinePicker label="Category" value={form.category} options={CATEGORIES}
            onChange={v => setForm(f => ({ ...f, category: v }))} />

          <InlinePicker label="Unit" value={form.unit} options={UNITS}
            onChange={v => setForm(f => ({ ...f, unit: v }))} />

          <FieldRow label="Qty">
            <input className="w-full outline-none text-gray-900" style={{ fontSize: 16 }}
              type="number" inputMode="decimal" placeholder="0"
              value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
          </FieldRow>

          <FieldRow label="Unit Price (RM)">
            <input className="w-full outline-none text-gray-900" style={{ fontSize: 16 }}
              type="number" inputMode="decimal" placeholder="0.00"
              value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} />
          </FieldRow>

          <FieldRow label="Total">
            <span className="font-semibold text-gray-900" style={{ fontSize: 16 }}>
              {total > 0 ? `RM ${total.toFixed(2)}` : '—'}
            </span>
          </FieldRow>

          <InlinePicker label="Method" value={form.purchase_method} options={PURCHASE_METHODS}
            onChange={v => setForm(f => ({ ...f, purchase_method: v }))} />

          <FieldRow label="Supplier">
            <input className="w-full outline-none text-gray-900" style={{ fontSize: 16 }}
              placeholder="e.g. KK Meat Supply"
              value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
          </FieldRow>

          <FieldRow label="Note">
            <input className="w-full outline-none text-gray-900" style={{ fontSize: 16 }}
              placeholder="Optional"
              value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </FieldRow>
        </div>

        <div className="px-4 mt-4">
          <button onClick={toggleStatus}
            className="w-full py-3 rounded-2xl text-sm font-semibold border-2"
            style={{
              borderColor: isDone ? '#9ca3af' : '#22c55e',
              color: isDone ? '#9ca3af' : '#22c55e',
              background: isDone ? '#f9fafb' : '#f0fdf4',
            }}>
            {isDone ? '↩ Mark as Pending' : '✓ Mark as Done'}
          </button>
        </div>

        <div className="px-4 mt-3 mb-8">
          {!showDelete ? (
            <button onClick={() => setShowDelete(true)}
              className="w-full py-3 rounded-2xl text-sm font-medium text-red-400 border border-red-100 bg-red-50">
              Delete Item
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <div className="text-sm text-red-600 font-medium mb-3 text-center">Delete "{item?.name}"?</div>
              <div className="flex gap-2">
                <button onClick={() => setShowDelete(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-600">
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500">
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
