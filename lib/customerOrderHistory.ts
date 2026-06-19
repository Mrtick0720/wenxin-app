const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Split a customer's subscription-linked orders into two buckets. Delivery state
// is driven by ACTUAL status, never inferred from the date alone:
//   delivered = order completed (Mark Completed) OR within the used-portions count
//               (deliveredDates), and only ever for dates on/before today.
//   Scheduled Meals  = strictly future, not delivered, not skipped/cancelled.
//   Delivery History = past records (delivered / missed-pending / skipped / cancelled)
//                      plus today's record once it is delivered or skipped/cancelled.
// `today` must be a local YYYY-MM-DD string (see todayLocalStr) so the date
// comparisons are plain lexical ISO-date comparisons. `deliveredDates` is the
// date-gated set from getDeliveredDates.
export function splitCustomerMeals<
  TOrder extends { id: number; date: string; status: string },
  TDay extends { order_id: number | null },
>(
  orders: TOrder[],
  subscriptionDays: TDay[],
  today: string,
  deliveredDates: Set<string> = new Set(),
): { scheduled: TOrder[]; history: (TOrder & { delivered: boolean })[] } {
  const linkedOrderIds = new Set(
    subscriptionDays
      .map(day => day.order_id)
      .filter((id): id is number => id !== null),
  )
  const linked = orders.filter(order => linkedOrderIds.has(order.id))

  const isDelivered = (order: TOrder) =>
    order.date <= today && (order.status === 'completed' || deliveredDates.has(order.date))

  // Scheduled = strictly future, not skipped/cancelled, not (somehow) delivered.
  const scheduled = linked
    .filter(order => order.date > today && order.status !== 'completed' && order.status !== 'canceled')
    .sort((a, b) => a.date.localeCompare(b.date)) // soonest first

  // History = every past record, plus today only once it is delivered or skipped/cancelled.
  // Today still-pending stays out of both lists (it shows as orange "pending" on the calendar).
  const history = linked
    .filter(order =>
      order.date < today ||
      (order.date === today && (isDelivered(order) || order.status === 'canceled')),
    )
    .sort((a, b) => b.date.localeCompare(a.date)) // most recent first
    .map(order => ({ ...order, delivered: isDelivered(order) }))

  return { scheduled, history }
}

// Group already-sorted records into month buckets, newest month first.
// Items keep the order they arrive in, so pass a list that is already sorted.
export function groupRecordsByMonth<T extends { date: string }>(
  records: T[],
): { key: string; label: string; items: T[] }[] {
  const months = new Map<string, { key: string; label: string; items: T[] }>()
  for (const record of records) {
    const key = record.date.slice(0, 7) // YYYY-MM
    if (!months.has(key)) {
      const d = new Date(record.date + 'T00:00:00')
      months.set(key, { key, label: `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`, items: [] })
    }
    months.get(key)!.items.push(record)
  }
  return [...months.values()].sort((a, b) => b.key.localeCompare(a.key))
}
