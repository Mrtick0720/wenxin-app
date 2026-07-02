import assert from 'node:assert/strict'
import { getCurrentPackageUsage } from '../lib/customerPackageUsage.ts'

const orders = [
  { customer_name: 'Xhing Chee', date: '2026-06-22', quantity: 20, status: 'completed' },
  { customer_name: 'Xhing Chee', date: '2026-07-02', quantity: 3, status: 'pending' },
  { customer_name: 'Xhing Chee', date: '2026-07-03', quantity: 2, status: 'pending' },
  { customer_name: 'Xhing Chee', date: '2026-07-02', quantity: 9, status: 'canceled' },
  { customer_name: 'Karen', date: '2026-07-02', quantity: 7, status: 'completed' },
]

assert.equal(
  getCurrentPackageUsage(orders, 'Xhing Chee', '2026-07-02', '2026-07-02'),
  3,
  'counts only delivered portions in the current package period',
)

assert.equal(
  getCurrentPackageUsage(orders, ' xhing chee ', '2026-07-02', '2026-07-03'),
  5,
  'matches customer names consistently and includes orders through today',
)

console.log('customer package usage tests passed')
