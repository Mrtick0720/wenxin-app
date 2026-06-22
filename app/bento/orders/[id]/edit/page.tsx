'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useNavigation } from '../../../../components/NavigationStack'
import { updateOrderAction } from '../../actions'

const INPUT = 'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400'

type Props = {
  orderId?: number
  order?: Record<string, unknown>  // pre-fetched from BentoClient
}

export default function EditOrderPage({ orderId: propOrderId, order: preloadedOrder }: Props = {}) {
  const router = useRouter()
  const { pop } = useNavigation()
  const rawParams = useParams()
  const orderId = propOrderId ?? parseInt((rawParams.id as string) || '0', 10)

  const [loading, setLoading] = useState(!preloadedOrder)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    fulfillment_type: 'delivery',
    delivery_date: '',
    order_time: '',
    area: '',
    address: '',
    menu_type: '',          // selected variant code
    quantity: 1,
    unit_price: '',
    note: '',
    payment_status: 'unpaid',
    payment_method: '',
    amount_paid: '0',
    payment_note: '',
  })

  // Load order data
  useEffect(() => {
    let active = true

    function applyOrder(o: Record<string, unknown>) {
      if (!active) return
      setForm({
        customer_name: (o.customer_name as string) ?? '',
        phone: (o.phone as string) ?? '',
        fulfillment_type: (o.fulfillment_type as string) ?? 'delivery',
        delivery_date: (o.date as string) ?? '',
        order_time: (o.delivery_or_pickup_time as string) ?? '',
        area: (o.area as string) ?? '',
        address: (o.address as string) ?? '',
        menu_type: (o.menu_type as string) ?? '',
        quantity: (o.quantity as number) ?? 1,
        unit_price: o.amount && o.quantity ? String((o.amount as number) / (o.quantity as number)) : '',
        note: (o.note as string) ?? '',
        payment_status: (o.payment_status as string) ?? ((o.paid as boolean) ? 'paid' : 'unpaid'),
        payment_method: (o.payment_method as string) ?? '',
        amount_paid: String(o.amount_paid ?? (o.paid ? (o.amount ?? 0) : 0)),
        payment_note: (o.payment_note as string) ?? '',
      })
      setLoading(false)
    }

    if (preloadedOrder) {
      applyOrder(preloadedOrder)
    } else {
      supabase.from('bento_orders').select('*').eq('id', orderId).single().then(({ data }) => {
        if (!data) { setError('Order not found'); setLoading(false); return }
        applyOrder(data as Record<string, unknown>)
      })
    }

    return () => { active = false }
  }, [orderId, preloadedOrder])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSave() {
    if (!form.customer_name.trim()) { setError('Customer name is required.'); return }
    setSaving(true); setError(null)

    const unitPrice = parseFloat(form.unit_price) || 0
    const amount = unitPrice * form.quantity

    const payload: Record<string, unknown> = {
      customer_name: form.customer_name.trim(),
      phone: form.phone || null,
      fulfillment_type: form.fulfillment_type,
      date: form.delivery_date,
      delivery_or_pickup_time: form.order_time || null,
      area: form.fulfillment_type === 'delivery' ? (form.area || null) : null,
      address: form.fulfillment_type === 'delivery' ? (form.address || null) : null,
      menu_type: form.menu_type,
      quantity: form.quantity,
      amount,
      note: form.note || null,
      paid: form.payment_status === 'paid',
      payment_status: form.payment_status,
      payment_method: form.payment_method || null,
      amount_paid: parseFloat(form.amount_paid) || 0,
      payment_note: form.payment_note || '',
    }

    const res = await updateOrderAction(orderId, payload)
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    router.refresh()
    setTimeout(() => { pop() }, 400)
  }

  const isDelivery = form.fulfillment_type === 'delivery'
  const unitPrice = parseFloat(form.unit_price) || 0
  const total = unitPrice * form.quantity

  if (loading) return <main className="bg-gray-50 w-full mx-auto" style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}><div className="flex-1 flex items-center justify-center"><div className="text-gray-400">Loading…</div></div></main>

  return (
    <main className="bg-gray-50 w-full mx-auto" style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b flex-shrink-0">
        <button onClick={() => pop()} className="text-gray-400 active:text-gray-600">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="font-semibold text-base">Edit Order #{orderId}</span>
      </div>

      <div className="px-4 py-4 space-y-4 flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}>
        {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}

        {/* Customer */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Customer Name *</label>
          <input name="customer_name" placeholder="Customer name" value={form.customer_name} onChange={handleChange} className={INPUT} />
        </div>
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Phone</label>
          <input name="phone" type="tel" placeholder="0123456789" value={form.phone} onChange={handleChange} className={INPUT} />
        </div>

        {/* Fulfillment */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Fulfillment</label>
          <div className="flex gap-2">
            {(['delivery', 'pickup'] as const).map(ft => (
              <button key={ft} type="button" onClick={() => setForm(prev => ({ ...prev, fulfillment_type: ft }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border capitalize ${
                  form.fulfillment_type === ft ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'
                }`}>{ft}</button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Date</label>
          <input name="delivery_date" type="date" value={form.delivery_date} onChange={handleChange} className={INPUT} />
        </div>

        {/* Time */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">{isDelivery ? 'Delivery' : 'Pickup'} Time</label>
          <input name="order_time" type="time" value={form.order_time} onChange={handleChange} className={INPUT} />
        </div>

        {/* Delivery fields */}
        {isDelivery && (
          <>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Area</label>
              <select name="area" value={form.area} onChange={handleChange}
                className={`${INPUT} text-gray-700`}>
                <option value="">Select…</option>
                {['Likas','Luyang','Lintas','Karamunsing'].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Address</label>
              <input name="address" placeholder="Address" value={form.address} onChange={handleChange} className={INPUT} />
            </div>
          </>
        )}

        {/* Menu Type */}
        <div className="pt-2 border-t border-gray-200">
          <label className="text-sm text-gray-600 mb-2 block font-medium">Menu *</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { code: 'light', label: 'Light', color: '#3B82F6' },
              { code: 'flavorful', label: 'Flavorful', color: '#F97316' },
            ].map(v => (
              <button key={v.code} type="button" onClick={() => setForm(prev => ({ ...prev, menu_type: v.code }))}
                style={form.menu_type === v.code ? { background: v.color, borderColor: v.color } : undefined}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  form.menu_type === v.code ? 'text-white' : 'bg-white text-gray-600 border-gray-200'
                }`}>{v.label}</button>
            ))}
          </div>
        </div>

        {/* Quantity + Price */}
        <div className="pt-2 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Quantity</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setForm(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-lg leading-none active:bg-gray-200">−</button>
                <span className="text-sm font-semibold w-6 text-center">{form.quantity}</span>
                <button type="button" onClick={() => setForm(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                  className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-lg leading-none active:opacity-70">+</button>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Unit Price (RM)</label>
              <input name="unit_price" type="number" inputMode="decimal" placeholder="13.00"
                value={form.unit_price} onChange={handleChange} className={INPUT} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-500">Total</span>
            <span className="text-lg font-bold text-gray-900">RM {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Note</label>
          <textarea name="note" placeholder="Note…" value={form.note} onChange={handleChange} rows={2}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400 resize-none" />
        </div>

        {/* Payment */}
        <div className="pt-2 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 mt-3">Payment</div>
          <div className="mb-4">
            <label className="text-sm text-gray-600 mb-2 block">Status</label>
            <div className="flex gap-2">
              {(['unpaid','paid','partial'] as const).map(s => (
                <button key={s} type="button" onClick={() => setForm(prev => ({
                  ...prev, payment_status: s,
                  amount_paid: s === 'paid' ? String(total) : s === 'unpaid' ? '0' : prev.amount_paid,
                }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border capitalize ${
                    form.payment_status === s
                      ? s === 'paid' ? 'bg-green-500 text-white border-green-500' : s === 'partial' ? 'bg-blue-500 text-white border-blue-500' : 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}>{s}</button>
              ))}
            </div>
          </div>
          {(form.payment_status === 'paid' || form.payment_status === 'partial') && (
            <>
              <div className="mb-4">
                <label className="text-sm text-gray-600 mb-2 block">Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {['cash','qr','bank_transfer','other'].map(m => (
                    <button key={m} type="button" onClick={() => setForm(prev => ({ ...prev, payment_method: m }))}
                      className={`py-2.5 rounded-xl text-sm border capitalize ${
                        form.payment_method === m ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'
                      }`}>{m.replace('_',' ')}</button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="text-sm text-gray-600 mb-1 block">Amount Paid (RM)</label>
                <input name="amount_paid" type="number" placeholder="0.00" value={form.amount_paid} onChange={handleChange} className={INPUT} />
              </div>
            </>
          )}
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Payment Note</label>
            <input name="payment_note" placeholder="Note…" value={form.payment_note} onChange={handleChange} className={INPUT} />
          </div>
        </div>

        {/* Save */}
        <button type="button" onClick={handleSave} disabled={saving}
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium text-sm active:opacity-80 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </main>
  )
}
