'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toLocalDateStr, addDays } from '@/lib/dateUtils'

const DAYS = ['一', '二', '三', '四', '五', '六', '日']
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
  return `${start.getMonth() + 1}月${start.getDate()}日 — ${end.getMonth() + 1}月${end.getDate()}日`
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
  const todayWeekStart = getWeekStart(new Date())
  const [weekStart, setWeekStart] = useState(todayWeekStart)
  const [menu, setMenu] = useState<WeekMenu>(emptyMenu(todayWeekStart))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editDay, setEditDay] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    loadMenu(weekStart)
  }, [weekStart])

  async function loadMenu(ws: string) {
    setLoading(true)
    const { data } = await supabase
      .from('bento_weekly_menu')
      .select('*')
      .eq('week_start', ws)
      .maybeSingle()
    setMenu(data || emptyMenu(ws))
    setLoading(false)
  }

  function startEdit(key: string) {
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
          <Link href="/bento" className="text-gray-500 text-xl">←</Link>
          <span className="font-semibold text-base">周菜单</span>
        </div>
        {saving && <span className="text-xs text-gray-400">保存中...</span>}
        {saved && <span className="text-xs text-green-500">✓ 已保存</span>}
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        {/* 周切换 */}
        <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm">
          <button
            onClick={() => setWeekStart(addWeeks(weekStart, -1))}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 text-lg"
          >
            ‹
          </button>
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-800">{formatWeekLabel(weekStart)}</div>
            {isCurrentWeek && <div className="text-xs text-orange-500 mt-0.5">本周</div>}
          </div>
          <button
            onClick={() => setWeekStart(addWeeks(weekStart, 1))}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 text-lg"
          >
            ›
          </button>
        </div>

        {loading && <div className="text-center text-gray-400 py-8">加载中...</div>}

        {/* 菜单列表 */}
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
                        周{DAYS[i]}
                      </span>
                      <span className="text-xs text-gray-400">{getDayDate(weekStart, i)}</span>
                    </div>
                    <textarea
                      autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      placeholder="例：鸡腿饭、牛腩饭、豆腐饭"
                      rows={3}
                      className="w-full text-sm text-gray-700 outline-none resize-none bg-gray-50 rounded-xl px-3 py-2 border border-gray-200"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={saveDay}
                        className="flex-1 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditDay(null)}
                        className="flex-1 py-2 bg-gray-100 text-gray-500 rounded-xl text-sm"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <button
                  key={key}
                  onClick={() => startEdit(key)}
                  className="w-full bg-white rounded-2xl p-4 shadow-sm text-left flex items-start gap-3"
                >
                  <div className="flex-shrink-0 w-10">
                    <div className={`text-sm font-semibold ${isToday ? 'text-orange-500' : 'text-gray-700'}`}>
                      周{DAYS[i]}
                    </div>
                    <div className="text-xs text-gray-400">{getDayDate(weekStart, i)}</div>
                    {isToday && <div className="text-xs text-orange-400 mt-0.5">今天</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    {value ? (
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">{value}</div>
                    ) : (
                      <div className="text-sm text-gray-300">点击添加菜品...</div>
                    )}
                  </div>
                  <svg className="flex-shrink-0 w-4 h-4 text-gray-300 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
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
            回到本周
          </button>
        )}
      </div>
    </main>
  )
}
