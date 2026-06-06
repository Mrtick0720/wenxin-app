'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import BackButton from '../../../components/BackButton'
import { supabase } from '@/lib/supabase'

type Customer = {
  id: number
  name: string
  phone: string
  subscription_type: string
  delivery_method: string
  delivery_address: string
  area: string
  menu_preference: string
  taste_notes: string
  start_date: string
  total_portions: number
  used_portions: number
  note: string
  active: boolean
  cancelled_dates: string[]
}

type Order = {
  id: number
  date: string
  menu_type: string
  quantity?: number
  status: string
  amount: number
}

const SUB_COLORS: Record<string, { color: string; bg: string }> = {
  weekly:  { color: '#f97316', bg: '#fff7ed' },
  monthly: { color: '#3b82f6', bg: '#eff6ff' },
  school:  { color: '#8b5cf6', bg: '#faf5ff' },
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00')
  return d.getDay() === 0 || d.getDay() === 6
}

// Compute scheduled workday dates: skip weekends + cancelled days
function computeSchedule(startDate: string, totalPortions: number, cancelledDates: string[]): string[] {
  if (!startDate || totalPortions <= 0) return []
  const cancelled = new Set(cancelledDates)
  const scheduled: string[] = []
  const d = new Date(startDate + 'T00:00:00')
  let safety = 0
  while (scheduled.length < totalPortions && safety < 500) {
    safety++
    const ds = toDateStr(d)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6 && !cancelled.has(ds)) {
      scheduled.push(ds)
    }
    d.setDate(d.getDate() + 1)
  }
  return scheduled
}

