'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback } from 'react'
import BackButton from '../../components/BackButton'
import { supabase } from '@/lib/supabase/client'
import { todayLocalStr } from '@/lib/dateUtils'
import { useStaff } from '@/app/components/StaffProvider'

type Order = {
  id: number
  menu_type: string
  time_slot?: string
  items: string
  note: string
  quantity?: number
  status: string
  date: string
}

type WeekMenu = {
  week_start: string
  mon: string; tue: string; wed: string; thu: string; fri: string; sat: string; sun: string
}

const MENU_TYPES = [
  { value: 'standard',   label: 'Standard',   aliases: ['standard', 'Standard', '清单'],   color: '#f97316', bg: '#fff7ed', border: '#fdba74' },
  { value: 'signature',  label: 'Signature',  aliases: ['signature', 'Signature', '风味'],  color: '#3b82f6', bg: '#eff6ff', border: '#93c5fd' },
  { value: 'vegetarian', label: 'Vegetarian', aliases: ['vegetarian', 'Vegetarian', '素食'], color: '#22c55e', bg: '#f0fdf4', border: '#86efac' },
]
const TIME_SLOTS = [
  { value: 'lunch',  label: 'LUNCH',  aliases: ['lunch', 'Lunch', '午餐'],   time: 'Prep time: 10:30-11:30', icon: '☀️' },
  { value: 'dinner', label: 'DINNER', aliases: ['dinner', 'Dinner', '晚餐'], time: 'Prep time: 16:00-17:00', icon: '🌙' },
]

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().split('T')[0]
}

function getDayMenu(menu: WeekMenu | null, dateStr: string): string {
  if (!menu) return ''
  const key = WEEKDAY_KEYS[new Date(dateStr + 'T00:00:00').getDay()] as keyof WeekMenu
  return (menu[key] as string) || ''
}

