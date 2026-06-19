import assert from 'node:assert/strict'
import { getCustomerDetailInitialState } from '../lib/customerDetailState.ts'

const karen = { id: 1, name: 'Karen', used_portions: 6, total_portions: 30 }

assert.deepEqual(
  getCustomerDetailInitialState(karen),
  { customer: karen, loading: false },
  'existing customer card data renders the detail shell immediately',
)

assert.deepEqual(
  getCustomerDetailInitialState(),
  { customer: null, loading: true },
  'direct URL visits wait only until the customer profile is fetched',
)

console.log('customer detail initial state tests passed')
