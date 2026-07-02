import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildBentoPaymentUpdates } from '../lib/receivables/bentoPayment.ts'

const updates = buildBentoPaymentUpdates([
  { id: 11, amount: 576 },
  { id: 12, amount: 240 },
])

assert.deepEqual(updates, [
  { id: 11, paid: true, payment_status: 'paid', amount_paid: 576 },
  { id: 12, paid: true, payment_status: 'paid', amount_paid: 240 },
])

const source = await readFile(
  new URL('../app/receivables/ReceivablesClient.tsx', import.meta.url),
  'utf8',
)

assert.match(
  source,
  /aria-label={`Confirm payment for \${fmtDate\(g.date\)}`}/,
  'each customer date group should expose one payment button',
)
assert.match(source, /Confirm received payment/, 'payment requires an in-app confirmation')
assert.match(
  source,
  /buildBentoPaymentUpdates\(paymentTarget.orders\)/,
  'confirmation should update only the selected date group',
)

console.log('Receivables daily payment tests passed.')