function formatDateFull(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const weekday = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()]
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]
  return `${weekday}, ${month} ${d.getDate()}`
}

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function ProductionPage() {
  const staff = useStaff()
  const today = todayLocalStr()
  const [selectedDate, setSelectedDate] = useState(today)
  const [orders, setOrders] = useState<Order[]>([])
  const [weekMenu, setWeekMenu] = useState<WeekMenu | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDatePicker, setShowDatePicker] = useState(false)

  const loadData = useCallback(async (date: string) => {
    setLoading(true)
    const source = staff?.role === 'kitchen' ? 'bento_kitchen_orders' : 'bento_orders'
    const [ordersRes, menuRes] = await Promise.all([
      supabase.from(source).select('*').eq('date', date).neq('status', 'canceled').order('id'),
      supabase.from('bento_weekly_menu').select('*').eq('week_start', getWeekStart(date)).maybeSingle(),
    ])
    setOrders((ordersRes.data || []) as Order[])
    setWeekMenu(menuRes.data as WeekMenu | null)
    setLoading(false)
  }, [staff?.role])

  useEffect(() => { loadData(selectedDate) }, [loadData, selectedDate])

  const totalPortions = orders.reduce((s, o) => s + (o.quantity ?? 1), 0)
  const dayMenuText = getDayMenu(weekMenu, selectedDate)

  type MenuGroup = { mt: typeof MENU_TYPES[0]; qty: number; notes: string[] }
  type TimeGroup = { ts: typeof TIME_SLOTS[0]; menuGroups: MenuGroup[]; slotTotal: number }

  // Group by time_slot → menu_type
  const timeGroups: TimeGroup[] = TIME_SLOTS.flatMap(ts => {
    const slotOrders = orders.filter(o => ts.aliases.includes(o.time_slot || ''))
    if (slotOrders.length === 0) return []
    const menuGroups: MenuGroup[] = MENU_TYPES.map(mt => {
      const matching = slotOrders.filter(o => mt.aliases.includes(o.menu_type || ''))
      const qty = matching.reduce((s, o) => s + (o.quantity ?? 1), 0)
      const notes = matching.filter(o => o.note?.trim()).map(o => o.note.trim())
      return { mt, qty, notes }
    }).filter(g => g.qty > 0)
    const slotTotal = slotOrders.reduce((s, o) => s + (o.quantity ?? 1), 0)
    return [{ ts, menuGroups, slotTotal }]
  })

  // Orders without time slot
  const noSlotOrders = orders.filter(o => !TIME_SLOTS.some(ts => ts.aliases.includes(o.time_slot || '')))
  const noSlotGroups = noSlotOrders.length > 0
    ? MENU_TYPES.map(mt => {
        const matching = noSlotOrders.filter(o => mt.aliases.includes(o.menu_type || ''))
        const qty = matching.reduce((s, o) => s + (o.quantity ?? 1), 0)
        const notes = matching.filter(o => o.note?.trim()).map(o => o.note.trim())
        return { mt, qty, notes }
      }).filter(g => g.qty > 0)
    : []

  // All special notes (unique)
  const allNotes = orders.filter(o => o.note?.trim())

  // Date picker calendar
  const now = new Date(selectedDate + 'T00:00:00')
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDay = new Date(calYear, calMonth, 1).getDay()

  return (
    <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1a1a2e' }}>
      {/* Header */}
      <div style={{ background: '#16213e', flexShrink: 0, borderBottom: '1px solid #0f3460' }} className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton href="/bento" />
          <span className="font-bold text-base text-white tracking-wider">PRODUCTION SHEET</span>
        </div>
        <button onClick={() => setShowDatePicker(s => !s)} className="text-sm font-medium px-3 py-1.5 rounded-xl" style={{ background: '#0f3460', color: '#e2e8f0' }}>
          {formatDateFull(selectedDate)}
        </button>
      </div>

      {/* Date picker dropdown */}
      {showDatePicker && (
        <div style={{ background: '#16213e', borderBottom: '1px solid #0f3460', flexShrink: 0 }} className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1) } else setCalMonth(m=>m-1) }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-lg" style={{ background: '#0f3460' }}>‹</button>
            <span className="text-white font-semibold text-sm">{MONTHS_SHORT[calMonth]} {calYear}</span>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1) } else setCalMonth(m=>m+1) }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-lg" style={{ background: '#0f3460' }}>›</button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => <div key={d} className="text-center text-xs py-1" style={{ color: '#64748b' }}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_,i) => <div key={`e${i}`}/>)}
            {Array.from({ length: daysInMonth }).map((_,i) => {
              const day = i+1
              const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const isSel = dateStr === selectedDate
              const isToday = dateStr === today
              return (
                <div key={day} className="flex justify-center py-0.5">
                  <button onClick={() => { setSelectedDate(dateStr); setShowDatePicker(false) }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                    style={{ background: isSel ? '#f97316' : 'transparent', color: isSel ? '#fff' : isToday ? '#f97316' : '#cbd5e1', border: isToday && !isSel ? '1px solid #f97316' : 'none' }}>
                    {day}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Summary bar */}
      <div style={{ background: '#0f3460', flexShrink: 0 }} className="px-4 py-3 flex items-center justify-between">
        <div>
          <span className="text-2xl font-black text-white">{totalPortions}</span>
          <span className="text-sm ml-2" style={{ color: '#94a3b8' }}>portions total</span>
        </div>
        {dayMenuText && (
          <div className="text-right max-w-[60%]">
            <div className="text-xs font-medium mb-0.5" style={{ color: '#f97316' }}>Today&apos;s Menu</div>
            <div className="text-xs" style={{ color: '#cbd5e1' }}>{dayMenuText}</div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-sm" style={{ color: '#64748b' }}>Loading...</div>
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-5xl mb-3">🍱</div>
            <div className="text-sm" style={{ color: '#64748b' }}>No orders for this date</div>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <>
            {/* Time slot groups */}
            {timeGroups.map(({ ts, menuGroups, slotTotal }) => (
              <div key={ts.value}>
                {/* Time slot header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{ts.icon}</span>
                    <span className="text-lg font-black tracking-widest" style={{ color: '#f1f5f9' }}>{ts.label}</span>
                  </div>
                  <div className="flex-1 h-px" style={{ background: '#1e3a5f' }}/>
                  <span className="text-xl font-black" style={{ color: '#f97316' }}>{slotTotal}</span>
                </div>
                <div className="text-xs mb-3 ml-8" style={{ color: '#475569' }}>{ts.time}</div>

                {/* Menu type cards */}
                <div className="space-y-3 mb-2">
                  {menuGroups.map(({ mt, qty, notes }) => (
                    <div key={mt.value} className="rounded-2xl overflow-hidden" style={{ background: '#16213e', border: `1px solid ${mt.border}20` }}>
                      <div className="px-4 py-3 flex items-center justify-between" style={{ borderLeft: `5px solid ${mt.color}` }}>
                        <span className="text-base font-bold" style={{ color: mt.color }}>{mt.label}</span>
                        <span className="text-3xl font-black" style={{ color: '#f1f5f9' }}>{qty}</span>
                      </div>
                      {notes.length > 0 && (
                        <div className="px-4 pb-3 space-y-1.5">
                          {notes.map((note, i) => (
                            <div key={i} className="text-sm rounded-xl px-3 py-2 flex items-start gap-2" style={{ background: '#1a2744', color: '#fbbf24' }}>
                              <span className="flex-shrink-0">⚠️</span>
                              <span>{note}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* No time slot orders */}
            {noSlotGroups.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-lg font-black tracking-widest" style={{ color: '#f1f5f9' }}>OTHER</span>
                  <div className="flex-1 h-px" style={{ background: '#1e3a5f' }}/>
                </div>
                <div className="space-y-3">
                  {noSlotGroups.map(({ mt, qty, notes }) => (
                    <div key={mt.value} className="rounded-2xl overflow-hidden" style={{ background: '#16213e', border: `1px solid ${mt.border}20` }}>
                      <div className="px-4 py-3 flex items-center justify-between" style={{ borderLeft: `5px solid ${mt.color}` }}>
                        <span className="text-base font-bold" style={{ color: mt.color }}>{mt.label}</span>
                        <span className="text-3xl font-black" style={{ color: '#f1f5f9' }}>{qty}</span>
                      </div>
                      {notes.length > 0 && (
                        <div className="px-4 pb-3 space-y-1.5">
                          {notes.map((note, i) => (
                            <div key={i} className="text-sm rounded-xl px-3 py-2 flex items-start gap-2" style={{ background: '#1a2744', color: '#fbbf24' }}>
                              <span>⚠️</span><span>{note}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All special notes summary */}
            {allNotes.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: '#16213e', border: '1px solid #78350f40' }}>
                <div className="px-4 py-3" style={{ background: '#78350f40', borderLeft: '5px solid #f59e0b' }}>
                  <span className="text-base font-bold" style={{ color: '#fbbf24' }}>SPECIAL REQUESTS</span>
                  <span className="ml-2 text-sm" style={{ color: '#92400e' }}>{allNotes.length} items</span>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {allNotes.map(o => {
                    const mt = MENU_TYPES.find(t => t.aliases.includes(o.menu_type || ''))
                    const ts = TIME_SLOTS.find(t => t.aliases.includes(o.time_slot || ''))
                    return (
                      <div key={o.id} className="rounded-xl px-3 py-2.5" style={{ background: '#1a2744' }}>
                        <div className="flex items-center gap-2 mb-1">
                          {mt && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: mt.color + '20', color: mt.color }}>{mt.label}</span>}
                          {ts && <span className="text-xs" style={{ color: '#64748b' }}>{ts.icon} {ts.label}</span>}
                          {(o.quantity ?? 1) > 1 && <span className="text-xs font-bold" style={{ color: '#60a5fa' }}>×{o.quantity}</span>}
                        </div>
                        <div className="text-sm" style={{ color: '#fbbf24' }}>⚠️ {o.note}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
        <div className="h-6"/>
      </div>
    </div>
  )
}
