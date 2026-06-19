import type { SubscriptionStatus } from './subscriptionSchedule'

export type CustomerCalendarStatus = 'delivered' | 'scheduled' | 'pending' | 'paused' | 'skipped'

export function getCustomerCalendarStatus({
  date,
  dayStatus,
  orderStatus,
  today,
  countedAsUsed = false,
}: {
  date: string
  dayStatus: SubscriptionStatus
  orderStatus?: string
  today: string
  countedAsUsed?: boolean
}): CustomerCalendarStatus {
  // Paused / skipped reflect their real status regardless of date.
  if (orderStatus === 'canceled') return 'paused'
  if (dayStatus === 'skipped') return 'skipped'

  // A meal counts as delivered only by actual signal: the manual used count
  // (countedAsUsed) or an explicitly completed day/order.
  const isDelivered = countedAsUsed || dayStatus === 'completed' || orderStatus === 'completed'

  // Future dates are never delivered or pending — they are upcoming/scheduled.
  // This is the guard that stops a high used-count from greening future days.
  if (date > today) return 'scheduled'

  // date <= today
  if (isDelivered) return 'delivered'
  return 'pending'
}

// The set of dates considered delivered by the manual used-portions count:
// the earliest `usedPortions` non-skipped days that fall on or before today.
// Future days are never included, even when the count exceeds elapsed days —
// you cannot have delivered a meal whose date has not arrived yet.
export function getDeliveredDates<TDay extends { date: string; status: string }>(
  subscriptionDays: TDay[],
  usedPortions: number,
  today: string,
): Set<string> {
  const eligible = subscriptionDays
    .filter(day => day.status !== 'skipped' && day.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date))
  return new Set(eligible.slice(0, Math.max(0, usedPortions)).map(day => day.date))
}
