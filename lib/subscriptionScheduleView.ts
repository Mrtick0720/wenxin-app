import type {
  Holiday,
  PlannedSubscriptionDay,
  SubscriptionDay,
} from './subscriptionSchedule'

export function buildPersistedScheduleView(
  subscriptionDays: SubscriptionDay[],
  holidays: Holiday[],
) {
  const holidayByDate = new Map(holidays.map(holiday => [holiday.date, holiday.name]))
  const sortedDays = [...subscriptionDays].sort((a, b) => a.date.localeCompare(b.date))
  const daysByDate = new Map<string, PlannedSubscriptionDay>(
    sortedDays.map(day => [
      day.date,
      { ...day, holiday_name: holidayByDate.get(day.date) },
    ]),
  )

  return {
    daysByDate,
    endDate: sortedDays.at(-1)?.date ?? null,
  }
}
