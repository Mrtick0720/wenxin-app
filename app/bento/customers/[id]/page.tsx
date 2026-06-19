'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { lazy, Suspense, useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import BackButton from '../../../components/BackButton'
import { useNavigation } from '../../../components/NavigationStack'
import { supabase } from '@/lib/supabase/client'
import { buildSubscriptionPlan, getDefaultMenuType, type DeliveryFrequency, type Holiday, type PlannedSubscriptionDay, type SubscriptionDay } from '@/lib/subscriptionSchedule'
import { buildPersistedScheduleView } from '@/lib/subscriptionScheduleView'
import { getCustomerCalendarStatus, getDeliveredDates } from '@/lib/customerCalendarStatus'
import { todayLocalStr } from '@/lib/dateUtils'
import { getCustomerDetailInitialState } from '@/lib/customerDetailState'
import { splitCustomerMeals } from '@/lib/customerOrderHistory'
import MealRow from './MealRow'

const loadEditCustomerPage = () => import('@/app/bento/customers/[id]/edit/page')
const EditCustomerPage = lazy(loadEditCustomerPage)
const loadCustomerHistoryPage = () => import('@/app/bento/customers/[id]/history/page')
const CustomerHistoryPage = lazy(loadCustomerHistoryPage)

type Customer = {
  id: number
  name: string
  phone: string
  subscription_type: string
  delivery_method: string
  delivery_address: string
  area: string
  delivery_frequency: DeliveryFrequency
  menu_preference: string
  taste_notes: string
  start_date: string
  total_portions: number
  used_portions: number
  note: string
  active: boolean
}

type Order = {
  id: number
  date: string
  customer_name?: string
  phone?: string
  address?: string
  area?: string
  menu_type: string
  time_slot?: string
  items?: string
  note?: string
  quantity?: number
  status: string
  amount: number
  paid?: boolean
}

const SUB_COLORS: Record<string, { color: string; bg: string }> = {
  weekly:  { color: '#f97316', bg: '#fff7ed' },
  monthly: { color: '#3b82f6', bg: '#eff6ff' },
  school:  { color: '#8b5cf6', bg: '#faf5ff' },
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MENU_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'signature', label: 'Signature' },
  { value: 'vegetarian', label: 'Vegetarian' },
]
const TIME_SLOTS = [
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
]

