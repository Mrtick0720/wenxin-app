import assert from 'node:assert/strict'
import { buildSubscriptionSchedule } from '../lib/subscriptionSchedule.ts'

const base = buildSubscriptionSchedule({
  startDate: '2026-06-05',
  totalPortions: 20,
})

assert.equal(base.serviceDays.length, 20, 'creates one service day for each portion')
assert.equal(base.serviceDays[0].date, '2026-06-05', 'starts on the selected start date when it is a weekday')
assert.equal(base.serviceDays[1].date, '2026-06-08', 'skips Saturday and Sunday after a Friday start')
assert.equal(base.endDate, '2026-07-02', '20 weekday portions from Jun 5 end on Jul 2')

const canceled = buildSubscriptionSchedule({
  startDate: '2026-06-05',
  totalPortions: 20,
  canceledDates: ['2026-06-10'],
})

assert.equal(canceled.serviceDays.find(d => d.date === '2026-06-10')?.status, 'canceled', 'keeps canceled days visible on the calendar')
assert.equal(canceled.serviceDays.filter(d => d.status === 'active').length, 20, 'canceled days do not consume a portion')
assert.equal(canceled.endDate, '2026-07-03', 'canceling a weekday extends the end date by one working day')

console.log('subscription schedule tests passed')
