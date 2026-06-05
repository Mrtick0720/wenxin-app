'use client'

import { useState, useEffect, useCallback } from 'react'
import BackButton from '../../components/BackButton'
import { supabase } from '@/lib/supabase'
import { todayLocalStr } from '@/lib/dateUtils'
import DatePicker from '../../components/DatePicker'

type Order = {
  id: number
  customer_name: string
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
  { value: 'standard', label: 'Standard', aliases: ['standard', 'Standard', '清单'] },
  { value: 'signature', label: 'Signature', aliases: ['signature', 'Signature', '风味'] },
  { value: 'vegetarian', label: 'Vegetarian', aliases: ['vegetarian', 'Vegetarian', '素食'] },
]
const TIME_SLOTS = [
  { value: 'lunch', label: 'Lunch', aliases: ['lunch', 'Lunch', '午餐'] },
  { value: 'dinner', label: 'Dinner', aliases: ['dinner', 'Dinner', '晚餐'] },
]

const MENU_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  standard:   { bg: '#fff7ed', text: '#f97316', border: '#fed7aa' },
  signature:  { bg: '#eff6ff', text: '#3b82f6', border: '#bfdbfe' },
  vegetarian: { bg: '#f0fdf4', text: '#22c55e', border: '#bbf7d0' },
  other:      { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb' },
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function getDayMenu(menu: WeekMenu | null, dateStr: string): string {
  if (!menu) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const key = WEEKDAY_KEYS[d.getDay()] as keyof WeekMenu
  return (menu[key] as string) || ''
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]
  return `${weekday}, ${month} ${d.getDate()}`
}