function toSubscriptionDay(day: PlannedSubscriptionDay): Omit<SubscriptionDay, 'id'> {
  return {
    customer_id: day.customer_id,
    date: day.date,
    status: day.status,
    meal_number: day.meal_number,
    menu_type: day.menu_type,
    time_slot: day.time_slot,
    note: day.note,
    order_id: day.order_id,
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export default function CustomerDetailPage({
  customerId,
  initialCustomer,
}: {
  customerId?: number | string
  initialCustomer?: Customer
} = {}) {
  const params = useParams<{ id?: string }>()
  const id = customerId !== undefined ? String(customerId) : (params.id ?? '')
  const { push } = useNavigation()
  const initialState = getCustomerDetailInitialState(initialCustomer)
  const [customer, setCustomer] = useState<Customer | null>(initialState.customer)
  const [orders, setOrders] = useState<Order[]>([])
  const [subscriptionDays, setSubscriptionDays] = useState<SubscriptionDay[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(initialState.loading)
  const initialCalendarDate = initialCustomer?.start_date
    ? new Date(initialCustomer.start_date + 'T00:00:00')
    : new Date()
  const [calYear, setCalYear] = useState(initialCalendarDate.getFullYear())
  const [calMonth, setCalMonth] = useState(initialCalendarDate.getMonth())
  const [editing, setEditing] = useState(false)
  const [usedEdit, setUsedEdit] = useState(initialCustomer ? String(initialCustomer.used_portions) : '')
  const [saving, setSaving] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [updatingDate, setUpdatingDate] = useState<string | null>(null)
  const [scheduleError, setScheduleError] = useState('')

  async function loadData() {
    setScheduleError('')

    const custRes = await supabase.from('bento_customers').select('*').eq('id', id).single()
    const cust = custRes.data as Customer | null

    if (!cust) {
      setCustomer(null)
      setLoading(false)
      return
    }

    setCustomer(cust)
    setUsedEdit(String(cust.used_portions))
    if (cust.start_date) {
      const d = new Date(cust.start_date + 'T00:00:00')
      setCalYear(d.getFullYear())
      setCalMonth(d.getMonth())
    }
    setLoading(false)

    const [ordersRes, subDaysRes, holidaysRes] = await Promise.all([
      supabase
        .from('bento_orders')
        .select('id,date,customer_name,phone,address,area,menu_type,time_slot,items,note,quantity,status,amount,paid')
        .ilike('customer_name', cust.name)
        .order('date', { ascending: false }),
      supabase
        .from('bento_subscription_days')
        .select('*')
        .eq('customer_id', cust.id)
        .order('date', { ascending: true }),
      supabase
        .from('bento_holidays')
        .select('date,name')
        .order('date', { ascending: true }),
    ])

    if (subDaysRes.error) {
      setScheduleError('Subscription calendar table is not ready. Run the Supabase migration first.')
    }

    const fetchedOrders = (ordersRes.data || []) as Order[]
    const fetchedDays = (subDaysRes.data || []) as SubscriptionDay[]
    const fetchedHolidays = (holidaysRes.data || []) as Holiday[]
    let nextDays = fetchedDays
    let nextOrders = fetchedOrders

    // Make the calendar and order history available before background schedule
    // reconciliation creates or updates any missing rows.
    setOrders(fetchedOrders)
    setSubscriptionDays(fetchedDays)
    setHolidays(fetchedHolidays)

    if (!subDaysRes.error && cust.start_date && cust.total_portions > 0) {
      try {
        const defaultMenu = getDefaultMenuType(cust.menu_preference)
        const plan = buildSubscriptionPlan({
          startDate: cust.start_date,
          totalMeals: cust.total_portions,
          existingDays: fetchedDays,
          holidays: fetchedHolidays,
          defaults: { menuType: defaultMenu, timeSlot: 'lunch', note: cust.taste_notes || '' },
          customerId: cust.id,
          deliveryFrequency: cust.delivery_frequency,
        })

        const generatedRows = plan.days.filter(day => day.is_generated).map(toSubscriptionDay)
        if (generatedRows.length > 0) {
          const { error: upsertError } = await supabase
            .from('bento_subscription_days')
            .upsert(generatedRows, { onConflict: 'customer_id,date' })
          if (upsertError) {
            setScheduleError(upsertError.message || 'Failed to generate subscription days.')
            return
          }
        }

        const refetchedDays = await supabase
          .from('bento_subscription_days')
          .select('*')
          .eq('customer_id', cust.id)
          .order('date', { ascending: true })
        nextDays = (refetchedDays.data || generatedRows) as SubscriptionDay[]

        for (const day of nextDays) {
          if (day.status === 'skipped') {
            if (day.order_id) {
              const { error: skipError } = await supabase.from('bento_orders').update({ status: 'canceled' }).eq('id', day.order_id)
              if (skipError) {
                setScheduleError(skipError.message || 'Failed to update skipped day order.')
                return
              }
            }
            continue
          }

          const linkedOrder = day.order_id ? nextOrders.find(order => order.id === day.order_id) : undefined
          const sameDateOrder = nextOrders.find(order => order.date === day.date && order.status !== 'canceled')
          const existingOrder = linkedOrder || sameDateOrder

          const orderRow = {
            date: day.date,
            customer_name: cust.name,
            phone: cust.phone,
            address: cust.delivery_address,
            area: cust.area,
            menu_type: day.menu_type,
            time_slot: day.time_slot,
            items: cust.menu_preference || 'Subscription meal',
            note: day.note || cust.taste_notes || cust.note || '',
            amount: 0,
            quantity: 1,
            paid: true,
            status: day.status === 'completed' ? 'completed' : 'pending',
          }

          if (existingOrder) {
            const { error: updateOrdError } = await supabase.from('bento_orders').update(orderRow).eq('id', existingOrder.id)
            if (updateOrdError) {
              setScheduleError(updateOrdError.message || 'Failed to update existing order.')
              return
            }
            if (!day.order_id) {
              const { error: linkError } = await supabase.from('bento_subscription_days').update({ order_id: existingOrder.id }).eq('id', day.id)
              if (linkError) {
                setScheduleError(linkError.message || 'Failed to link order to subscription day.')
                return
              }
            }
          } else {
            const insertedOrder = await supabase.from('bento_orders').insert(orderRow).select('id').single()
            if (insertedOrder.error) {
              setScheduleError(insertedOrder.error.message || 'Failed to create new order.')
              return
            }
            if (insertedOrder.data?.id && day.id) {
              const { error: linkError } = await supabase.from('bento_subscription_days').update({ order_id: insertedOrder.data.id }).eq('id', day.id)
              if (linkError) {
                setScheduleError(linkError.message || 'Failed to link new order to subscription day.')
                return
              }
            }
          }
        }

        const refreshedOrders = await supabase
          .from('bento_orders')
          .select('id,date,customer_name,phone,address,area,menu_type,time_slot,items,note,quantity,status,amount,paid')
          .ilike('customer_name', cust.name)
          .order('date', { ascending: false })
        nextOrders = (refreshedOrders.data || []) as Order[]
        const refreshedDays = await supabase
          .from('bento_subscription_days')
          .select('*')
          .eq('customer_id', cust.id)
          .order('date', { ascending: true })
        nextDays = (refreshedDays.data || nextDays) as SubscriptionDay[]
      } catch {
        setScheduleError('Network error during subscription generation. Please try again.')
        return
      }
    }

    setOrders(nextOrders)
    setSubscriptionDays(nextDays)
    setHolidays(fetchedHolidays)
    setUsedEdit(String(cust.used_portions))
  }

  // The route/customer id is the only external input for this background load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadData() }, [id])

  async function updateUsed() {
    if (!customer) return
    setSaving(true)
    const used = parseInt(usedEdit) || 0
    await supabase.from('bento_customers').update({ used_portions: used }).eq('id', id)
    setCustomer(c => c ? { ...c, used_portions: used } : c)
    setEditing(false)
    setSaving(false)
  }

  async function toggleActive() {
    if (!customer) return
    const newActive = !customer.active
    await supabase.from('bento_customers').update({ active: newActive }).eq('id', id)
    setCustomer(c => c ? { ...c, active: newActive } : c)
  }

  async function toggleScheduleDay(day: PlannedSubscriptionDay) {
    if (!day.id) return
    setUpdatingDate(day.date)
    const nextStatus = day.status === 'skipped' ? 'scheduled' : 'skipped'
    await supabase
      .from('bento_subscription_days')
      .update({ status: nextStatus, meal_number: nextStatus === 'skipped' ? null : day.meal_number })
      .eq('id', day.id)
    if (day.order_id) {
      await supabase
        .from('bento_orders')
        .update({ status: nextStatus === 'skipped' ? 'canceled' : 'pending' })
        .eq('id', day.order_id)
    }
    await loadData()
    setUpdatingDate(null)
  }

  async function updateScheduleDay(day: PlannedSubscriptionDay, updates: Partial<Pick<SubscriptionDay, 'menu_type' | 'time_slot' | 'note'>>) {
    if (!day.id) return
    setUpdatingDate(day.date)
    await supabase.from('bento_subscription_days').update(updates).eq('id', day.id)
    if (day.order_id && day.status !== 'skipped') {
      const orderUpdates: Record<string, string> = {}
      if (updates.menu_type !== undefined) orderUpdates.menu_type = updates.menu_type
      if (updates.time_slot !== undefined) orderUpdates.time_slot = updates.time_slot
      if (updates.note !== undefined) orderUpdates.note = updates.note
      if (Object.keys(orderUpdates).length > 0) {
        await supabase.from('bento_orders').update(orderUpdates).eq('id', day.order_id)
      }
    }
    await loadData()
    setUpdatingDate(null)
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
  const remaining = customer.total_portions - customer.used_portions
  const pct = customer.total_portions > 0 ? Math.round((customer.used_portions / customer.total_portions) * 100) : 0
  // Rendering uses the persisted subscription schedule as the single source of
  // truth. Plan generation above may fill missing DB rows in the background,
  // but the displayed end date and calendar never derive from total_portions.
  const scheduleView = buildPersistedScheduleView(subscriptionDays, holidays)
  const endDate = scheduleView.endDate
  const selectedDay = selectedDate ? scheduleView.daysByDate.get(selectedDate) : null
  const orderStatusById = new Map(orders.map(order => [order.id, order.status]))
  const today = todayLocalStr()
  // Delivered dates are the earliest `used_portions` non-skipped days on/before
  // today — never future days (see getDeliveredDates). Used for both the calendar
  // (green) and the Delivery History bucketing so the two always agree.
  const deliveredDateSet = getDeliveredDates(subscriptionDays, customer.used_portions, today)
  const selectedDayStatus = selectedDay
    ? getCustomerCalendarStatus({
        date: selectedDay.date,
        dayStatus: selectedDay.status,
        orderStatus: selectedDay.order_id ? orderStatusById.get(selectedDay.order_id) : undefined,
        today,
        countedAsUsed: deliveredDateSet.has(selectedDay.date),
      })
    : null
  const scheduledCount = subscriptionDays.filter(day => day.status !== 'skipped').length
  const skippedCount = subscriptionDays.filter(day => day.status === 'skipped').length
  const { scheduled, history } = splitCustomerMeals(orders, subscriptionDays, today, deliveredDateSet)

  // Calendar rendering
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const endDateStr = endDate

  return (
    <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <BackButton href="/bento/customers" />
          <div>
            <span className="font-semibold text-base">{customer.name}</span>
            <span className="ml-2 text-xs font-mono text-gray-400">C{String(customer.id).padStart(3, '0')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => push(
              `/bento/customers/${id}/edit`,
              <Suspense fallback={<div className="h-dvh bg-gray-50" />}>
                <EditCustomerPage customerId={id} />
              </Suspense>,
            )}
            className="text-xs px-3 py-1 rounded-full border font-medium text-orange-500 border-orange-200 bg-orange-50"
          >
            Edit
          </button>
          <button onClick={toggleActive} className={`text-xs px-3 py-1 rounded-full border font-medium ${customer.active ? 'text-green-500 border-green-200 bg-green-50' : 'text-gray-400 border-gray-200 bg-gray-50'}`}>
            {customer.active ? 'Active' : 'Inactive'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Profile card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-lg font-bold text-gray-900">{customer.name}</div>
              {customer.phone && <div className="text-sm text-gray-400 mt-0.5">📞 {customer.phone}</div>}
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: colors.bg, color: colors.color }}>
              {customer.subscription_type.charAt(0).toUpperCase() + customer.subscription_type.slice(1)}
            </span>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">{customer.delivery_method === 'delivery' ? '🚚' : '🏪'}</span>
              <span className="text-gray-600">{customer.delivery_method === 'delivery' ? `Delivery${customer.area ? ` · ${customer.area}` : ''}` : 'Pickup'}</span>
            </div>
            {customer.delivery_address && <div className="text-gray-400 text-xs ml-6">{customer.delivery_address}</div>}
            {customer.menu_preference && <div className="flex items-center gap-2"><span className="text-gray-400">🍱</span><span className="text-gray-600">{customer.menu_preference}</span></div>}
            {customer.taste_notes && (
              <div className="flex items-start gap-2 bg-orange-50 rounded-xl px-3 py-2 mt-2">
                <span>📝</span>
                <span className="text-orange-600 text-sm">{customer.taste_notes}</span>
              </div>
            )}
            {customer.note && <div className="text-xs text-gray-400 mt-1">{customer.note}</div>}
          </div>
        </div>

        {/* Subscription tracker */}
        {customer.total_portions > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700">Subscription</span>
              <button onClick={() => setEditing(e => !e)} className="text-xs text-orange-500">Edit used</button>
            </div>

            <div className="flex items-center gap-4 mb-3">
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: colors.color }}>{remaining}</div>
                <div className="text-xs text-gray-400 mt-0.5">Remaining</div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{customer.used_portions} used</span>
                  <span>{customer.total_portions} total</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 80 ? '#ef4444' : colors.color }} />
                </div>
              </div>
            </div>

            {editing && (
              <div className="flex items-center gap-2 mb-3">
                <input type="number" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400" style={{ fontSize: 16 }}
                  value={usedEdit} onChange={e => setUsedEdit(e.target.value)} />
                <button onClick={updateUsed} disabled={saving} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium">
                  {saving ? '...' : 'Save'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              {customer.start_date && (
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <div className="text-gray-400 mb-0.5">Start</div>
                  <div className="font-medium text-gray-700">{formatDate(customer.start_date)}</div>
                </div>
              )}
              {endDateStr && (
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <div className="text-gray-400 mb-0.5">Est. End</div>
                  <div className={`font-medium ${new Date(endDateStr) < new Date() ? 'text-red-500' : 'text-gray-700'}`}>{formatDate(endDateStr)}</div>
                </div>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-green-50 rounded-xl px-3 py-2 text-green-600">
                {scheduledCount} scheduled
              </div>
              <div className="bg-red-50 rounded-xl px-3 py-2 text-red-500">
                {skippedCount} skipped
              </div>
            </div>
          </div>
        )}

        {/* Calendar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          {scheduleError && (
            <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-500">
              {scheduleError}
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-lg">‹</button>
            <div className="text-center">
              <div className="text-sm font-semibold text-gray-800">{MONTHS[calMonth]} {calYear}</div>
              {endDateStr && <div className="text-[11px] text-gray-400">Ends {formatDate(endDateStr)}</div>}
            </div>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-lg">›</button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const planDay = scheduleView.daysByDate.get(dateStr)
              const isHoliday = !!planDay?.holiday_name
              const isSelected = dateStr === selectedDate
              const isToday = dateStr === today
              const status = planDay
                ? getCustomerCalendarStatus({
                    date: dateStr,
                    dayStatus: planDay.status,
                    orderStatus: planDay.order_id ? orderStatusById.get(planDay.order_id) : undefined,
                    today,
                    countedAsUsed: deliveredDateSet.has(dateStr),
                  })
                : null
              const statusStyle = status === 'delivered'
                ? { background: '#4CAF50', color: '#fff', border: '1px solid #4CAF50' }
                : status === 'pending'
                  ? { background: '#f97316', color: '#fff', border: '1px solid #f97316' }
                  : status === 'paused'
                    ? { background: '#ef4444', color: '#fff', border: '1px solid #ef4444' }
                    : status === 'skipped'
                      ? { background: '#9ca3af', color: '#fff', border: '1px solid #9ca3af' }
                    : status === 'scheduled'
                      ? { background: '#fff', color: '#2563eb', border: '1px solid #3b82f6' }
                      : { background: 'transparent', color: '#374151', border: '1px solid transparent' }
              return (
                <div key={day} className="flex justify-center py-0.5">
                  <button
                    type="button"
                    onClick={() => planDay && setSelectedDate(dateStr)}
                    disabled={!planDay}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm relative
                    ${planDay ? 'font-bold active:scale-95' : ''}
                    ${isSelected ? 'ring-2 ring-gray-800 ring-offset-1' : ''}
                    ${isToday ? 'after:absolute after:-bottom-1 after:h-1 after:w-1 after:rounded-full after:bg-blue-500' : ''}`}
                    style={{
                      ...statusStyle,
                      opacity: updatingDate === dateStr ? 0.45 : 1,
                    }}>
                    {day}
                    {isHoliday && (
                      <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-yellow-400" />
                    )}
                  </button>
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3 text-xs text-gray-400">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ background: '#4CAF50' }}/> Delivered</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full border border-blue-500 bg-white"/> Scheduled</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-orange-500"/> Pending</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"/> Paused</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-gray-400"/> Skipped</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-400"/> Holiday</div>
          </div>

          {selectedDay && (
            <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-800">{formatDate(selectedDay.date)}</div>
                  <div className="text-xs text-gray-400">
                    {selectedDayStatus === 'delivered' ? 'Delivered' :
                      selectedDayStatus === 'pending' ? 'Pending' :
                        selectedDayStatus === 'paused' ? 'Paused' :
                          selectedDayStatus === 'skipped' ? 'Skipped' : 'Scheduled'}
                    {selectedDay.meal_number ? ` · Meal #${selectedDay.meal_number}` : ''}
                {selectedDay.holiday_name ? ` · ${selectedDay.holiday_name}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleScheduleDay(selectedDay)}
                  disabled={updatingDate === selectedDay.date}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${selectedDay.status === 'skipped' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
                >
                  {selectedDay.status === 'skipped' ? 'Restore' : 'Skip'}
                </button>
              </div>

              {selectedDay.holiday_name && selectedDay.status !== 'skipped' && (
                <div className="mb-3 rounded-xl bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
                  Public holiday reminder: review whether delivery is needed.
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-500">
                  Menu
                  <select
                    value={selectedDay.menu_type}
                    onChange={e => updateScheduleDay(selectedDay, { menu_type: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm text-gray-700"
                  >
                    {MENU_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </label>
                <label className="text-xs text-gray-500">
                  Time
                  <select
                    value={selectedDay.time_slot}
                    onChange={e => updateScheduleDay(selectedDay, { time_slot: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm text-gray-700"
                  >
                    {TIME_SLOTS.map(slot => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
                  </select>
                </label>
              </div>
              <label className="mt-2 block text-xs text-gray-500">
                Note
                <input
                  key={`${selectedDay.id}-${selectedDay.note}`}
                  defaultValue={selectedDay.note}
                  onBlur={e => {
                    if (e.target.value !== selectedDay.note) {
                      updateScheduleDay(selectedDay, { note: e.target.value })
                    }
                  }}
                  placeholder="e.g. no spicy, less rice"
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400"
                  style={{ fontSize: 16 }}
                />
              </label>
            </div>
          )}
        </div>

        {/* Scheduled Meals — upcoming pending deliveries */}
        {scheduled.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">Scheduled Meals ({scheduled.length})</div>
            <div className="space-y-2">
              {scheduled.map(o => <MealRow key={o.id} order={o} />)}
            </div>
          </div>
        )}

        {/* Delivery History — past records; recent 20 here, full list grouped by month on its own page */}
        {history.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">Delivery History ({history.length})</div>
            <div className="space-y-2">
              {history.slice(0, 20).map(o => <MealRow key={o.id} order={o} />)}
            </div>
            {history.length > 20 && (
              <button
                type="button"
                onClick={() => push(
                  `/bento/customers/${id}/history`,
                  <Suspense fallback={<div className="h-dvh bg-gray-50" />}>
                    <CustomerHistoryPage customerId={id} />
                  </Suspense>,
                )}
                className="mt-3 w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-orange-500 active:opacity-80"
              >
                View Full History ({history.length})
              </button>
            )}
          </div>
        )}

        <div className="pb-8" />
      </div>
    </div>
  )
}
