import assert from 'node:assert/strict'
import { groupUnpaidOrdersByCustomerAndDate } from '../app/bento/unpaid/dailyBills'

const groups = groupUnpaidOrdersByCustomerAndDate([
  { id: 1, customer_name: 'Sydney', date: '2026-06-22', amount: 20, paid: false, status: 'completed' },
  { id: 2, customer_name: ' Sydney ', date: '2026-06-22', amount: 30, paid: false, status: 'completed' },
  { id: 3, customer_name: 'Sydney', date: '2026-06-21', amount: 40, paid: false, status: 'completed' },
  { id: 4, customer_name: 'Alex', date: '2026-06-22', amount: 15, paid: false, status: 'completed' },
  { id: 5, customer_name: 'Sydney', date: '2026-06-22', amount: 99, paid: true, status: 'completed' },
  { id: 6, customer_name: 'Sydney', date: '2026-06-22', amount: 99, paid: false, status: 'canceled' },
])

assert.equal(groups.length, 2)

const sydney = groups.find((group) => group.customerName === 'Sydney')
assert.ok(sydney)
assert.equal(sydney.total, 90)
assert.equal(sydney.bills.length, 2)
assert.equal(sydney.bills[0].date, '2026-06-22')
assert.equal(sydney.bills[0].total, 50)
assert.equal(sydney.bills[0].orderCount, 2)
assert.deepEqual(sydney.bills[0].orderIds, [1, 2])
assert.equal(sydney.bills[1].date, '2026-06-21')
assert.deepEqual(sydney.bills[1].orderIds, [3])

const alex = groups.find((group) => group.customerName === 'Alex')
assert.ok(alex)
assert.equal(alex.total, 15)
assert.deepEqual(alex.bills[0].orderIds, [4])

console.log('Bento unpaid daily bill tests passed.')
