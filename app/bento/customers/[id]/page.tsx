'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { lazy, Suspense, useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import BackButton from '../../../components/BackButton'
import { FullPageSpinner } from '../../../components/Spinner'
import { useNavigation } from '../../../components/NavigationStack'
import { supabase } from '@/lib/supabase/client'
import { buildSubscriptionPlan, getDefaultMenuType, type DeliveryFrequency, type Holiday, type PlannedSubscriptionDay, type SubscriptionDay } from '@/lib/subscriptionSchedule'
import { buildPersistedScheduleView } from '@/lib/subscriptionScheduleView'
import { getCustomerCalendarStatus, getDeliveredDates } from '@/lib/customerCalendarStatus'
import { todayLocalStr } from '@/lib/dateUtils'
import { getCustomerDetailInitialState } from '@/lib/customerDetailState'
import { splitCustomerMeals } from '@/lib/customerOrderHistory'
import { archivePeriodAction, fetchPeriodsAction, type SubscriptionPeriod } from '../periodsActions'
import MealRow from './MealRow'
import { DatePickerField } from '@/app/components/DateTimePickerFields'

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
  package_mode?: string // 'scheduled' (default) | 'balance'
  // Meals pre-deducted at the start of THIS package to settle the previous
  // package's overuse. 0 / undefined for a fresh package with no carry-over.
  opening_offset?: number
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

