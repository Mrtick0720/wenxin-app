import assert from 'node:assert/strict'
import { buildPersistedScheduleView } from '../lib/subscriptionScheduleView.ts'

const days = [
  { id: 1, date: '2026-06-16', status: 'completed', meal_number: 1, customer_id: 1, menu_type: 'standard', time_slot: 'lunch', note: '', order_id: 1 },
  { id: 2, date: '2026-07-15', status: 'scheduled', meal_number: 30, customer_id: 1, menu_type: 'standard', time_slot: 'lunch', note: '', order_id: 30 },
]

const view = buildPersistedScheduleView(days, [])

assert.equal(view.endDate, '2026-07-15', 'end date comes from MAX persisted subscription date')
assert.equal(view.daysByDate.has('2026-06-16'), true, 'persisted start date is highlighted')
assert.equal(view.daysByDate.has('2026-07-15'), true, 'persisted end date is highlighted')
assert.equal(view.daysByDate.has('2026-07-16'), false, 'non-persisted dates are not highlighted')

assert.deepEqual(
  buildPersistedScheduleView([], []).endDate,
  null,
  'an empty persisted schedule has no estimated end date',
)

console.log('subscription calendar view tests passed')
