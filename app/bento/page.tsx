import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import BentoClient from './BentoClient'

async function getBentoOrders() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('bento_orders')
    .select('*')
    .eq('date', today)
    .order('id', { ascending: true })
  return data || []
}

export default async function BentoPage() {
  const orders = await getBentoOrders()
  const total = orders.length
  const completed = orders.filter((o: any) => o.status === 'completed').length
  const pending = orders.filter((o: any) => o.status === 'pending').length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <main className="min-h-screen bg-gray-50 w-full max-w-sm mx-auto relative">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-500 text-xl">←</Link>
          <span className="font-semibold text-base">Bento 今日进度</span>
        </div>
        <Link href="/bento/new" className="bg-orange-500 text-white text-sm px-3 py-1.5 rounded-full">
          + 新增
        </Link>
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
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 mt-1 text-right">完成 {percent}%</div>
        </div>

        {/* 订单列表（客户端交互） */}
        <BentoClient initialOrders={orders} />
      </div>
    </main>
  )
}
