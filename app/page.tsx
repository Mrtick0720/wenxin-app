import { supabase } from '@/lib/supabase'
import { todayLocalStr } from '@/lib/dateUtils'
import Greeting from './components/Greeting'
import Link from 'next/link'
import HomeRefresh from './components/HomeRefresh'
import BottomNav from './components/BottomNav'

async function getStats() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('daily_stats')
    .select('*')
    .eq('date', today)
    .single()
  return data
}

async function getBentoStats() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('bento_orders')
    .select('*')
    .eq('date', today)
  const orders = data || []
  const total = orders.length
  const completed = orders.filter((o: any) => o.status === 'completed').length
  return { total, completed }
}

async function getAnomalyCount() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('incidents')
    .select('id')
    .eq('date', today)
    .neq('status', 'resolved')
  return data?.length ?? 0
}

async function getPendingCount() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('tasks')
    .select('id')
    .eq('date', today)
    .eq('status', 'pending')
  return data?.length ?? 0
}

export default async function Home() {
  const [stats, bentoStats, anomalyCount, pendingCount] = await Promise.all([getStats(), getBentoStats(), getAnomalyCount(), getPendingCount()])

  const revenueTotal = stats?.revenue_total ?? 0
  const revenueDineIn = stats?.revenue_dine_in ?? 0
  const bentoOrders = bentoStats.total
  const bentoCompleted = bentoStats.completed
  const bentoPercent = bentoOrders > 0 ? Math.round((bentoCompleted / bentoOrders) * 100) : 0

  return (
    <HomeRefresh>
    <main className="min-h-screen bg-gray-50 w-full max-w-sm mx-auto relative">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
          <span className="font-semibold text-base">文心管理系统</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">8</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
            <span className="text-sm font-medium">Bruce</span>
            <span className="text-xs text-gray-400">▼</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 pb-28 space-y-4">
        {/* 问候 */}
        <Greeting />

        {/* 今日营业额 */}
        <div className="py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-500">今日营业额</span>
            <span className="text-sm text-orange-500 font-medium">报表 →</span>
          </div>
          <div className="text-5xl font-bold tracking-tight">RM {revenueTotal.toLocaleString()}</div>
          <div className="text-sm text-gray-400 mt-2">
            堂食 + Bento · <span className="text-green-500">+10.8%</span> 较昨日
          </div>
        </div>

        {/* 今日状态三卡 */}
        <div className="grid grid-cols-3 gap-2">
          <Link href="/incidents" className="bg-red-50 rounded-2xl p-3 text-center block">
            <div className="text-sm text-gray-500 mb-1">异常</div>
            <div className="text-2xl font-bold text-red-500">{anomalyCount}</div>
            <div className="text-xs text-gray-400">项</div>
          </Link>
          <Link href="/tasks" className="bg-orange-50 rounded-2xl p-3 text-center block">
            <div className="text-sm text-gray-500 mb-1">待处理</div>
            <div className="text-2xl font-bold text-orange-500">{pendingCount}</div>
            <div className="text-xs text-gray-400">项</div>
          </Link>
          <Link href="/bento" className="bg-green-50 rounded-2xl p-3 text-center block">
            <div className="text-sm text-gray-500 mb-1">Bento</div>
            <div className="text-lg font-bold text-green-500">进行中</div>
          </Link>
        </div>

        {/* 堂食 + Bento */}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/dine-in" className="bg-white rounded-2xl p-4 shadow-sm block">
            <div className="text-sm font-semibold mb-1">堂食</div>
            <div className="text-xs text-green-500 mb-2">正常营业</div>
            <div className="text-lg font-bold">RM {revenueDineIn.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">→</div>
          </Link>
          <Link href="/bento" className="bg-white rounded-2xl p-4 shadow-sm block">
            <div className="text-sm font-semibold mb-1">Bento</div>
            <div className="text-xs text-green-500 mb-2">进行中</div>
            <div className="text-lg font-bold">{bentoOrders} 单</div>
            <div className="text-xs text-orange-500 mt-1">完成 {bentoPercent}% →</div>
          </Link>
        </div>

        {/* 当日事项 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">当日事项</span>
            <span className="text-sm text-orange-500">全部 →</span>
          </div>
          <div className="space-y-2">
            {["今日主推：烤鱼", "今日例汤：冬瓜排骨汤", "15:00 员工卫生培训"].map((item, i) => (
              <div key={i} className="text-sm text-gray-700 py-1 border-b border-gray-50 last:border-0">{item}</div>
            ))}
          </div>
        </div>
      </div>

      {/* 悬浮九宫格按钮 */}
      <button className="fixed bottom-20 right-6 w-12 h-12 bg-orange-500 rounded-full shadow-lg flex items-center justify-center text-white font-bold text-lg z-50">
        :::
      </button>

      <BottomNav pendingCount={pendingCount} />
    </main>
    </HomeRefresh>
  )
}
