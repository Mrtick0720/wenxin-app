import { supabase } from '@/lib/supabase'
import { todayLocalStr } from '@/lib/dateUtils'
import Link from 'next/link'
import PageTransition from '../components/PageTransition'

async function getTasks() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('date', today)
    .order('id', { ascending: true })
  return data || []
}

const typeLabel: Record<string, string> = {
  purchase: '🛒 采购审批',
  leave: '📅 假期申请',
  repair: '🔧 设备报修',
  bento: '📦 Bento 订单',
  other: '📋 其他',
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  high: { label: '紧急', color: 'bg-red-100 text-red-600' },
  medium: { label: '一般', color: 'bg-orange-100 text-orange-600' },
  low: { label: '低', color: 'bg-gray-100 text-gray-500' },
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: '待处理', color: 'text-red-500' },
  processing: { label: '处理中', color: 'text-orange-500' },
  done: { label: '已完成', color: 'text-green-500' },
}

export default async function TasksPage() {
  const tasks = await getTasks()
  const pending = tasks.filter(t => t.status === 'pending').length
  const processing = tasks.filter(t => t.status === 'processing').length
  const done = tasks.filter(t => t.status === 'done').length

  return (
    <PageTransition>
    <main className="min-h-screen bg-gray-50 w-full max-w-sm mx-auto">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b">
        <Link href="/" className="text-gray-500 text-xl">←</Link>
        <span className="font-semibold text-base">待处理事项</span>
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        {/* 概况 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500 mb-3">今日概况</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{pending}</div>
              <div className="text-xs text-gray-400 mt-0.5">待处理</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{processing}</div>
              <div className="text-xs text-gray-400 mt-0.5">处理中</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{done}</div>
              <div className="text-xs text-gray-400 mt-0.5">已完成</div>
            </div>
          </div>
        </div>

        {/* 事项列表 */}
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">事项列表</div>
          <div className="space-y-3">
            {tasks.length === 0 && (
              <div className="text-center text-gray-400 py-8">今日暂无待处理事项 🎉</div>
            )}
            {tasks.map((task) => {
              const priority = priorityConfig[task.priority] || priorityConfig.low
              const status = statusConfig[task.status] || statusConfig.pending
              const type = typeLabel[task.task_type] || '📋 其他'
              return (
                <div key={task.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">{type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${priority.color}`}>
                      {priority.label}
                    </span>
                  </div>
                  <div className="font-semibold text-gray-900 mb-2">{task.title}</div>
                  <div className={`text-xs font-medium ${status.color}`}>{status.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </main>
    </PageTransition>
  )
}
