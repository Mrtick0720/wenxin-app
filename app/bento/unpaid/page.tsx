'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Order = {
  id: number
  customer_name: string
  phone: string
  address: string
  area: string
  menu_type: string
  items: string
  note: string
  amount: number
  paid: boolean
  status: string
  date: string
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export default function UnpaidPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<number | null>(null)

  useEffect(() => {
    loadUnpaid()
  }, [])

  async function loadUnpaid() {
    setLoading(true)
    const { data } = await supabase
      .from('bento_orders')
      .select('*')
      .eq('paid', false)
      .order('date', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  async function markPaid(order: Order) {
    setUpdating(order.id)
    await supabase.from('bento_orders').update({ paid: true }).eq('id', order.id)
    setOrders(prev => prev.filter(o => o.id !== order.id))
    setUpdating(null)
  }

  const total = orders.reduce((sum, o) => sum + o.amount, 0)

  // 按客户分组
  const grouped = orders.reduce<Record<string, Order[]>>((acc, o) => {
    const key = o.customer_name
    if (!acc[key]) acc[key] = []
    acc[key].push(o)
    return acc
  }, {})

  return (
    <main className="min-h-screen bg-gray-50 w-full mx-auto">
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/bento" className="text-gray-500 text-xl">←</Link>
          <span className="font-semibold text-base">未付款订单</span>
        </div>
        {orders.length > 0 && (
          <span className="text-sm text-red-500 font-semibold">RM {total.toFixed(1)}</span>
        )}
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        {loading && <div className="text-center text-gray-400 py-8">加载中...</div>}

        {!loading && orders.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            <div className="text-4xl mb-3">🎉</div>
            <div className="font-medium text-gray-500">所有订单均已付款</div>
          </div>
        )}

        {!loading && Object.entries(grouped).map(([name, customerOrders]) => {
          const customerTotal = customerOrders.reduce((s, o) => s + o.amount, 0)
          return (
            <div key={name} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* 客户头部 */}
              <div className="px-4 py-3 bg-orange-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{name}</span>
                  <span className="text-xs text-gray-400">{customerOrders[0].phone}</span>
                </div>
                <span className="text-sm font-semibold text-orange-600">RM {customerTotal.toFixed(1)}</span>
              </div>

              {/* 订单列表 */}
              <div className="divide-y divide-gray-50">
                {customerOrders.map(order => (
                  <div key={order.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">{formatDate(order.date)}</span>
                      <div className="flex items-center gap-2">
                        {order.menu_type && (
                          <span className="text-xs bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full">{order.menu_type}</span>
                        )}
                        <span className="text-sm font-medium text-gray-900">RM {order.amount}</span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">📦 {order.items}</div>
                    {order.note && <div className="text-xs text-orange-500 mt-0.5">📝 {order.note}</div>}
                  </div>
                ))}
              </div>

              {/* 收款按钮 */}
              <div className="px-4 pb-4 pt-2">
                <button
                  onClick={() => {
                    customerOrders.forEach(o => markPaid(o))
                  }}
                  disabled={customerOrders.some(o => updating === o.id)}
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-green-500 text-white"
                >
                  ✓ 全部收款 RM {customerTotal.toFixed(1)}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
