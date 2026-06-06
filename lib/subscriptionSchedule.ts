export type SubscriptionStatus = 'scheduled' | 'skipped' | 'completed'

export type SubscriptionDay = {
  id?: number
  customer_id: number
  date: string
  status: SubscriptionStatus
  meal_number: number | null
  menu_type: string
  time_slot: string
  note: string
  order_id: number | null
}

export type Holiday = {
  date: string
  name: string
}

export type PlannedSubscriptionDay = SubscriptionDay & {
  holiday_name?: string
  is_generated?: boolean
}

type Defaults = {
  menuType: string
  timeSlot: string
  note: string
}

function toLocalDateStr(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addOneDay(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return toLocalDateStr(d)
}

export function isWeekend(dateStr: string) {
  const day = new Date(dateStr + 'T00:00:00').getDay()
  return day === 0 || day === 6
}

export function getDefaultMenuType(menuPreference: string | null | undefined) {
  const value = (menuPreference || '').toLowerCase()
  if (value.includes('vegetarian') || value.includes('vege')) return 'vegetarian'
  if (value.includes('signature')) return 'signature'
  return 'standard'
}

export function buildSubscriptionPlan({
  startDate,
  totalMeals,
  existingDays,
  holidays,
  defaults,
  customerId = 0,
}: {
  startDate: string
  totalMeals: number
  existingDays: SubscriptionDay[]
  holidays: Holiday[]
  defaults: Defaults
  customerId?: number
}) {
  if (!startDate || totalMeals <= 0) {
    return { days: [] as PlannedSubscriptionDay[], endDate: null as string | null }
  }

  const existingByDate = new Map(existingDays.map(day => [day.date, day]))
  const holidayByDate = new Map(holidays.map(holiday => [holiday.date, holiday.name]))
  const days: PlannedSubscriptionDay[] = []
  let cursor = startDate
  let activeMealCount = 0
  let endDate: string | null = null

  while (activeMealCount < totalMeals) {
    if (!isWeekend(cursor)) {
      const existing = existingByDate.get(cursor)
      const status = existing?.status ?? 'scheduled'
      const isActive = status !== 'skipped'

      if (isActive) {
        activeMealCount += 1
        endDate = cursor
      }

      days.push({
        id: existing?.id,
        customer_id: existing?.customer_id ?? customerId,
        date: cursor,
        status,
        meal_number: isActive ? activeMealCount : null,
        menu_type: existing?.menu_type || defaults.menuType,
        time_slot: existing?.time_slot || defaults.timeSlot,
        note: existing?.note ?? defaults.note,
        order_id: existing?.order_id ?? null,
        holiday_name: holidayByDate.get(cursor),
        is_generated: !existing,
      })
    }

    cursor = addOneDay(cursor)
  }

  return { days, endDate }
}
