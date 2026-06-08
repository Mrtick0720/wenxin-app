'use client'

import { useState, useEffect } from 'react'
import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'
import { useStaff } from '../components/StaffProvider'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Task {
  id: number
  title: string
  task_type: string
  priority: string
  status: string
}

const typeLabel: Record<string, string> = {
  purchase: 'Purchase Approval',
  leave: 'Leave Request',
  repair: 'Equipment Repair',
  bento: 'Bento Order',
  other: 'Other',
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  high: { label: 'Urgent', color: 'bg-red-100 text-red-600' },
  medium: { label: 'Normal', color: 'bg-orange-100 text-orange-600' },
  low: { label: 'Low', color: 'bg-gray-100 text-gray-500' },
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-red-500' },
  processing: { label: 'Processing', color: 'text-orange-500' },
  done: { label: 'Done', color: 'text-green-500' },
}

export default function TasksPage() {
  const staff = useStaff()
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    if (!staff) {
      router.push('/login')
      return
    }
    const today = new Date().toISOString().split('T')[0]
    supabase
      .from('tasks')
      .select('*')
      .eq('date', today)
      .order('id', { ascending: true })
      .then(({ data }) => {
        setTasks((data || []) as Task[])
      })
  }, [staff, router])

  const pending = tasks.filter(t => t.status === 'pending').length
  const processing = tasks.filter(t => t.status === 'processing').length
  const done = tasks.filter(t => t.status === 'done').length

  return (
    <PageTransition>
    <main className="bg-gray-50 w-full mx-auto">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b">
        <BackButton href="/" />
        <span className="font-semibold text-base">Tasks</span>
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500 mb-3">Today&apos;s Summary</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{pending}</div>
              <div className="text-xs text-gray-400 mt-0.5">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{processing}</div>
              <div className="text-xs text-gray-400 mt-0.5">Processing</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{done}</div>
              <div className="text-xs text-gray-400 mt-0.5">Done</div>
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">Task List</div>
          <div className="space-y-3">
            {tasks.length === 0 && (
              <div className="text-center text-gray-400 py-8">No tasks today</div>
            )}
            {tasks.map((task) => {
              const priority = priorityConfig[task.priority] || priorityConfig.low
              const status = statusConfig[task.status] || statusConfig.pending
              const type = typeLabel[task.task_type] || 'Other'
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
