'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import BackButton from '../../../../components/BackButton'
import { supabase } from '@/lib/supabase/client'

const DELIVERY_METHODS = [
  { value: 'pickup', label: '🏪 Pickup' },
  { value: 'delivery', label: '🚚 Delivery' },
]
const AREAS = ['Likas', 'Luyang', 'Lintas', 'Other']
const DELIVERY_FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
]

const SUB_TYPE_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  school: 'School / Custom',
}

// Read-only subscription accounting snapshot — shown for reference, never edited here.
type SubscriptionMeta = {
  subscription_type: string
  start_date: string
  total_portions: number
  used_portions: number
  active: boolean
}

export default function EditCustomerPage() {
  const params = useParams()
  const id = params.id as string
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Editable: contact + delivery information only.
  const [form, setForm] = useState({
    name: '', phone: '', delivery_method: 'pickup', delivery_frequency: 'weekdays',
    delivery_address: '', area: '', menu_preference: '', taste_notes: '', note: '',
  })
  // Read-only: subscription accounting (never sent in the update payload).
  const [meta, setMeta] = useState<SubscriptionMeta | null>(null)

  useEffect(() => {
    supabase.from('bento_customers').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setForm({
          name: data.name ?? '',
          phone: data.phone ?? '',
          delivery_method: data.delivery_method ?? 'pickup',
          delivery_frequency: data.delivery_frequency ?? 'weekdays',
          delivery_address: data.delivery_address ?? '',
          area: data.area ?? '',
          menu_preference: data.menu_preference ?? '',
          taste_notes: data.taste_notes ?? '',
          note: data.note ?? '',
        })
        setMeta({
          subscription_type: data.subscription_type ?? 'monthly',
          start_date: data.start_date ?? '',
          total_portions: data.total_portions ?? 0,
          used_portions: data.used_portions ?? 0,
          active: data.active ?? true,
        })
      }
      setLoading(false)
    })
  }, [id])

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      // Only contact/delivery fields are updated. Subscription accounting
      // (subscription_type, start_date, total_portions, used_portions, active)
      // is intentionally omitted so it can never change from profile editing.
      const { error: updateError } = await supabase.from('bento_customers').update({
        name: form.name.trim(),
        phone: form.phone,
        delivery_method: form.delivery_method,
        delivery_frequency: form.delivery_frequency,
        delivery_address: form.delivery_address,
        area: form.area,
        menu_preference: form.menu_preference,
        taste_notes: form.taste_notes,
        note: form.note,
      }).eq('id', id)
      if (updateError) {
        setError(updateError.message || 'Failed to save. Please try again.')
        setSaving(false)
        return
      }
      window.location.href = `/bento/customers/${id}`
    } catch {
      setError('Network error. Please check your connection.')
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  )

  const remaining = meta ? meta.total_portions - meta.used_portions : 0

  return (
    <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b" style={{ flexShrink: 0 }}>
        <BackButton href={`/bento/customers/${id}`} />
        <span className="font-semibold text-base">Edit Customer</span>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Customer ID</label>
          <div className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono text-gray-400">
            C{String(id).padStart(3, '0')}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Name *</label>
          <input className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400" style={{ fontSize: 16 }}
            placeholder="Customer name" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Phone</label>
          <input className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400" style={{ fontSize: 16 }}
            placeholder="0123456789" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Delivery / Pickup</label>
          <div className="flex gap-2">
            {DELIVERY_METHODS.map(m => (
              <button key={m.value} type="button" onClick={() => set('delivery_method', m.value)}
                className={`flex-1 py-2.5 rounded-xl text-sm border font-medium ${form.delivery_method === m.value ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Delivery Frequency</label>
          <div className="flex gap-2">
            {DELIVERY_FREQUENCIES.map(f => (
              <button key={f.value} type="button" onClick={() => set('delivery_frequency', f.value)}
                className={`flex-1 py-2.5 rounded-xl text-sm border font-medium ${form.delivery_frequency === f.value ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            {form.delivery_frequency === 'daily' ? 'Delivers every day, incl. weekends & public holidays' : 'Delivers Mon–Fri only (skips weekends)'}
          </div>
        </div>

        {form.delivery_method === 'delivery' && (
          <>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Delivery Area</label>
              <div className="flex gap-2 flex-wrap">
                {AREAS.map(a => (
                  <button key={a} type="button" onClick={() => set('area', a)}
                    className={`px-4 py-2 rounded-xl text-sm border ${form.area === a ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Delivery Address</label>
              <input className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400" style={{ fontSize: 16 }}
                placeholder="Full address" value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} />
            </div>
          </>
        )}

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Menu Preference</label>
          <input className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400" style={{ fontSize: 16 }}
            placeholder="e.g. Standard, Signature, Vegetarian" value={form.menu_preference} onChange={e => set('menu_preference', e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Taste Notes</label>
          <input className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400" style={{ fontSize: 16 }}
            placeholder="e.g. mild, no spicy, extra rice, no pork" value={form.taste_notes} onChange={e => set('taste_notes', e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Notes</label>
          <textarea className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400 resize-none" style={{ fontSize: 16 }}
            rows={3} placeholder="Any other notes..." value={form.note} onChange={e => set('note', e.target.value)} />
        </div>

        {/* Subscription accounting — read-only. Manage portions/status from the customer detail page. */}
        {meta && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subscription (read-only)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Subscription Type</div>
                <div className="text-sm font-medium text-gray-700">{SUB_TYPE_LABELS[meta.subscription_type] ?? meta.subscription_type}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Subscription Status</div>
                <div className={`text-sm font-medium ${meta.active ? 'text-green-600' : 'text-gray-400'}`}>{meta.active ? 'Active' : 'Inactive'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Total Portions</div>
                <div className="text-sm font-medium text-gray-700">{meta.total_portions}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Used Portions</div>
                <div className="text-sm font-medium text-gray-700">{meta.used_portions}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Remaining Portions</div>
                <div className="text-sm font-medium text-gray-700">{remaining}</div>
              </div>
              {meta.start_date && (
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Start Date</div>
                  <div className="text-sm font-medium text-gray-700">{meta.start_date}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <button type="submit" disabled={saving || !form.name.trim()}
          className="w-full py-3 rounded-2xl text-sm font-semibold text-white mb-8"
          style={{ background: form.name.trim() ? '#f97316' : '#d1d5db' }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2 mb-8">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
          </div>
        )}
      </form>
    </div>
  )
}
