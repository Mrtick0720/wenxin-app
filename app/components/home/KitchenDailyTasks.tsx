'use client'

// ── Kitchen daily work checklist (client) ──
// Today's prep/cleaning items with tick-to-complete. Each task carries an
// urgency level (set at creation) surfaced by colour + a leading mark so the
// kitchen spots critical items at a glance. Recurrence (daily routine vs one-off)
// is also a creation property — a small toggle in the composer, not a list-level
// control. Optimistic updates keep ticking instant.

import { useState, useTransition, useEffect } from 'react'
import {
  addKitchenTaskAction,
  toggleKitchenTaskAction,
  deleteKitchenTaskAction,
  type KitchenTask,
} from '@/app/kitchen/dailyTasksActions'

type UrgencyStyle = { label: string; mark: string; bar: string; text: string; pillBg: string; pillFg: string; sel: string }
const URGENCY: Record<number, UrgencyStyle> = {
  0: { label: 'Normal',   mark: '',    bar: 'transparent', text: '#1f2937', pillBg: '#f3f4f6', pillFg: '#6b7280', sel: '#6b7280' },
  1: { label: 'Urgent',   mark: '❗',  bar: '#f59e0b',     text: '#b45309', pillBg: '#fffbeb', pillFg: '#b45309', sel: '#f59e0b' },
  2: { label: 'Critical', mark: '‼️', bar: '#dc2626',     text: '#dc2626', pillBg: '#fef2f2', pillFg: '#dc2626', sel: '#dc2626' },
}
const u = (lvl: number) => URGENCY[lvl] ?? URGENCY[0]

// canManage: owner/manager surface (publish + delete). Kitchen view is
// read-only — staff can only tick items done, not create or remove them.
export default function KitchenDailyTasks({ initialTasks, canManage = false, showComposer = true, onOptimisticUpdate }: { initialTasks: KitchenTask[]; canManage?: boolean; showComposer?: boolean; onOptimisticUpdate?: () => void }) {
  const [tasks, setTasks] = useState<KitchenTask[]>(initialTasks)
  // Sync when parent polls and passes new initialTasks
  useEffect(() => { setTasks(initialTasks) }, [initialTasks])
  const [draft, setDraft] = useState('')
  const [urgency, setUrgency] = useState(0)
  const [recurring, setRecurring] = useState(false)
  const [adding, setAdding] = useState(false)
  const [, startTransition] = useTransition()

  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (a.urgency !== b.urgency) return b.urgency - a.urgency
    return a.id - b.id
  })
  const doneCount = tasks.filter(t => t.done).length

  function toggle(task: KitchenTask) {
    const next = !task.done
    onOptimisticUpdate?.()
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: next } : t))
    startTransition(async () => {
      const res = await toggleKitchenTaskAction(task.id, next)
      if (res.ok) setTasks(prev => prev.map(t => t.id === task.id ? res.data : t))
      else setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: task.done } : t)) // rollback
    })
  }

  function remove(task: KitchenTask) {
    // Deleting a routine stops it for every future day — confirm first.
    if (task.template_id != null && typeof window !== 'undefined') {
      if (!window.confirm(`"${task.title}" is a daily routine. Stop it for good?`)) return
    }
    const snapshot = tasks
    onOptimisticUpdate?.()
    setTasks(prev => prev.filter(t => t.id !== task.id))
    startTransition(async () => {
      const res = await deleteKitchenTaskAction(task.id)
      if (!res.ok) setTasks(snapshot) // rollback
    })
  }

  async function add() {
    const title = draft.trim()
    if (!title || adding) return
    setAdding(true)
    const res = await addKitchenTaskAction(title, recurring, urgency)
    if (res.ok) {
      setTasks(prev => [...prev, res.data])
      setDraft('')
      setUrgency(0)
      setRecurring(false)
    }
    setAdding(false)
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-800">Today&apos;s Work</span>
        <span className="text-xs font-medium text-gray-400 tabular-nums">{doneCount} / {tasks.length}</span>
      </div>

      {sorted.length === 0 && (
        <div className="text-xs text-gray-400 mb-3">
          {canManage ? 'No tasks yet. Publish what the kitchen needs to do today.' : 'No tasks published for today.'}
        </div>
      )}

      <div className="space-y-1 mb-3">
        {sorted.map(task => {
          const us = u(task.urgency)
          const showUrgency = !task.done && task.urgency > 0
          return (
            <div key={task.id} className="flex items-stretch gap-2.5 rounded-lg overflow-hidden" style={{ background: showUrgency && task.urgency === 2 ? '#fff5f5' : 'transparent' }}>
              {/* Urgency accent bar */}
              <div className="flex-shrink-0 w-1 rounded-full" style={{ background: showUrgency ? us.bar : 'transparent' }} />
              <div className="flex items-center gap-3 flex-1 min-w-0 py-1.5">
                <button
                  type="button"
                  onClick={() => toggle(task)}
                  aria-label={task.done ? 'Mark not done' : 'Mark done'}
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors"
                  style={{ borderColor: task.done ? '#16A34A' : '#d1d5db', background: task.done ? '#16A34A' : 'transparent' }}
                >
                  {task.done && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {showUrgency && <span className="flex-shrink-0 text-sm leading-none">{us.mark}</span>}
                    <span
                      className="text-sm truncate"
                      style={{
                        color: task.done ? '#9ca3af' : showUrgency ? us.text : '#1f2937',
                        fontWeight: showUrgency ? 600 : 400,
                        textDecoration: task.done ? 'line-through' : 'none',
                      }}
                    >
                      {task.title}
                    </span>
                    {task.template_id != null && (
                      <span className="flex-shrink-0 text-[10px] font-medium text-orange-500 bg-orange-50 rounded px-1.5 py-0.5">Daily</span>
                    )}
                  </div>
                  {task.done && task.done_by && (
                    <div className="text-[11px] text-gray-400 truncate">Done by {task.done_by}</div>
                  )}
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => remove(task)}
                    aria-label="Delete task"
                    className="flex-shrink-0 text-gray-300 active:text-red-400 px-1"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Composer — owner/manager only. Attributes set at creation: urgency + repeat-daily. */}
      {canManage && showComposer && (
      <>
      <div className="flex items-center gap-1.5 mb-2">
        {[0, 1, 2].map(lvl => {
          const us = u(lvl)
          const active = urgency === lvl
          return (
            <button
              key={lvl}
              type="button"
              onClick={() => setUrgency(lvl)}
              className="flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1"
              style={{
                background: active ? us.sel : us.pillBg,
                color: active ? '#fff' : us.pillFg,
              }}
            >
              {us.mark && <span>{us.mark}</span>}
              {us.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setRecurring(r => !r)}
          aria-pressed={recurring}
          className="flex-shrink-0 rounded-lg py-1.5 px-2.5 text-xs font-medium transition-colors flex items-center gap-1"
          style={{ background: recurring ? '#f97316' : '#f3f4f6', color: recurring ? '#fff' : '#6b7280' }}
          title="Repeat every day"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Daily
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          placeholder={recurring ? 'Add a daily routine…' : 'Add a task for today…'}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-orange-400"
          style={{ fontSize: 16 }}
        />
        <button
          type="button"
          onClick={add}
          disabled={adding || !draft.trim()}
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white active:opacity-80"
          style={{ background: adding || !draft.trim() ? '#d1d5db' : '#f97316' }}
          aria-label="Add task"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
      </>
      )}
    </div>
  )
}
