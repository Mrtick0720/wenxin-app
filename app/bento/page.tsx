import { supabase } from '@/lib/supabase'
import Link from 'next/link'

async function getBentoOrders() {
  const { data } = await supabase
    .from('bento_orders')
    .select('*')
    .eq('date', '2024-05-20')
    .order('id', { ascending: true })
  return data || []
}

export default async function BentoPage() {
  const orders = await getBentoOrders()

  const total = orders.length
  const completed = orders.filter(o => o.status === 'completed').length
  const pending = orders.filter(o => o.status === 'pending').length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <main className="min-h-screen bg-gray-50 w-full max-w-sm mx-auto relative">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b">
        <Link href="/" className="text-gray-500 text-xl">←</Link>
        <span className="font-semibold text-base">Bento 今日进度</span>
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        {/* 今日概况 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500 mb-3">今日概况</div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{total}</div>
              <div className="text-xs text-gray-400 mt-0.5">总订单</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{completed}</div>
              <div className="text-xs text-gray-400 mt-0.5">已完成</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{pending}</div>
              <div className="text-xs text-gray-400 mt-0.5">待处理</div>
            </div>
          </div>
          {/* 进度条 */}
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 mt-1 text-right">完成 {percent}%</div>
        </div>

        {/* 订单列表 */}
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">订单列表</div>
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{order.customer_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      order.status === 'completed'
                        ? 'bg-green-100 text-green-600'
                        : 'bg-orange-100 text-orange-600'
                    }`}>
                      {order.status === 'completed' ? '已完成' : '待处理'}
                    </span>
                  </div>
                  <span className={`text-xs font-medium ${order.paid ? 'text-green-500' : 'text-red-500'}`}>
                    {order.paid ? '已付款' : '未付款'}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mb-1">📦 {order.items}</div>
                {order.note && (
                  <div className="text-sm text-orange-500 mb-1">📝 {order.note}</div>
                )}
                <div className="text-sm text-gray-400 mb-1">📍 {order.address}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-gray-400">📞 {order.phone}</span>
                  <span className="font-semibold text-gray-900">RM {order.amount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
