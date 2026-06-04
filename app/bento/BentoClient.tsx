'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Order = {
  id: number
  customer_name: string
  phone: string
  address: string
  items: string
  note: string
  amount: number
  paid: boolean
  status: string
}

export default function BentoClient({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState(initialOrders)
  const [loading, setLoading] = useState<number | null>(null)
  const router = useRouter()

  async function toggleStatus(order: Order) {
    const newStatus = order.status === 'completed' ? 'pending' : 'completed'
    setLoading(order.id)
    await supabase
      .from('bento_orders')
      .update({ status: newStatus })
      .eq('id', order.id)
    setOrders(orders.map(o => o.id === order.id ? { ...o, status: newStatus } : o))
    setLoading(null)
    router.refresh()
  }

  async function togglePaid(order: Order) {
    const newPaid = !order.paid
    setLoading(order.id)
    await supabase
      .from('bento_orders')
      .update({ paid: newPaid })
      .eq('id', order.id)
    setOrders(orders.map(o => o.id === order.id ? { ...o, paid: newPaid } : o))
    setLoading(null)
  }

  return (
    <div>
      <div className="text-sm font-semibold text-gray-700 mb-2">订单列表</div>
      <div className="space-y-3">
        {orders.length === 0 && (
          <div className="text-center text-gray-400 py-8">今日暂无订单</div>
        )}
        {orders.map((order) => (
          <div key={order.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-900">{order.customer_name}</span>
              <button
                onClick={() => togglePaid(order)}
                disabled={loading === order.id}
                className={`text-xs px-2 py-1 rounded-full border ${
                  order.paid
                    ? 'bg-green-100 text-green-600 border-green-200'
                    : 'bg-red-50 text-red-500 border-red-200'
                }`}
              >
                {order.paid ? '✓ 已付款' : '未付款'}
              </button>
            </div>
            <div className="text-sm text-gray-600 mb-1">📦 {order.items}</div>
            {order.note && (
              <div className="text-sm text-orange-500 mb-1">📝 {order.note}</div>
            )}
            <div className="text-sm text-gray-400 mb-1">📍 {order.address}</div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-gray-400">📞 {order.phone}</span>
              <span className="font-semibold text-gray-900">RM {order.amount}</span>
            </div>
            <button
              onClick={() => toggleStatus(order)}
              disabled={loading === order.id}
              className={`mt-3 w-full py-2 rounded-xl text-sm font-medium ${
                order.status === 'completed'
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-orange-500 text-white'
              }`}
            >
              {loading === order.id ? '更新中...' : order.status === 'completed' ? '✓ 已完成' : '标记完成'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
