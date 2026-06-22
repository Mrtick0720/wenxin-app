'use server'

// ── Kitchen daily work checklist — server actions ──
// Two kinds of item:
//   • Recurring routine  → a row in kitchen_task_templates, lazily materialized
//     into kitchen_tasks for each day on first read.
//   • One-off task       → a kitchen_tasks row with template_id null, that day only.
// Kitchen, manager and owner can all read, add, tick and remove. Today is the
// Malaysia business day.

import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { todayLocalStr } from '@/lib/dateUtils'

export type KitchenTask = {
  id: number
  date: string
  title: string
  urgency: number // 0 normal · 1 urgent · 2 critical
  template_id: number | null
  done: boolean
  done_by: string | null
  done_at: string | null
  created_by: string | null
}

export type TaskResult<T> = { ok: true; data: T } | { ok: false; error: string }

// View + tick are open to the kitchen; publishing/managing tasks is not.
const VIEW_ROLES = ['owner', 'manager', 'kitchen'] as const
const MANAGE_ROLES = ['owner', 'manager'] as const
const COLS = 'id, date, title, urgency, template_id, done, done_by, done_at, created_by'

function fail(error: unknown): TaskResult<never> {
  const message =
    error instanceof Error ? error.message
    : error != null && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message)
    : String(error)
  console.error('[kitchen task]', message, error)
  return { ok: false, error: message }
}

function sortTasks(tasks: KitchenTask[]): KitchenTask[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1   // done sink to bottom
    if (a.urgency !== b.urgency) return b.urgency - a.urgency // most urgent first
    return a.id - b.id
  })
}

export async function listKitchenTasksAction(): Promise<TaskResult<KitchenTask[]>> {
  try {
    await requireRole(...VIEW_ROLES)
    const supabase = await createServerSupabaseClient()
    const today = todayLocalStr()

    // Active recurring routines + whatever already exists for today.
    const [templatesRes, todayRes] = await Promise.all([
      supabase.from('kitchen_task_templates').select('id, title, urgency, sort_order').eq('active', true).order('sort_order').order('id'),
      supabase.from('kitchen_tasks').select(COLS).eq('date', today),
    ])
    if (templatesRes.error) throw templatesRes.error
    if (todayRes.error) throw todayRes.error

    const templates = templatesRes.data ?? []
    let todayTasks = (todayRes.data ?? []) as KitchenTask[]

    // Materialize any routine missing a today instance (idempotent via the
    // (date, template_id) unique index).
    const present = new Set(todayTasks.map(t => t.template_id).filter((x): x is number => x != null))
    const missing = templates.filter(t => !present.has(t.id as number))
    if (missing.length > 0) {
      const { error: insErr } = await supabase
        .from('kitchen_tasks')
        .upsert(
          missing.map(t => ({ date: today, title: t.title, urgency: t.urgency, template_id: t.id, sort_order: t.sort_order })),
          { onConflict: 'date, template_id', ignoreDuplicates: true },
        )
      if (insErr) throw insErr
      const reread = await supabase.from('kitchen_tasks').select(COLS).eq('date', today)
      if (reread.error) throw reread.error
      todayTasks = (reread.data ?? []) as KitchenTask[]
    }

    return { ok: true, data: sortTasks(todayTasks) }
  } catch (error) {
    return fail(error)
  }
}

export async function addKitchenTaskAction(title: string, recurring: boolean, urgency: number = 0): Promise<TaskResult<KitchenTask>> {
  try {
    const staff = await requireRole(...MANAGE_ROLES)
    const trimmed = title.trim()
    if (!trimmed) throw new Error('Task title is required.')
    const lvl = urgency === 1 || urgency === 2 ? urgency : 0
    const supabase = await createServerSupabaseClient()
    const today = todayLocalStr()

    let templateId: number | null = null
    if (recurring) {
      const { data: tmpl, error } = await supabase
        .from('kitchen_task_templates')
        .insert({ title: trimmed, urgency: lvl, created_by: staff.displayName })
        .select('id')
        .single()
      if (error) throw error
      templateId = tmpl.id as number
    }

    const { data, error } = await supabase
      .from('kitchen_tasks')
      .insert({ date: today, title: trimmed, urgency: lvl, template_id: templateId, created_by: staff.displayName })
      .select(COLS)
      .single()
    if (error) throw error
    return { ok: true, data: data as KitchenTask }
  } catch (error) {
    return fail(error)
  }
}

export async function toggleKitchenTaskAction(id: number, done: boolean): Promise<TaskResult<KitchenTask>> {
  try {
    const staff = await requireRole(...VIEW_ROLES)
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('kitchen_tasks')
      .update({
        done,
        done_by: done ? staff.displayName : null,
        done_at: done ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select(COLS)
      .single()
    if (error) throw error
    return { ok: true, data: data as KitchenTask }
  } catch (error) {
    return fail(error)
  }
}

/**
 * Remove a task. A one-off task is simply deleted. Deleting a recurring
 * instance STOPS the routine entirely (deactivates its template) so it no
 * longer reappears on future days — callers should confirm before doing this.
 */
export async function deleteKitchenTaskAction(id: number): Promise<TaskResult<true>> {
  try {
    await requireRole(...MANAGE_ROLES)
    const supabase = await createServerSupabaseClient()
    const { data: row } = await supabase.from('kitchen_tasks').select('template_id').eq('id', id).maybeSingle()
    if (row?.template_id) {
      await supabase.from('kitchen_task_templates').update({ active: false }).eq('id', row.template_id)
    }
    const { error } = await supabase.from('kitchen_tasks').delete().eq('id', id)
    if (error) throw error
    return { ok: true, data: true }
  } catch (error) {
    return fail(error)
  }
}