// Next workday after endDate (to find the replacement day when cancelling)
function nextWorkday(afterDate: string, cancelledDates: string[]): string {
  const cancelled = new Set(cancelledDates)
  const d = new Date(afterDate + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  let safety = 0
  while (safety < 60) {
    safety++
    const dow = d.getDay()
    const ds = toDateStr(d)
    if (dow !== 0 && dow !== 6 && !cancelled.has(ds)) return ds
    d.setDate(d.getDate() + 1)
  }
  return afterDate
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export default function CustomerDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [toggling, setToggling] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: cust } = await supabase.from('bento_customers').select('*').eq('id', id).single()
    if (cust) {
      const c = cust as Customer
      c.cancelled_dates = Array.isArray(c.cancelled_dates) ? c.cancelled_dates : []
      setCustomer(c)
      if (c.start_date) {
        const d = new Date(c.start_date + 'T00:00:00')
        setCalYear(d.getFullYear())
        setCalMonth(d.getMonth())
      }
      const { data: nameOrders } = await supabase
        .from('bento_orders')
        .select('id,date,menu_type,quantity,status,amount')
        .ilike('customer_name', c.name)
        .order('date', { ascending: false })
      setOrders((nameOrders || []) as Order[])
    }
    setLoading(false)
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  async function toggleCancelDate(dateStr: string) {
    if (!customer || toggling) return
    setToggling(dateStr)
    const cancelled = [...customer.cancelled_dates]
    const idx = cancelled.indexOf(dateStr)
    if (idx >= 0) {
      cancelled.splice(idx, 1) // un-cancel
    } else {
      cancelled.push(dateStr) // cancel
    }
    await supabase.from('bento_customers').update({ cancelled_dates: cancelled }).eq('id', id)
    setCustomer(c => c ? { ...c, cancelled_dates: cancelled } : c)
    setToggling(null)
  }

  async function toggleActive() {
    if (!customer) return
    const newActive = !customer.active
    await supabase.from('bento_customers').update({ active: newActive }).eq('id', id)
    setCustomer(c => c ? { ...c, active: newActive } : c)
  }

  if (loading) return (
    <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  if (!customer) return (
    <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div className="text-gray-400">Customer not found</div>
    </div>
  )

  const colors = SUB_COLORS[customer.subscription_type] ?? SUB_COLORS.monthly
  const cancelledSet = new Set(customer.cancelled_dates)
  const scheduledDates = computeSchedule(customer.start_date, customer.total_portions, customer.cancelled_dates)
  const scheduledSet = new Set(scheduledDates)
  const endDate = scheduledDates.length > 0 ? scheduledDates[scheduledDates.length - 1] : null
  const orderDates = new Set(orders.map(o => o.date))
  const completedDates = new Set(orders.filter(o => o.status === 'completed').map(o => o.date))
  const remaining = scheduledDates.filter(d => !completedDates.has(d)).length
  const used = scheduledDates.filter(d => completedDates.has(d)).length
  const pct = customer.total_portions > 0 ? Math.round((used / customer.total_portions) * 100) : 0

  // Calendar
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <BackButton href="/bento/customers" />
          <div>
            <span className="font-semibold text-base">{customer.name}</span>
            <span className="ml-2 text-xs font-mono text-gray-400">C{String(customer.id).padStart(3,'0')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/bento/customers/${id}/edit`} className="text-xs px-3 py-1 rounded-full border font-medium text-orange-500 border-orange-200 bg-orange-50">Edit</Link>
          <button onClick={toggleActive} className={`text-xs px-3 py-1 rounded-full border font-medium ${customer.active ? 'text-green-500 border-green-200 bg-green-50' : 'text-gray-400 border-gray-200 bg-gray-50'}`}>
            {customer.active ? 'Active' : 'Inactive'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Profile */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-base font-bold text-gray-900">{customer.name}</div>
              {customer.phone && <div className="text-sm text-gray-400 mt-0.5">📞 {customer.phone}</div>}
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: colors.bg, color: colors.color }}>
              {customer.subscription_type.charAt(0).toUpperCase() + customer.subscription_type.slice(1)}
            </span>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <span>{customer.delivery_method === 'delivery' ? '🚚' : '🏪'}</span>
              <span className="text-gray-600">{customer.delivery_method === 'delivery' ? `Delivery${customer.area ? ` · ${customer.area}` : ''}` : 'Pickup'}</span>
            </div>
            {customer.delivery_address && <div className="text-gray-400 text-xs ml-6">{customer.delivery_address}</div>}
            {customer.menu_preference && <div className="flex items-center gap-2"><span>🍱</span><span className="text-gray-600">{customer.menu_preference}</span></div>}
            {customer.taste_notes && (
              <div className="flex items-start gap-2 bg-orange-50 rounded-xl px-3 py-2 mt-1">
                <span>📝</span>
                <span className="text-orange-600 text-sm">{customer.taste_notes}</span>
              </div>
            )}
            {customer.note && <div className="text-xs text-gray-400 mt-1">{customer.note}</div>}
          </div>
        </div>

        {/* Subscription tracker */}
        {customer.total_portions > 0 && customer.start_date && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-3">Subscription Progress</div>
            <div className="flex items-center gap-4 mb-3">
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: colors.color }}>{remaining}</div>
                <div className="text-xs text-gray-400 mt-0.5">Remaining</div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{used} delivered</span>
                  <span>{customer.total_portions} total</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 80 ? '#ef4444' : colors.color }} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-gray-50 rounded-xl px-3 py-2">
                <div className="text-gray-400 mb-0.5">Start</div>
                <div className="font-medium text-gray-700">{formatDate(customer.start_date)}</div>
              </div>
              {endDate && (
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <div className="text-gray-400 mb-0.5">Est. End</div>
                  <div className={`font-medium ${new Date(endDate) < new Date(today) ? 'text-red-500' : 'text-gray-700'}`}>{formatDate(endDate)}</div>
                </div>
              )}
              {customer.cancelled_dates.length > 0 && (
                <div className="bg-red-50 rounded-xl px-3 py-2">
                  <div className="text-red-400 mb-0.5">Skipped</div>
                  <div className="font-medium text-red-500">{customer.cancelled_dates.length} days</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Schedule calendar */}
        {customer.start_date && customer.total_portions > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-semibold text-gray-700">Schedule</div>
              <div className="text-xs text-gray-400">Tap a day to cancel / restore</div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ background: colors.color }}/> Scheduled</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-400"/> Done</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-gray-200 flex items-center justify-center text-[8px]">×</div> Cancelled</div>
            </div>

            {/* Month nav */}
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1) } else setCalMonth(m => m-1) }}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-lg">‹</button>
              <span className="text-sm font-semibold text-gray-800">{MONTHS[calMonth]} {calYear}</span>
              <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1) } else setCalMonth(m => m+1) }}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-lg">›</button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_,i) => <div key={`e${i}`}/>)}
              {Array.from({ length: daysInMonth }).map((_,i) => {
                const day = i + 1
                const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                const isScheduled = scheduledSet.has(ds)
                const isCancelled = cancelledSet.has(ds)
                const isDone = completedDates.has(ds)
                const hasOrder = orderDates.has(ds)
                const isToday = ds === today
                const weekend = isWeekend(ds)
                const isToggling = toggling === ds
                const isClickable = isScheduled || isCancelled

                let bg = 'transparent'
                let textColor = weekend ? '#d1d5db' : '#374151'
                let content: React.ReactNode = day

                if (isDone) { bg = '#22c55e'; textColor = '#fff' }
                else if (hasOrder && !isDone) { bg = '#86efac'; textColor = '#166534' }
                else if (isScheduled) { bg = colors.color; textColor = '#fff' }
                else if (isCancelled) { bg = '#f3f4f6'; textColor = '#9ca3af'; content = <><span className="text-[10px] leading-none">{day}</span><span className="absolute top-0.5 right-0.5 text-[9px] leading-none text-red-400">×</span></> }

                return (
                  <div key={day} className="flex justify-center py-0.5">
                    <button
                      onClick={() => isClickable && !weekend && toggleCancelDate(ds)}
                      disabled={isToggling || weekend || (!isScheduled && !isCancelled)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm relative select-none"
                      style={{
                        background: bg,
                        color: textColor,
                        border: isToday && !isScheduled && !isCancelled ? '1.5px solid #60a5fa' : 'none',
                        opacity: isToggling ? 0.5 : 1,
                        cursor: isClickable ? 'pointer' : 'default',
                      }}>
                      {content}
                    </button>
                  </div>
                )
              })}
            </div>

            {endDate && (
              <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500">
                <span>Schedule ends</span>
                <span className="font-semibold text-gray-700">{formatDate(endDate)}</span>
              </div>
            )}
          </div>
        )}

        {!customer.start_date || customer.total_portions === 0 ? (
          <div className="bg-orange-50 rounded-2xl p-4 text-sm text-orange-500 text-center">
            Set start date and total portions in <Link href={`/bento/customers/${id}/edit`} className="underline font-medium">Edit</Link> to enable scheduling
          </div>
        ) : null}

        {/* Recent orders */}
        {orders.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">Order History ({orders.length})</div>
            <div className="space-y-2">
              {orders.slice(0, 20).map(o => (
                <div key={o.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{o.date}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{o.menu_type}{(o.quantity ?? 1) > 1 ? ` ×${o.quantity}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${o.status === 'completed' ? 'bg-green-50 text-green-500' : 'bg-orange-50 text-orange-500'}`}>
                      {o.status === 'completed' ? 'Done' : 'Pending'}
                    </span>
                    <span className="text-sm font-medium text-gray-700">RM {o.amount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pb-8"/>
      </div>
    </div>
  )
}