export default function ProductionPage() {
  const today = todayLocalStr()
  const [selectedDate, setSelectedDate] = useState(today)
  const [orders, setOrders] = useState<Order[]>([])
  const [weekMenu, setWeekMenu] = useState<WeekMenu | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async (date: string) => {
    setLoading(true)
    const [ordersRes, menuRes] = await Promise.all([
      supabase.from('bento_orders').select('*').eq('date', date).order('id'),
      supabase.from('bento_weekly_menu').select('*').eq('week_start', getWeekStart(date)).maybeSingle(),
    ])
    setOrders((ordersRes.data || []) as Order[])
    setWeekMenu(menuRes.data as WeekMenu | null)
    setLoading(false)
  }, [])

  useEffect(() => { loadData(selectedDate) }, [loadData, selectedDate])

  // Group by menu_type × time_slot
  const groups = (() => {
    const map: Record<string, { qty: number; items: Order[]; menuLabel: string; slotLabel: string; colorKey: string }> = {}
    for (const o of orders) {
      const mt = MENU_TYPES.find(t => t.aliases.includes(o.menu_type || ''))
      const ts = TIME_SLOTS.find(t => t.aliases.includes(o.time_slot || ''))
      const key = `${mt?.value ?? 'other'}__${ts?.value ?? 'other'}`
      if (!map[key]) map[key] = { qty: 0, items: [], menuLabel: mt?.label ?? (o.menu_type || 'Other'), slotLabel: ts?.label ?? (o.time_slot || ''), colorKey: mt?.value ?? 'other' }
      map[key].qty += (o.quantity ?? 1)
      map[key].items.push(o)
    }
    return Object.values(map).sort((a, b) => b.qty - a.qty)
  })()

  // Special orders: any order with a note
  const specialOrders = orders.filter(o => o.note && o.note.trim())

  const totalPortions = orders.reduce((s, o) => s + (o.quantity ?? 1), 0)
  const dayMenuText = getDayMenu(weekMenu, selectedDate)

  return (
    <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <BackButton href="/bento" />
          <span className="font-semibold text-base">Production Sheet</span>
        </div>
        <span className="text-xs text-gray-400">{formatDate(selectedDate)}</span>
      </div>

      {/* Date picker */}
      <div className="bg-white px-4 pt-3 pb-3 border-b" style={{ flexShrink: 0 }}>
        <DatePicker selectedDate={selectedDate} onDateChange={setSelectedDate} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading && <div className="text-center text-gray-400 py-12">Loading...</div>}

        {!loading && (
          <>
            {/* Summary card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">Total to Prepare</span>
                <span className="text-2xl font-bold text-orange-500">{totalPortions} <span className="text-sm font-normal text-gray-400">portions</span></span>
              </div>
              {dayMenuText ? (
                <div className="bg-orange-50 rounded-xl px-3 py-2 text-sm text-orange-700">
                  <span className="text-xs font-medium text-orange-400 block mb-0.5">Today&apos;s Menu</span>
                  {dayMenuText}
                </div>
              ) : (
                <div className="text-xs text-gray-400">No weekly menu set for this day</div>
              )}
            </div>

            {orders.length === 0 && (
              <div className="text-center text-gray-400 py-12">
                <div className="text-4xl mb-2">🍱</div>
                <div className="text-sm">No orders for this date</div>
              </div>
            )}

            {/* Groups by menu type */}
            {groups.map((group) => {
              const colors = MENU_COLORS[group.colorKey] ?? MENU_COLORS.other
              const ordersDoneCount = group.items.filter(o => o.status === 'completed').length
              return (
                <div key={`${group.menuLabel}-${group.slotLabel}`} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {/* Group header */}
                  <div className="px-4 py-3 flex items-center justify-between" style={{ background: colors.bg, borderLeft: `4px solid ${colors.text}` }}>
                    <div>
                      <span className="font-bold text-base" style={{ color: colors.text }}>{group.menuLabel}</span>
                      {group.slotLabel && <span className="text-xs ml-2" style={{ color: colors.text }}>· {group.slotLabel}</span>}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold" style={{ color: colors.text }}>{group.qty}</div>
                      <div className="text-xs text-gray-400">{ordersDoneCount}/{group.items.length} done</div>
                    </div>
                  </div>

                  {/* Taste notes for this group */}
                  {group.items.filter(o => o.note).length > 0 && (
                    <div className="px-4 py-2 border-b border-gray-50 space-y-1">
                      <div className="text-xs font-medium text-gray-500 mb-1">Special requests:</div>
                      {group.items.filter(o => o.note).map(o => (
                        <div key={o.id} className="text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 text-amber-700">
                          {o.customer_name}: {o.note}
                          {(o.quantity ?? 1) > 1 && <span className="ml-1 text-amber-500 font-medium">×{o.quantity}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Customer list */}
                  <div className="px-4 py-2 space-y-1">
                    {group.items.map(o => (
                      <div key={o.id} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                        <span className="text-sm text-gray-700">{o.customer_name}</span>
                        <div className="flex items-center gap-2">
                          {(o.quantity ?? 1) > 1 && <span className="text-xs text-blue-500 font-medium">×{o.quantity}</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${o.status === 'completed' ? 'bg-green-50 text-green-500' : 'bg-gray-100 text-gray-400'}`}>
                            {o.status === 'completed' ? 'Done' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Special / Custom orders */}
            {specialOrders.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#fef3c7', borderLeft: '4px solid #f59e0b' }}>
                  <span className="font-bold text-base text-amber-600">Special / Custom</span>
                  <span className="text-2xl font-bold text-amber-500">{specialOrders.reduce((s, o) => s + (o.quantity ?? 1), 0)}</span>
                </div>
                <div className="px-4 py-2 space-y-2">
                  {specialOrders.map(o => {
                    const mt = MENU_TYPES.find(t => t.aliases.includes(o.menu_type || ''))
                    return (
                      <div key={o.id} className="py-2 border-b border-gray-50 last:border-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-800">{o.customer_name}</span>
                          <div className="flex items-center gap-1.5">
                            {mt && <span className="text-xs bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full">{mt.label}</span>}
                            {(o.quantity ?? 1) > 1 && <span className="text-xs text-blue-500 font-medium">×{o.quantity}</span>}
                          </div>
                        </div>
                        <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">📝 {o.note}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
