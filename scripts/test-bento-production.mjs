import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  aggregateProductionCards,
  buildStructuredMenu,
  getOrderProductionLines,
  updateProductionLineCompletion,
} from '../lib/bentoProduction.ts'
import { applyProductionOrderUpdate } from '../lib/bentoProductionUpdate.ts'

const light = { key: 'variant:1', label: 'Light', compartment_a: 'Chicken', compartment_b: 'Beans', compartment_c: 'Rice', qty: 1 }
const flavorful = { key: 'variant:2', label: 'Flavorful', compartment_a: 'Pork', compartment_b: 'Egg', compartment_c: 'Rice', qty: 2 }

const structured = buildStructuredMenu({
  variants: [{ id: 1, qty: 1 }, { id: 2, qty: 2 }],
  combos: [],
  productionLines: [light, flavorful],
  completedLineKeys: [],
})

const orderA = { id: 10, customer_name: 'Karen', quantity: 3, status: 'pending', bento_items: structured }
const orderB = {
  id: 11,
  customer_name: 'Bruce',
  quantity: 2,
  status: 'pending',
  bento_items: buildStructuredMenu({
    variants: [{ id: 1, qty: 2 }],
    combos: [],
    productionLines: [{ ...light, qty: 2 }],
    completedLineKeys: [],
  }),
}

assert.deepEqual(
  getOrderProductionLines(orderA).map(line => [line.key, line.qty]),
  [['variant:1', 1], ['variant:2', 2]],
  'one order expands into its separate meal quantities',
)

const cards = aggregateProductionCards([orderA, orderB])
assert.equal(cards.length, 2, 'same meals merge across customers')
assert.equal(cards.find(card => card.key === 'variant:1')?.totalQty, 3)
assert.deepEqual(
  cards.find(card => card.key === 'variant:1')?.customers,
  [{ orderId: 10, customerName: 'Karen', qty: 1, lineKey: 'variant:1' }, { orderId: 11, customerName: 'Bruce', qty: 2, lineKey: 'variant:1' }],
)

const firstDone = updateProductionLineCompletion(orderA.bento_items, 'variant:1', true, orderA)
assert.equal(firstDone.orderCompleted, false, 'one of two meals done keeps order pending')
const allDone = updateProductionLineCompletion(firstDone.bentoItems, 'variant:2', true, orderA)
assert.equal(allDone.orderCompleted, true, 'all meals done completes the order')

const legacy = getOrderProductionLines({
  id: 12,
  customer_name: 'Legacy',
  quantity: 4,
  status: 'pending',
  menu_type: 'light',
  compartment_a: 'Chicken',
  compartment_b: 'Beans',
  compartment_c: 'Rice',
})
assert.equal(legacy.length, 1)
assert.equal(legacy[0].qty, 4)

const oldMultiMeal = getOrderProductionLines({
  id: 13,
  customer_name: 'Old multi',
  quantity: 3,
  status: 'pending',
  items: 'Light x1, Flavorful x2',
  bento_items: JSON.stringify({
    variants: [{ id: 1, qty: 1 }, { id: 2, qty: 2 }],
    combos: [],
  }),
})
assert.deepEqual(
  oldMultiMeal.map(line => [line.key, line.label, line.qty]),
  [['variant:1', 'Light', 1], ['variant:2', 'Flavorful', 2]],
  'pre-snapshot multi-meal orders recover separate production lines',
)

const instantEdit = applyProductionOrderUpdate(
  [orderA],
  '2026-06-23',
  { order: { ...orderA, date: '2026-06-23', customer_name: 'Karen updated' } },
)
assert.equal(instantEdit[0]?.customer_name, 'Karen updated', 'saved edits replace the visible production order immediately')
assert.deepEqual(
  applyProductionOrderUpdate(instantEdit, '2026-06-23', {
    order: { ...orderA, date: '2026-06-24' },
  }),
  [],
  'moving an order to another date removes it from the currently visible production sheet immediately',
)

const productionSource = await readFile(
  new URL('../app/bento/production/page.tsx', import.meta.url),
  'utf8',
)
assert.match(productionSource, /visibilitychange/, 'Production refreshes when the page becomes visible')
assert.match(productionSource, /window\.addEventListener\('focus'/, 'Production refreshes when the browser regains focus')
assert.match(
  productionSource,
  /allProductionCards\.map\(\(card, index\)/,
  'Production renders one globally aggregated card per meal type',
)
assert.doesNotMatch(
  productionSource,
  /aggregateProductionCards\(g\.rows\)/,
  'Production must not split the same meal into fulfillment/time groups',
)
assert.match(
  productionSource,
  /setOrders\(current => applyProductionOrderUpdate\(current, selectedDate, detail\)\)/,
  'Production applies saved order data immediately without waiting for a database refetch',
)

const editSource = await readFile(
  new URL('../app/bento/orders/[id]/edit/page.tsx', import.meta.url),
  'utf8',
)
assert.match(editSource, /originalDateRef\.current/, 'Edit Order tracks the original order date')
assert.match(editSource, /dates: \[originalDateRef\.current, form\.delivery_date\]/, 'Edit Order broadcasts old and new dates')
assert.match(
  editSource,
  /order: \{ id: orderId, \.\.\.payload, \.\.\.res\.data \}/,
  'Edit Order broadcasts the saved order snapshot',
)

console.log('bento production tests passed')
