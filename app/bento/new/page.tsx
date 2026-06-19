'use client'

import { useState } from 'react'
import BackButton from '../../components/BackButton'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const AREAS = ['Likas', 'Luyang', 'Lintas']
const MENU_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'signature', label: 'Signature' },
  { value: 'vegetarian', label: 'Vegetarian' },
]

export default function NewBentoOrder() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    address: '',
    area: '',
    menu_type: '',
    items: '',
    note: '',
    amount: '',
    quantity: '1',
    // Bento production fields
    bento_items: '',
    compartment_a: '',
    compartment_b: '',
    compartment_c: '',
    fulfillment_type: 'delivery',
    ready_by: '',
    delivery_or_pickup_time: '',
    pack_time: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customer_name || !form.items || !form.amount) return
    setLoading(true)
    setError(null)
    try {
      const today = new Date().toISOString().split('T')[0]
      const { error: insertError } = await supabase.from('bento_orders').insert({
        date: today,
        customer_name: form.customer_name,
        phone: form.phone,
        address: form.address,
        area: form.area,
        menu_type: form.menu_type,
        items: form.items,
        note: form.note,
        amount: parseFloat(form.amount),
        quantity: parseInt(form.quantity) || 1,
        paid: false,
        status: 'pending',
        // Bento production fields (empty time/text → null)
        bento_items: form.bento_items || null,
        compartment_a: form.compartment_a || null,
        compartment_b: form.compartment_b || null,
        compartment_c: form.compartment_c || null,
        fulfillment_type: form.fulfillment_type || null,
        ready_by: form.ready_by || null,
        delivery_or_pickup_time: form.delivery_or_pickup_time || null,
        pack_time: form.pack_time || null,
      })
      if (insertError) {
        setError(insertError.message || 'Failed to create order. Please try again.')
        setLoading(false)
        return
      }
      router.push('/bento')
      router.refresh()
    } catch {
      setError('Network error. Please check your connection.')
      setLoading(false)
    }
  }

  return (
    <div className="page-slide-in flex min-h-0 w-full max-w-full flex-col overflow-hidden" style={{ position: 'relative', flex: '1 1 0%', minHeight: 0, width: '100%', height: '100dvh', maxHeight: '100dvh', overflowX: 'hidden', overflowY: 'hidden', background: '#f9fafb' }}>
      <div className="flex-none bg-white px-4 py-3 flex items-center gap-3 border-b">
        <BackButton href="/bento" />
        <span className="font-semibold text-base">New Bento Order</span>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex-1 min-h-0 w-full max-w-full overflow-x-hidden overflow-y-auto px-4 py-4 space-y-4"
        style={{ flex: '1 1 0%', minHeight: 0, width: '100%', maxWidth: '100%', overflowX: 'hidden', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', touchAction: 'pan-y', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}
      >
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Customer Name *</label>
          <input
            type="text"
            name="customer_name"
            placeholder="Example: Alex Lee"
            value={form.customer_name}
            onChange={handleChange}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
          />
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">Phone</label>
          <input
            type="tel"
            name="phone"
            placeholder="Example: 0123456789"
            value={form.phone}
            onChange={handleChange}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
          />
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">Delivery Area</label>
          <div className="flex gap-2">
            {AREAS.map(area => (
              <button
                key={area}
                type="button"
                onClick={() => setForm({ ...form, area })}
                className={`flex-1 py-2 rounded-xl text-sm border ${
                  form.area === area
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">Menu Type</label>
          <div className="flex gap-2">
            {MENU_TYPES.map(type => (
              <button
                key={type.value}
                type="button"
                onClick={() => setForm({ ...form, menu_type: type.value })}
                className={`flex-1 py-2 rounded-xl text-sm border ${
                  form.menu_type === type.value
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">Delivery Address</label>
          <input
            type="text"
            name="address"
            placeholder="Example: Jalan Gaya 12, KK"
            value={form.address}
            onChange={handleChange}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
          />
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">Items *</label>
          <input
            type="text"
            name="items"
            placeholder="Example: Chicken rice x2, Beef rice x1"
            value={form.items}
            onChange={handleChange}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
          />
        </div>

        {/* Bento production — feeds the Kitchen Production Sheet */}
        <div className="pt-2 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 mt-3">Kitchen production</div>

          <div className="mb-4">
            <label className="text-sm text-gray-600 mb-1 block">Bento name</label>
            <input
              type="text"
              name="bento_items"
              placeholder="Example: Salted egg yolk chicken"
              value={form.bento_items}
              onChange={handleChange}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
            />
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: '#f97316' }}>A</span>
              <input
                type="text"
                name="compartment_a"
                placeholder="Main dish / protein"
                value={form.compartment_a}
                onChange={handleChange}
                className="flex-1 min-w-0 max-w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: '#22c55e' }}>B</span>
              <input
                type="text"
                name="compartment_b"
                placeholder="Side dish / veg / fruit"
                value={form.compartment_b}
                onChange={handleChange}
                className="flex-1 min-w-0 max-w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: '#3b82f6' }}>C</span>
              <input
                type="text"
                name="compartment_c"
                placeholder="Staple / rice / noodles"
                value={form.compartment_c}
                onChange={handleChange}
                className="flex-1 min-w-0 max-w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="text-sm text-gray-600 mb-1 block">Fulfillment</label>
            <div className="flex gap-2">
              {(['delivery', 'pickup'] as const).map(ft => (
                <button
                  key={ft}
                  type="button"
                  onClick={() => setForm({ ...form, fulfillment_type: ft })}
                  className={`flex-1 py-2 rounded-xl text-sm border capitalize ${
                    form.fulfillment_type === ft
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {ft}
                </button>
              ))}
            </div>
          </div>

          <div className="grid w-full max-w-full grid-cols-3 gap-2 overflow-x-hidden">
            <div className="min-w-0">
              <label className="text-xs text-gray-500 mb-1 block">Ready by</label>
              <input
                type="time"
                name="ready_by"
                value={form.ready_by}
                onChange={handleChange}
                className="w-full min-w-0 max-w-full bg-white border border-gray-200 rounded-xl px-2 py-2.5 text-sm outline-none focus:border-orange-400"
              />
            </div>
            <div className="min-w-0">
              <label className="text-xs text-gray-500 mb-1 block capitalize">{form.fulfillment_type} time</label>
              <input
                type="time"
                name="delivery_or_pickup_time"
                value={form.delivery_or_pickup_time}
                onChange={handleChange}
                className="w-full min-w-0 max-w-full bg-white border border-gray-200 rounded-xl px-2 py-2.5 text-sm outline-none focus:border-orange-400"
              />
            </div>
            <div className="min-w-0">
              <label className="text-xs text-gray-500 mb-1 block">Pack time</label>
              <input
                type="time"
                name="pack_time"
                value={form.pack_time}
                onChange={handleChange}
                className="w-full min-w-0 max-w-full bg-white border border-gray-200 rounded-xl px-2 py-2.5 text-sm outline-none focus:border-orange-400"
              />
            </div>
          </div>
        </div>

        <div className="grid w-full max-w-full grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="text-sm text-gray-600 mb-1 block">Amount (RM) *</label>
            <input
              type="number"
              name="amount"
              placeholder="25.50"
              value={form.amount}
              onChange={handleChange}
              className="w-full min-w-0 max-w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
            />
          </div>
          <div className="min-w-0">
            <label className="text-sm text-gray-600 mb-1 block">Portions *</label>
            <input
              type="number"
              name="quantity"
              placeholder="1"
              min="1"
              value={form.quantity}
              onChange={handleChange}
              className="w-full min-w-0 max-w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">Notes</label>
          <textarea
            name="note"
            placeholder="Example: No spicy, less salt"
            value={form.note}
            onChange={handleChange}
            rows={3}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium text-sm"
        >
          {loading ? 'Submitting...' : 'Create Order'}
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
