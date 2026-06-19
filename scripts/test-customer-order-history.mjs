import assert from 'node:assert/strict'
import { filterSubscriptionOrderHistory } from '../lib/customerOrderHistory.ts'

const orders = [
  { id: 10, date: '2026-06-16', status: 'completed' },
  { id: 11, date: '2026-06-17', status: 'pending' },
  { id: 12, date: '2026-06-18', status: 'canceled' },
  { id: 99, date: '2026-06-17', status: 'pending' },
]

const days = [
  { order_id: 10 },
  { order_id: 11 },
  { order_id: 12 },
]

assert.deepEqual(
  filterSubscriptionOrderHistory(orders, days).map(order => order.id),
  [11, 10],
  'history includes linked active/completed orders, excludes canceled and unlinked duplicates',
)

console.log('customer order history tests passed')