// Label-left / value-right row used by the Subscription breakdown.
function StatRow({ label, value, bold, valueClass, valueStyle }: {
  label: string; value: string; bold?: boolean; valueClass?: string; valueStyle?: { color?: string }
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`${bold ? 'font-semibold' : 'font-medium'} ${valueClass ?? 'text-gray-700'}`} style={valueStyle}>{value}</span>
    </div>
  )
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
  // Period archive / renew
  const [periods, setPeriods] = useState<SubscriptionPeriod[]>([])
  const [archiving, setArchiving] = useState(false)
  const [archStart, setArchStart] = useState(todayLocalStr())
  const [archTotal, setArchTotal] = useState('')

  useEffect(() => {
    if (!id) return
    fetchPeriodsAction(Number(id)).then(res => { if (res.ok) setPeriods(res.data) })
  }, [id])

  async function doArchive(renew: boolean) {
    if (!id) return
    setSaving(true)
    const res = await archivePeriodAction(Number(id), {
      renew,
      newStartDate: archStart,
      newTotalPortions: renew ? (parseInt(archTotal) || customer?.total_portions || 0) : undefined,
    })
    setSaving(false)
    if (!res.ok) return
    setArchiving(false)
    const pr = await fetchPeriodsAction(Number(id))
    if (pr.ok) setPeriods(pr.data)
    await loadData()
  }
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

    // Balance-mode packages have no projected daily schedule — orders are
    // ad-hoc and just deduct the quota. Skip schedule generation entirely.
    if (cust.package_mode !== 'balance' && !subDaysRes.error && cust.start_date && cust.total_portions > 0) {
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
            // Idempotency guard (root-cause fix for the historical
            // 6-orders-per-day duplication): `nextOrders` is a snapshot taken
            // once at the top of loadData, so two concurrent/repeated
            // reconciliation passes (a double-invoked effect, or fast re-entry)
            // would both see no existing order and each insert one. Re-check the
            // DB live right before inserting so a duplicate can never be created.
            const { data: liveDup } = await supabase
              .from('bento_orders')
              .select('id')
              .eq('date', day.date)
              .ilike('customer_name', cust.name)
              .neq('status', 'canceled')
              .limit(1)

            if (liveDup && liveDup.length > 0) {
              await supabase.from('bento_orders').update(orderRow).eq('id', liveDup[0].id)
              if (day.id) {
                await supabase.from('bento_subscription_days').update({ order_id: liveDup[0].id }).eq('id', day.id)
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

  if (loading) return <FullPageSpinner />

  if (!customer) return (
    <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div className="text-gray-400">Customer not found</div>
    </div>
  )

  // ── Subscription / Balance package math ──
  // purchased        = meals the customer actually paid for (total_portions)
  // openingOffset    = previous package's overuse pre-deducted from this one
  // openingBalance   = usable meals at package start (purchased − offset, ≥0)
  // currentUsed      = meals consumed in THIS package (used_portions)
  // currentRemaining = openingBalance − currentUsed (≥0)
  // currentOverused  = currentUsed − openingBalance (≥0)  ← overuse to carry forward
  // stillOwed        = offset − purchased (≥0)            ← prev overuse new pkg couldn't cover
  const purchased = customer.total_portions
  const openingOffset = customer.opening_offset ?? 0
  const hasCarryOver = openingOffset > 0
  const currentUsed = customer.used_portions
  const openingBalance = Math.max(purchased - openingOffset, 0)
  const stillOwed = Math.max(openingOffset - purchased, 0)
  const currentRemaining = Math.max(openingBalance - currentUsed, 0)
  const currentOverused = Math.max(currentUsed - openingBalance, 0)
  // Overuse that will be deducted from the NEXT package on renewal.
  const carryOveruse = Math.max(openingOffset + currentUsed - purchased, 0)

  // Severity drives banner + colours. owed/overused = red, fully used = amber,
  // otherwise green (normal balance left).
  const subSeverity: 'owed' | 'overused' | 'fully_used' | 'normal' =
    stillOwed > 0 ? 'owed'
    : currentOverused > 0 ? 'overused'
    : currentRemaining === 0 ? 'fully_used'
    : 'normal'
  const SEV = {
    owed:       { num: '#dc2626', bar: '#ef4444', bannerBg: 'bg-red-50',   bannerText: 'text-red-700' },
    overused:   { num: '#dc2626', bar: '#ef4444', bannerBg: 'bg-red-50',   bannerText: 'text-red-700' },
    fully_used: { num: '#d97706', bar: '#f59e0b', bannerBg: 'bg-amber-50', bannerText: 'text-amber-700' },
    normal:     { num: '#16a34a', bar: '#22c55e', bannerBg: 'bg-green-50', bannerText: 'text-green-700' },
  }[subSeverity]
  const subBanner =
    subSeverity === 'owed' ? `New package used up covering past overuse — ${stillOwed} meal${stillOwed === 1 ? '' : 's'} still owed`
    : subSeverity === 'overused' ? `Overused by ${currentOverused} meal${currentOverused === 1 ? '' : 's'} · settle on renewal`
    : subSeverity === 'fully_used' ? 'Fully used — renew to continue'
    : hasCarryOver ? `${openingOffset} meal${openingOffset === 1 ? '' : 's'} deducted from previous overuse`
    : `${currentRemaining} meal${currentRemaining === 1 ? '' : 's'} remaining`
  // Progress: usage against the opening balance (so a renewed package fills
  // against 17, not 20). Overused/owed packages render a full red bar.
  const subDenom = hasCarryOver ? openingBalance : purchased
  const pct = currentOverused > 0 || stillOwed > 0 ? 100
    : subDenom > 0 ? Math.min(Math.round((currentUsed / subDenom) * 100), 100)
    : 100
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

  // Balance mode: no projected schedule — the calendar marks only real order
  // days (green if delivered/today, orange if a future order exists).
  const isBalance = customer.package_mode === 'balance'
  const isPostpaid = customer.package_mode === 'postpaid'
  // Postpaid (corporate/account): no quota — track the unpaid running tab.
  const outstanding = orders
    .filter(o => o.status !== 'canceled' && o.paid === false)
    .reduce((s, o) => s + (o.amount || 0), 0)
  const unpaidCount = orders.filter(o => o.status !== 'canceled' && o.paid === false).length
  // Balance + postpaid both mark the calendar from real order days only.
  const orderDrivenCalendar = isBalance || isPostpaid
  const balanceStatusByDate = new Map<string, 'delivered' | 'pending'>()
  if (orderDrivenCalendar) {
    for (const o of orders) {
      if (o.status === 'canceled') continue
      balanceStatusByDate.set(o.date, o.date <= today ? 'delivered' : 'pending')
    }
  }

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
            <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: customer.active ? '#fff7ed' : '#f3f4f6', color: customer.active ? '#f97316' : '#9ca3af' }}>
              {customer.active ? 'Active' : 'Completed'}
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

            {/* Status banner — one line that says exactly what's going on. */}
            <div className={`rounded-xl px-3 py-2 text-xs font-medium mb-3 ${SEV.bannerBg} ${SEV.bannerText}`}>
              {subSeverity === 'owed' || subSeverity === 'overused' ? '⚠ ' : (subSeverity === 'normal' && hasCarryOver ? 'ℹ️ ' : '')}{subBanner}
            </div>

            {/* Breakdown — keeps purchased / deducted / used / remaining distinct. */}
            <div className="space-y-1.5 mb-3 text-sm">
              {hasCarryOver ? (
                <>
                  <StatRow label="New package" value={`${purchased} meals`} />
                  <StatRow label="− Previous overuse" value={`${openingOffset} meals`} valueClass="text-amber-600" />
                  <StatRow label="= Opening balance" value={`${openingBalance} meals`} bold valueClass="text-gray-800" />
                  <StatRow label="Used" value={`${currentUsed} meals`} />
                  <StatRow label="Remaining" value={`${currentRemaining} meals`} bold valueStyle={{ color: SEV.num }} />
                  {stillOwed > 0 && <StatRow label="Still owed" value={`${stillOwed} meals`} bold valueClass="text-red-600" />}
                </>
              ) : (
                <>
                  <StatRow label="Package quota" value={`${purchased} meals`} />
                  <StatRow label="Actual used" value={`${currentUsed} meals`} />
                  <StatRow label="Remaining" value={`${currentRemaining} meals`} bold valueStyle={{ color: SEV.num }} />
                  {currentOverused > 0 && <StatRow label="Overused" value={`${currentOverused} meals`} bold valueClass="text-red-600" />}
                </>
              )}
            </div>

            {/* Progress — fills against the opening balance, red when overused. */}
            <div className="relative w-full bg-gray-100 rounded-full h-2 mb-3">
              <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: SEV.bar }} />
              {carryOveruse > 0 && (
                <span className="absolute -top-0.5 right-1 text-[10px] font-bold text-white leading-4">+{carryOveruse}</span>
              )}
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

            {isBalance ? (
              <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-600">
                🎫 Balance package — meals deducted per order, no fixed schedule.
              </div>
            ) : (
              <>
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
              </>
            )}

            {/* Period archive / renew */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              {!archiving ? (
                <button type="button"
                  onClick={() => { setArchTotal(String(customer.total_portions)); setArchStart(todayLocalStr()); setArchiving(true) }}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium border active:opacity-80 ${
                    carryOveruse > 0
                      ? 'border-red-200 bg-red-50 text-red-600'
                      : 'border-gray-200 text-gray-600 active:bg-gray-50'
                  }`}>
                  {carryOveruse > 0 ? 'Complete & deduct overused meals' : 'Complete this package…'}
                </button>
              ) : (
                <div className="space-y-2.5">
                  <div className="text-xs text-gray-500">
                    Archive the current package ({customer.used_portions}/{customer.total_portions} used) into history, then renew or close.
                  </div>
                  {carryOveruse > 0 && (
                    <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      ⚠ {carryOveruse} overused meal{carryOveruse === 1 ? '' : 's'} will be deducted from the new package on renewal.
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-gray-400 mb-1 block">New start date</label>
                      <DatePickerField
                        ariaLabel="New subscription start date"
                        value={archStart}
                        onChange={setArchStart}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400 mb-1 block">New total portions</label>
                      <input type="number" min="0" value={archTotal} onChange={e => setArchTotal(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400" style={{ fontSize: 16 }} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={saving} onClick={() => doArchive(true)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white active:opacity-80" style={{ background: '#f97316' }}>
                      {saving ? '…' : 'Archive & renew'}
                    </button>
                    <button type="button" disabled={saving} onClick={() => doArchive(false)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 active:opacity-80">
                      Archive & close
                    </button>
                  </div>
                  <button type="button" onClick={() => setArchiving(false)} className="w-full text-xs text-gray-400 py-1">Cancel</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Postpaid (corporate/account) — outstanding running tab */}
        {isPostpaid && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span>🏢</span>
              <span className="text-sm font-semibold text-gray-700">Postpaid Account</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold" style={{ color: outstanding > 0 ? '#dc2626' : '#16a34a' }}>RM {outstanding.toFixed(2)}</div>
                <div className="text-xs text-gray-400 mt-0.5">Outstanding</div>
              </div>
              <div className="text-xs text-gray-400">{unpaidCount} unpaid order{unpaidCount === 1 ? '' : 's'}</div>
            </div>
            <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-600">
              No quota — billed per order, pays later. New orders default to Unpaid.
            </div>
          </div>
        )}

        {/* Past packages (period history) */}
        {periods.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-2">Past packages ({periods.length})</div>
            <div className="space-y-1.5">
              {periods.map(p => (
                <div key={p.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-xl px-3 py-2">
                  <span className="text-gray-500">#{p.period_no} · {p.start_date ? formatDate(p.start_date) : '—'} → {p.end_date ? formatDate(p.end_date) : '—'}</span>
                  <span className="font-medium text-gray-700">{p.used_portions}/{p.total_portions} meals</span>
                </div>
              ))}
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
              {!orderDrivenCalendar && endDateStr && <div className="text-[11px] text-gray-400">Ends {formatDate(endDateStr)}</div>}
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
              const status = orderDrivenCalendar
                ? (balanceStatusByDate.get(dateStr) ?? null)
                : planDay
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
