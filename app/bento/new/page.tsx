'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewBentoOrder() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    address: '',
    items: '',
    note: '',
    amount: '',
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
      items: form.items,
      note: form.note,
      amount: parseFloat(form.amount),
      paid: false,
      status: 'pending',
    })
    setLoading(false)
    router.push('/bento')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-gray-50 w-full max-w-sm mx-auto">
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b">
        <Link href="/bento" className="text-gray-500 text-xl">←</Link>
        <span className="font-semibold text-base">新增 Bento 订单</span>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        {[
          { label: '客户姓名 *', name: 'customer_name', placeholder: '例：李小明', type: 'text' },
          { label: '电话', name: 'phone', placeholder: '例：0123456789', type: 'tel' },
          { label: '配送地址', name: 'address', placeholder: '例：Jalan Gaya 12, KK', type: 'text' },
          { label: '餐点内容 *', name: 'items', placeholder: '例：鸡腿饭 x2, 牛腩饭 x1', type: 'text' },
          { label: '金额 (RM) *', name: 'amount', placeholder: '例：25.50', type: 'number' },
        ].map((field) => (
          <div key={field.name}>
            <label className="text-sm text-gray-600 mb-1 block">{field.label}</label>
            <input
              type={field.type}
              name={field.name}
              placeholder={field.placeholder}
              value={form[field.name as keyof typeof form]}
              onChange={handleChange}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
            />
          </div>
        ))}

        <div>
          <label className="text-sm text-gray-600 mb-1 block">备注</label>
          <textarea
            name="note"
            placeholder="例：不要辣、少盐"
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
          {loading ? '提交中...' : '确认新增订单'}
        </button>
      </form>
    </main>
  )
}
