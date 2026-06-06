'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback } from 'react'
import BackButton from '../../components/BackButton'
import { supabase } from '@/lib/supabase/client'
import { toLocalDateStr, addDays } from '@/lib/dateUtils'
import { useStaff } from '@/app/components/StaffProvider'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

type WeekMenu = {
  id?: number
  week_start: string
  mon: string
  tue: string
  wed: string
  thu: string
  fri: string
  sat: string
  sun: string
}

function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toLocalDateStr(d)
}

function addWeeks(weekStart: string, n: number): string {
  return addDays(weekStart, n * 7)
}

function formatWeekLabel(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00')
  const end = new Date(weekStart + 'T00:00:00')
  end.setDate(end.getDate() + 6)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[start.getMonth()]} ${start.getDate()} — ${months[end.getMonth()]} ${end.getDate()}`
}

function getDayDate(weekStart: string, dayIndex: number): string {
  const d = new Date(weekStart + 'T00:00:00')
  d.setDate(d.getDate() + dayIndex)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const emptyMenu = (weekStart: string): WeekMenu => ({
  week_start: weekStart,
  mon: '', tue: '', wed: '', thu: '', fri: '', sat: '', sun: '',
})

export default function WeeklyMenuPage() {
  const staff = useStaff()
  const canEdit = staff?.role === 'owner' || staff?.role === 'manager'
  const todayWeekStart = getWeekStart(new Date())
  const [weekStart, setWeekStart] = useState(todayWeekStart)
  const [menu, setMenu] = useState<WeekMenu>(emptyMenu(todayWeekStart))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editDay, setEditDay] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const loadMenu = useCallback(async (ws: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('bento_weekly_menu')
      .select('*')
      .eq('week_start', ws)
      .maybeSingle()
    setMenu(data || emptyMenu(ws))
    setLoading(false)
  }, [])

  useEffect(() => {
    loadMenu(weekStart)
  }, [loadMenu, weekStart])

  function startEdit(key: string) {
    if (!canEdit) return
    setEditDay(key)
    setEditValue(menu[key as keyof WeekMenu] as string || '')
  }

  async function saveDay() {
    if (!editDay) return
    const updated = { ...menu, [editDay]: editValue }
    setMenu(updated)
    setEditDay(null)
    setSaving(true)
    if (menu.id) {
      await supabase.from('bento_weekly_menu').update({ [editDay]: editValue }).eq('id', menu.id)
    } else {
      const { data } = await supabase.from('bento_weekly_menu').insert(updated).select().single()
      if (data) setMenu(data)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const isCurrentWeek = weekStart === todayWeekStart
  const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1

  return (
    <main className="min-h-screen bg-gray-50 w-full mx-auto">
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <BackButton href="/bento" />
          <span className="font-semibold text-base">Weekly Menu</span>
        </div>
        {saving && <span className="text-xs text-gray-400">Saving...</span>}
        {saved && <span className="text-xs text-green-500">✓ Saved</span>}
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm">
          <button
            onClick={() => setWeekStart(addWeeks(weekStart, -1))}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 text-lg"
          >
            ‹
          </button>
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-800">{formatWeekLabel(weekStart)}</div>
            {isCurrentWeek && <div className="text-xs text-orange-500 mt-0.5">This week</div>}
          </div>
          <button
            onClick={() => setWeekStart(addWeeks(weekStart, 1))}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 text-lg"
          >
            ›
          </button>
        </div>

        {loading && <div className="text-center text-gray-400 py-8">Loading...</div>}

        {!loading && (
          <div className="space-y-2">
            {DAY_KEYS.map((key, i) => {
              const isToday = isCurrentWeek && i === todayIndex
              const value = menu[key as keyof WeekMenu] as string

              if (editDay === key) {
                return (
                  <div key={key} className="bg-white rounded-2xl p-4 shadow-sm border border-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-sm font-semibold ${isToday ? 'text-orange-500' : 'text-gray-700'}`}>
                        {DAYS[i]}
                      </span>
                      <span className="text-xs text-gray-400">{getDayDate(weekStart, i)}</span>
                    </div>
                    <textarea
                      autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      placeholder="Example: Chicken rice, Beef brisket rice, Tofu rice"
                      rows={3}
                      className="w-full text-sm text-gray-700 outline-none resize-none bg-gray-50 rounded-xl px-3 py-2 border border-gray-200"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={saveDay}
                        className="flex-1 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditDay(null)}
                        className="flex-1 py-2 bg-gray-100 text-gray-500 rounded-xl text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <button
                  key={key}
                  onClick={() => startEdit(key)}
                  disabled={!canEdit}
                  className="w-full bg-white rounded-2xl p-4 shadow-sm text-left flex items-start gap-3 disabled:cursor-default"
                >
                  <div className="flex-shrink-0 w-10">
                    <div className={`text-sm font-semibold ${isToday ? 'text-orange-500' : 'text-gray-700'}`}>
                      {DAYS[i]}
                    </div>
                    <div className="text-xs text-gray-400">{getDayDate(weekStart, i)}</div>
                    {isToday && <div className="text-xs text-orange-400 mt-0.5">Today</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    {value ? (
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">{value}</div>
                    ) : (
                      <div className="text-sm text-gray-300">Tap to add menu...</div>
                    )}
                  </div>
                  {canEdit && <svg className="flex-shrink-0 w-4 h-4 text-gray-300 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>}
                </button>
              )
            })}
          </div>
        )}

        {!loading && !isCurrentWeek && (
          <button
            onClick={() => setWeekStart(todayWeekStart)}
            className="w-full py-2.5 bg-white border border-orange-200 text-orange-500 rounded-xl text-sm font-medium"
          >
            Back to this week
          </button>
        )}
      </div>
    </main>
  )
}
