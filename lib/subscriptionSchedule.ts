export type SubscriptionServiceDay = {
  date: string
  portionNumber: number | null
  status: 'active' | 'canceled'
}

export function isWeekend(dateStr: string) {
  const day = new Date(dateStr + 'T00:00:00').getDay()
  return day === 0 || day === 6
}

function addOneDay(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function buildSubscriptionSchedule({
  startDate,
  totalPortions,
  canceledDates = [],
}: {
  startDate: string
  totalPortions: number
  canceledDates?: string[]
}) {
  const serviceDays: SubscriptionServiceDay[] = []
  const canceled = new Set(canceledDates)
  let activeCount = 0
  let cursor = startDate
  let endDate: string | null = null

  while (cursor && activeCount < totalPortions) {
    if (!isWeekend(cursor)) {
      if (canceled.has(cursor)) {
        serviceDays.push({ date: cursor, portionNumber: null, status: 'canceled' })
      } else {
        activeCount += 1
        serviceDays.push({ date: cursor, portionNumber: activeCount, status: 'active' })
        endDate = cursor
      }
    }
    cursor = addOneDay(cursor)
  }

  return { serviceDays, endDate }
}
