'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BackButton from '@/app/components/BackButton'
import { useNavigation } from '@/app/components/NavigationStack'
import { useToast } from '@/app/components/Toast'
import { supabase } from '@/lib/supabase/client'
import { todayLocalStr } from '@/lib/dateUtils'

const TASK_TYPES = [
  { value: 'other', label: 'General' },
  { value: 'purchase', label: 'Purchase Approval' },
  { value: 'repair', label: 'Equipment Repair' },
  { value: 'bento', label: 'Bento' },
  { value: 'leave', label: 'Leave Request' },
]

const PRIORITIES = [
  { value: 'high', label: 'Urgent' },
  { value: 'medium', label: 'Normal' },
  { value: 'low', label: 'Low' },
]

export default function NewTaskPage() {
  const router = useRouter()
  const { pop } = useNavigation()
  const { show, node: toastNode } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    task_type: 'other',
    priority: 'medium',
    date: todayLocalStr(),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { show('Please enter a task title', 'error'); return }
    setLoading(true)

    // Optimistic: show success + navigate back immediately
    show('Task created', 'success')
    pop()

    const { error: err } = await supabase.from('tasks').insert({
      title: form.title.trim(),
      task_type: form.task_type,
      priority: form.priority,
      date: form.date,
      status: 'pending',
    })
    if (err) { show(err.message || 'Failed to create task', 'error') }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#f9fafb', overflow: 'hidden' }}>
      {toastNode}
      <main className="flex-1 overflow-y-auto">
        <div className="bg-white px-4 py-3 flex items-center gap-3 border-b">
          <BackButton href="/tasks" />
          <span className="font-semibold text-base">New Task</span>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Task description..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-2 block">Type</label>
            <div className="flex flex-wrap gap-2">
              {TASK_TYPES.map(t => (
                <button type="button" key={t.value}
                  onClick={() => setForm(f => ({ ...f, task_type: t.value }))}
                  className="px-3 py-1.5 rounded-full text-sm border transition-colors"
                  style={form.task_type === t.value
                    ? { background: '#f97316', color: '#fff', borderColor: '#f97316' }
                    : { background: '#fff', color: '#374151', borderColor: '#e5e7eb' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-2 block">Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button type="button" key={p.value}
                  onClick={() => setForm(f => ({ ...f, priority: p.value }))}
                  className="flex-1 py-2 rounded-xl text-sm border transition-colors"
                  style={form.priority === p.value
                    ? { background: '#f97316', color: '#fff', borderColor: '#f97316' }
                    : { background: '#fff', color: '#374151', borderColor: '#e5e7eb' }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold mt-2"
            style={{ background: loading ? '#d1d5db' : '#f97316' }}>
            {loading ? 'Saving…' : 'Create Task'}
          </button>
        </form>
      </main>
    </div>
  )
}
