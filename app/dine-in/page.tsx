import Link from 'next/link'
import PageTransition from '../components/PageTransition'

const tables = [
  { id: 1, number: 'T01', status: 'occupied', pax: 4, opened_at: '11:30', amount: 88.50 },
  { id: 2, number: 'T02', status: 'occupied', pax: 2, opened_at: '12:15', amount: 45.00 },
  { id: 3, number: 'T03', status: 'empty', pax: 0, opened_at: '', amount: 0 },
  { id: 4, number: 'T04', status: 'paid', pax: 3, opened_at: '11:00', amount: 72.00 },
  { id: 5, number: 'T05', status: 'empty', pax: 0, opened_at: '', amount: 0 },
  { id: 6, number: 'T06', status: 'occupied', pax: 6, opened_at: '12:00', amount: 156.00 },
  { id: 7, number: 'T07', status: 'empty', pax: 0, opened_at: '', amount: 0 },
  { id: 8, number: 'T08', status: 'paid', pax: 2, opened_at: '11:45', amount: 38.50 },
]

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  occupied: { label: '就餐中', bg: 'bg-orange-100', text: 'text-orange-600' },
  empty: { label: '空桌', bg: 'bg-gray-100', text: 'text-gray-400' },
  paid: { label: '待清台', bg: 'bg-green-100', text: 'text-green-600' },
}

export default function DineInPage() {
  const occupied = tables.filter(t => t.status === 'occupied').length
  const empty = tables.filter(t => t.status === 'empty').length
  const paid = tables.filter(t => t.status === 'paid').length
  const totalRevenue = tables.reduce((sum, t) => sum + t.amount, 0)

  return (
    <PageTransition>
    <main className="min-h-screen bg-gray-50 w-full mx-auto">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b">
        <Link href="/" className="text-gray-500 text-xl">←</Link>
        <span className="font-semibold text-base">堂食详情</span>
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        {/* 概况 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-500">今日堂食营业额</div>
            <div className="text-xs text-green-500 font-medium">● 正常营业</div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-3">RM {totalRevenue.toLocaleString()}</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-xl font-bold text-orange-500">{occupied}</div>
              <div className="text-xs text-gray-400 mt-0.5">就餐中</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-400">{empty}</div>
              <div className="text-xs text-gray-400 mt-0.5">空桌</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-500">{paid}</div>
              <div className="text-xs text-gray-400 mt-0.5">待清台</div>
            </div>
          </div>
        </div>

        {/* 桌台状态 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-700">桌台状态</div>
            <div className="text-xs text-gray-400">共 {tables.length} 桌</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {tables.map((table) => {
              const config = statusConfig[table.status]
              return (
                <div key={table.id} className={`rounded-2xl p-4 ${config.bg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-900">{table.number}</span>
                    <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
                  </div>
                  {table.status !== 'empty' ? (
                    <>
                      <div className="text-sm text-gray-600">{table.pax} 人</div>
                      <div className="text-sm text-gray-400">{table.opened_at} 开台</div>
                      <div className="text-sm font-semibold text-gray-900 mt-1">RM {table.amount}</div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-400">空桌候客</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* POS 提示 */}
        <div className="bg-blue-50 rounded-2xl p-4">
          <div className="text-xs text-blue-500">💡 当前显示模拟数据，接入 POS 系统后将显示真实桌台状态</div>
        </div>
      </div>
    </main>
    </PageTransition>
  )
}
