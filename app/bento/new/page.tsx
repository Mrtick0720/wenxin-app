'use client'

import { useState } from 'react'
import BackButton from '../../components/BackButton'
import { supabase } from '@/lib/supabase'
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
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customer_name || !form.items || !form.amount) return
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('bento_orders').insert({
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
    })
    setLoading(false)
    router.push('/bento')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-gray-50 w-full mx-auto">
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b">
        <BackButton href="/bento" />
        <span className="font-semibold text-base">New Bento Order</span>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 pb-8">
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Amount (RM) *</label>
            <input
              type="number"
              name="amount"
              placeholder="25.50"
              value={form.amount}
              onChange={handleChange}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Portions *</label>
            <input
              type="number"
              name="quantity"
              placeholder="1"
              min="1"
              value={form.quantity}
              onChange={handleChange}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
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
      </form>
    </main>
  )
}
