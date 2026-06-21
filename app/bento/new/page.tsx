'use client'

import { useState } from 'react'
import BackButton from '../../components/BackButton'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const AREAS = ['Likas', 'Luyang', 'Lintas']

const ITEM_TYPES = [
  { value: 'light',      label: 'Light' },
  { value: 'flavorful',  label: 'Flavorful' },
  { value: 'vegetarian', label: 'Vegetarian' },
]

const PAYMENT_STATUSES = [
  { value: 'unpaid',  label: 'Unpaid' },
  { value: 'paid',    label: 'Paid' },
  { value: 'partial', label: 'Partial' },
]

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'qr',            label: 'QR' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other',         label: 'Other' },
]

type BentoItem = { type: string; quantity: number }

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const INPUT = 'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400'
const INPUT_SM = 'w-full min-w-0 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400'

export default function NewBentoOrder() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    customer_name:    '',
    phone:            '',
    delivery_date:    todayStr(),
    area:             '',
    delivery_time:    '',
    address:          '',
    amount:           '',
    note:             '',
    // Kitchen production
    bento_items:      '',
    compartment_a:    '',
    compartment_b:    '',
    compartment_c:    '',
    fulfillment_type: 'delivery',
    ready_by:         '',
    // Payment
    payment_status:   'unpaid',
    payment_method:   '',
    amount_paid:      '0',
    payment_note:     '',
  })
  const [orderItems, setOrderItems] = useState<BentoItem[]>([{ type: '', quantity: 1 }])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(prev => {
      const next = { ...prev, [name]: value }
      // Keep amount_paid synced when user edits total amount while Paid is selected
      if (name === 'amount' && prev.payment_status === 'paid') next.amount_paid = value
      return next
    })
  }

  function handlePaymentStatus(status: string) {
    setForm(prev => ({
      ...prev,
      payment_status: status,
      amount_paid:
        status === 'paid'   ? (prev.amount || '0') :
        status === 'unpaid' ? '0' :
        prev.amount_paid,
    }))
  }

  function addItem() {
    setOrderItems(prev => [...prev, { type: '', quantity: 1 }])
  }
  function removeItem(idx: number) {
    setOrderItems(prev => prev.filter((_, i) => i !== idx))
  }
  function setItemType(idx: number, type: string) {
    setOrderItems(prev => prev.map((item, i) => i === idx ? { ...item, type } : item))
  }
  function adjustQty(idx: number, delta: number) {
    setOrderItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    ))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customer_name.trim())              { setError('Customer name is required.'); return }
    if (!orderItems.every(item => item.type))    { setError('Please select a menu type for each item.'); return }
    if (!form.amount)                            { setError('Amount (RM) is required.'); return }

    // Serialize items: "Light x2, Flavorful x1"
    const itemsText = orderItems
      .map(item => `${ITEM_TYPES.find(t => t.value === item.type)?.label ?? item.type} x${item.quantity}`)
      .join(', ')
    const totalQty = orderItems.reduce((s, item) => s + item.quantity, 0)

    setLoading(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('bento_orders').insert({
        date:                    form.delivery_date,
        customer_name:           form.customer_name.trim(),
        phone:                   form.phone,
        address:                 form.address,
        area:                    form.area,
        menu_type:               orderItems[0]?.type ?? '',
        items:                   itemsText,
        note:                    form.note,
        amount:                  parseFloat(form.amount),
        quantity:                totalQty,
        paid:                    form.payment_status === 'paid',
        status:                  'pending',
        // Kitchen production
        bento_items:             form.bento_items || null,
        compartment_a:           form.compartment_a || null,
        compartment_b:           form.compartment_b || null,
        compartment_c:           form.compartment_c || null,
        fulfillment_type:        form.fulfillment_type || null,
        ready_by:                form.ready_by || null,
        delivery_or_pickup_time: form.delivery_time || null,
        // Payment
        payment_status:          form.payment_status,
        payment_method:          form.payment_method || null,
        amount_paid:             parseFloat(form.amount_paid) || 0,
        payment_note:            form.payment_note,
      })
      if (err) {
        setError(err.message || 'Failed to create order.')
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

  const showPaymentDetails = form.payment_status === 'paid' || form.payment_status === 'partial'

  return (
    <div
      className="page-slide-in flex min-h-0 w-full max-w-full flex-col overflow-hidden"
      style={{ position: 'relative', flex: '1 1 0%', minHeight: 0, width: '100%', height: '100dvh', maxHeight: '100dvh', overflowX: 'hidden', overflowY: 'hidden', background: '#f9fafb' }}
    >
      <div className="flex-none bg-white px-4 py-3 flex items-center gap-3 border-b">
        <BackButton href="/bento" />
        <span className="font-semibold text-base">New Bento Order</span>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto px-4 py-4 space-y-4"
        style={{ flex: '1 1 0%', minHeight: 0, width: '100%', maxWidth: '100%', overflowX: 'hidden', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', touchAction: 'pan-y', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}
      >

        {/* ── Customer ── */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Customer Name *</label>
          <input type="text" name="customer_name" placeholder="Example: Alex Lee"
            value={form.customer_name} onChange={handleChange} className={INPUT} />
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">Phone</label>
          <input type="tel" name="phone" placeholder="Example: 0123456789"
            value={form.phone} onChange={handleChange} className={INPUT} />
        </div>

        {/* ── Delivery Date ── */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Delivery Date *</label>
          <input type="date" name="delivery_date"
            value={form.delivery_date} onChange={handleChange} className={INPUT} />
        </div>

        {/* ── Delivery Area + Time (same row) ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="text-sm text-gray-600 mb-1 block">Delivery Area</label>
            <select name="area" value={form.area} onChange={handleChange} className={INPUT_SM}>
              <option value="">Select...</option>
              {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="min-w-0">
            <label className="text-sm text-gray-600 mb-1 block">Delivery Time</label>
            <input type="time" name="delivery_time"
              value={form.delivery_time} onChange={handleChange} className={INPUT_SM} />
          </div>
        </div>

        {/* ── Address ── */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Delivery Address</label>
          <input type="text" name="address" placeholder="Example: Jalan Gaya 12, KK"
            value={form.address} onChange={handleChange} className={INPUT} />
        </div>

        {/* ── Items ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm text-gray-600 font-medium">Items *</label>
            <button
              type="button"
              onClick={addItem}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xl leading-none active:opacity-70"
              style={{ background: '#f97316' }}
              aria-label="Add item"
            >+</button>
          </div>

          <div className="space-y-3">
            {orderItems.map((item, idx) => (
              <div key={idx} className="bg-white rounded-2xl px-4 pt-3 pb-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Item #{idx + 1}
                  </span>
                  {orderItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-gray-300 active:text-red-400 p-1 -mr-1"
                      aria-label="Remove item"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>

                {/* Menu type selector */}
                <div className="mb-3">
                  <span className="text-xs text-gray-400 mb-2 block">Menu Type</span>
                  <div className="flex gap-2">
                    {ITEM_TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setItemType(idx, t.value)}
                        className={`flex-1 py-2 rounded-xl text-sm border transition-colors ${
                          item.type === t.value
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >{t.label}</button>
                    ))}
                  </div>
                </div>

                {/* Quantity stepper */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">Quantity</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustQty(idx, -1)}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-lg leading-none active:bg-gray-200"
                    >−</button>
                    <span className="text-sm font-semibold w-6 text-center tabular-nums">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => adjustQty(idx, 1)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-lg leading-none active:opacity-70"
                      style={{ background: '#f97316' }}
                    >+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Kitchen Production ── */}
        <div className="pt-2 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 mt-3">Kitchen production</div>

          <div className="mb-4">
            <label className="text-sm text-gray-600 mb-1 block">Bento name</label>
            <input type="text" name="bento_items" placeholder="Example: Salted egg yolk chicken"
              value={form.bento_items} onChange={handleChange} className={INPUT} />
          </div>

          <div className="space-y-2 mb-4">
            {([
              { name: 'compartment_a', placeholder: 'Main dish / protein',    color: '#f97316', label: 'A' },
              { name: 'compartment_b', placeholder: 'Side dish / veg / fruit', color: '#22c55e', label: 'B' },
              { name: 'compartment_c', placeholder: 'Staple / rice / noodles', color: '#3b82f6', label: 'C' },
            ] as const).map(c => (
              <div key={c.name} className="flex items-center gap-2">
                <span className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: c.color }}>{c.label}</span>
                <input type="text" name={c.name} placeholder={c.placeholder}
                  value={form[c.name]} onChange={handleChange}
                  className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400" />
              </div>
            ))}
          </div>

          <div className="mb-4">
            <label className="text-sm text-gray-600 mb-1 block">Fulfillment</label>
            <div className="flex gap-2">
              {(['delivery', 'pickup'] as const).map(ft => (
                <button key={ft} type="button"
                  onClick={() => setForm(prev => ({ ...prev, fulfillment_type: ft }))}
                  className={`flex-1 py-2 rounded-xl text-sm border capitalize ${
                    form.fulfillment_type === ft
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >{ft}</button>
              ))}
            </div>
          </div>

          <div style={{ maxWidth: '50%' }}>
            <label className="text-xs text-gray-500 mb-1 block">Ready by</label>
            <input type="time" name="ready_by" value={form.ready_by} onChange={handleChange} className={INPUT_SM} />
          </div>
        </div>

        {/* ── Amount ── */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Amount (RM) *</label>
          <input type="number" name="amount" placeholder="25.50"
            value={form.amount} onChange={handleChange} className={INPUT} />
        </div>

        {/* ── Notes ── */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Notes</label>
          <textarea name="note" placeholder="Example: No spicy, less salt"
            value={form.note} onChange={handleChange} rows={3}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400 resize-none" />
        </div>

        {/* ── Payment ── */}
        <div className="pt-2 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 mt-3">Payment</div>

          <div className="mb-4">
            <label className="text-sm text-gray-600 mb-2 block">Payment Status</label>
            <div className="flex gap-2">
              {PAYMENT_STATUSES.map(s => (
                <button key={s.value} type="button" onClick={() => handlePaymentStatus(s.value)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border ${
                    form.payment_status === s.value
                      ? s.value === 'paid'    ? 'bg-green-500 text-white border-green-500'
                        : s.value === 'partial' ? 'bg-blue-500 text-white border-blue-500'
                        :                         'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >{s.label}</button>
              ))}
            </div>
          </div>

          {showPaymentDetails && (
            <>
              <div className="mb-4">
                <label className="text-sm text-gray-600 mb-2 block">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(m => (
                    <button key={m.value} type="button"
                      onClick={() => setForm(prev => ({ ...prev, payment_method: m.value }))}
                      className={`py-2.5 rounded-xl text-sm border ${
                        form.payment_method === m.value
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >{m.label}</button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm text-gray-600 mb-1 block">
                  Amount Paid (RM){form.payment_status === 'partial' ? ' *' : ''}
                </label>
                <input type="number" name="amount_paid" placeholder="0.00"
                  value={form.amount_paid} onChange={handleChange} className={INPUT} />
                {form.payment_status === 'partial' && form.amount && form.amount_paid &&
                  parseFloat(form.amount_paid) >= parseFloat(form.amount) && (
                  <p className="text-xs text-orange-500 mt-1">Amount paid should be less than total amount for partial payment.</p>
                )}
              </div>
            </>
          )}

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Payment Note</label>
            <input type="text" name="payment_note" placeholder="Example: Will pay on delivery"
              value={form.payment_note} onChange={handleChange} className={INPUT} />
          </div>
        </div>

        {/* ── Submit ── */}
        <button type="submit" disabled={loading}
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium text-sm active:opacity-80">
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
