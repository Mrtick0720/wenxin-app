'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { todayLocalStr } from '@/lib/dateUtils'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const AREAS = ['Likas', 'Luyang', 'Lintas']
const MENU_TYPES = ['清单', '风味', '素食']

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

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 pb-8">
        {/* 客户姓名 */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">客户姓名 *</label>
          <input
            type="text"
            name="customer_name"
            placeholder="例：李小明"
            value={form.customer_name}
            onChange={handleChange}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
          />
        </div>

        {/* 电话 */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">电话</label>
          <input
            type="tel"
            name="phone"
            placeholder="例：0123456789"
            value={form.phone}
            onChange={handleChange}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
          />
        </div>

        {/* 地区 */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">配送地区</label>
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

        {/* 餐点类型 */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">餐点类型</label>
          <div className="flex gap-2">
            {MENU_TYPES.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setForm({ ...form, menu_type: type })}
                className={`flex-1 py-2 rounded-xl text-sm border ${
                  form.menu_type === type
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* 配送地址 */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">配送地址</label>
          <input
            type="text"
            name="address"
            placeholder="例：Jalan Gaya 12, KK"
            value={form.address}
            onChange={handleChange}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
          />
        </div>

        {/* 餐点内容 */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">餐点内容 *</label>
          <input
            type="text"
            name="items"
            placeholder="例：鸡腿饭 x2, 牛腩饭 x1"
            value={form.items}
            onChange={handleChange}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
          />
        </div>

        {/* 金额 */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">金额 (RM) *</label>
          <input
            type="number"
            name="amount"
            placeholder="例：25.50"
            value={form.amount}
            onChange={handleChange}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
          />
        </div>

        {/* 备注 */}
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
