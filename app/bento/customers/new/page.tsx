'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BackButton from '../../../components/BackButton'
import { supabase } from '@/lib/supabase/client'

const SUB_TYPES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'school', label: 'School / Custom' },
]
const DELIVERY_METHODS = [
  { value: 'pickup', label: '🏪 Pickup' },
  { value: 'delivery', label: '🚚 Delivery' },
]
const AREAS = ['Likas', 'Luyang', 'Lintas', 'Other']
const DELIVERY_FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
]

export default function NewCustomerPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    subscription_type: 'monthly',
    delivery_method: 'pickup',
    delivery_frequency: 'weekdays',
    delivery_address: '',
    area: '',
    menu_preference: '',
    taste_notes: '',
    start_date: new Date().toISOString().split('T')[0],
    total_portions: '',
    note: '',
  })

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const { error: insertError } = await supabase.from('bento_customers').insert({
        name: form.name.trim(),
        phone: form.phone,
        subscription_type: form.subscription_type,
        delivery_method: form.delivery_method,
        delivery_frequency: form.delivery_frequency,
        delivery_address: form.delivery_address,
        area: form.area,
        menu_preference: form.menu_preference,
        taste_notes: form.taste_notes,
        start_date: form.start_date || null,
        total_portions: parseInt(form.total_portions) || 0,
        used_portions: 0,
        note: form.note,
        active: true,
      })
      if (insertError) {
        setError(insertError.message || 'Failed to create customer. Please try again.')
        setSaving(false)
        return
      }
      router.replace('/bento/customers')
    } catch {
      setError('Network error. Please check your connection.')
      setSaving(false)
    }
  }

  return (
    <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b" style={{ flexShrink: 0 }}>
        <BackButton href="/bento/customers" />
        <span className="font-semibold text-base">New Customer</span>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}>
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
          <label className="text-xs text-gray-500 mb-1 block">Subscription Type</label>
          <div className="flex gap-2">
            {SUB_TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => set('subscription_type', t.value)}
                className={`flex-1 py-2.5 rounded-xl text-sm border font-medium ${form.subscription_type === t.value ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                {t.label}
              </button>
            ))}
          </div>
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
              <label className="text-xs text-gray-500 mb-1 block">Area</label>
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
            <input type="date" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
              value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Total Portions</label>
            <input type="number" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400" style={{ fontSize: 16 }}
              placeholder="e.g. 20" min="0" value={form.total_portions} onChange={e => set('total_portions', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Notes</label>
          <textarea className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400 resize-none" style={{ fontSize: 16 }}
            rows={3} placeholder="Any other notes..." value={form.note} onChange={e => set('note', e.target.value)} />
        </div>

        <button type="submit" disabled={saving || !form.name.trim()}
          className="w-full py-3 rounded-2xl text-sm font-semibold text-white"
          style={{ background: form.name.trim() ? '#f97316' : '#d1d5db' }}>
          {saving ? 'Saving...' : 'Add Customer'}
        </button>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
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
