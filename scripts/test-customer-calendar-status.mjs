import assert from 'node:assert/strict'
import { getCustomerCalendarStatus } from '../lib/customerCalendarStatus.ts'

assert.equal(
  getCustomerCalendarStatus({ date: '2026-06-18', dayStatus: 'completed', orderStatus: 'completed', today: '2026-06-20' }),
  'delivered',
)

assert.equal(
  getCustomerCalendarStatus({
    date: '2026-06-18',
    dayStatus: 'scheduled',
    orderStatus: 'pending',
    today: '2026-06-20',
    countedAsUsed: true,
  }),
  'delivered',
  'a scheduled/pending row already included in used_portions renders as delivered',
)

assert.equal(
  getCustomerCalendarStatus({ date: '2026-06-25', dayStatus: 'scheduled', orderStatus: 'pending', today: '2026-06-20' }),
  'scheduled',
  'future pending orders remain visually scheduled',
)

assert.equal(
  getCustomerCalendarStatus({ date: '2026-06-20', dayStatus: 'scheduled', orderStatus: 'pending', today: '2026-06-20' }),
  'pending',
)

assert.equal(
  getCustomerCalendarStatus({ date: '2026-06-19', dayStatus: 'scheduled', orderStatus: 'pending', today: '2026-06-20' }),
  'pending',
)

assert.equal(
  getCustomerCalendarStatus({ date: '2026-06-25', dayStatus: 'scheduled', orderStatus: 'canceled', today: '2026-06-20' }),
  'paused',
)

assert.equal(
  getCustomerCalendarStatus({ date: '2026-06-25', dayStatus: 'skipped', today: '2026-06-20' }),
  'skipped',
)

console.log('customer calendar status tests passed')
