'use client'

import { useState } from 'react'
import BackButton from '@/app/components/BackButton'
import { addKitchenTaskAction } from '@/app/kitchen/dailyTasksActions'

type UrgencyStyle = { label: string; mark: string; sel: string; pillBg: string; pillFg: string }
const URGENCY: Record<number, UrgencyStyle> = {
  0: { label: 'Normal',   mark: '',    sel: '#6b7280', pillBg: '#f3f4f6', pillFg: '#6b7280' },
  1: { label: 'Urgent',   mark: '❗',  sel: '#f59e0b', pillBg: '#fffbeb', pillFg: '#b45309' },
  2: { label: 'Critical', mark: '‼️', sel: '#dc2626', pillBg: '#fef2f2', pillFg: '#dc2626' },
}

export default function NewKitchenTaskPage({ onSaved }: { onSaved?: () => void }) {
  const [title, setTitle] = useState('')
  const [urgency, setUrgency] = useState(0)
  const [recurring, setRecurring] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Please enter a task title'); return }
    setSaving(true)
    setError(null)
    const res = await addKitchenTaskAction(title.trim(), recurring, urgency)
    setSaving(false)
    if (!res.ok) { setError('Failed to add task'); return }
    onSaved?.()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#f9fafb', overflow: 'hidden' }}>
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b" style={{ flexShrink: 0 }}>
        <BackButton href="/kitchen-tasks" />
        <span className="font-semibold text-base">New Kitchen Task</span>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <div>
          <label className="text-sm text-gray-600 mb-1 block">Title *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Task description..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400"
            style={{ fontSize: 16 }}
            autoFocus
          />
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-2 block">Urgency</label>
          <div className="flex gap-2">
            {[0, 1, 2].map(lvl => {
              const us = URGENCY[lvl]
              const active = urgency === lvl
              return (
                <button key={lvl} type="button" onClick={() => setUrgency(lvl)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border flex items-center justify-center gap-1"
                  style={active
                    ? { background: us.sel, color: '#fff', borderColor: us.sel }
                    : { background: us.pillBg, color: us.pillFg, borderColor: 'transparent' }}>
                  {us.mark && <span>{us.mark}</span>}
                  {us.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-2 block">Repeat</label>
          <div className="flex gap-2">
            {[false, true].map(v => (
              <button key={String(v)} type="button" onClick={() => setRecurring(v)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
                style={recurring === v
                  ? { background: '#f97316', color: '#fff', borderColor: '#f97316' }
                  : { background: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}>
                {v ? '🔁 Daily routine' : 'One-off'}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving || !title.trim()}
          className="w-full py-3 rounded-xl text-white text-sm font-semibold"
          style={{ background: saving || !title.trim() ? '#d1d5db' : '#f97316' }}>
          {saving ? 'Saving…' : 'Add Task'}
        </button>
      </form>
    </div>
  )
}
