# Receivables Daily Payment Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one confirmed bulk-payment action per customer/date group in the Bento receivable detail sheet.

**Architecture:** A pure helper will build the exact paid-update rows for a selected date group. `ReceivablesClient` will own the selected group, confirmation dialog, submission state, Supabase updates, error display, and post-success refresh.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Supabase, Node assertions with `tsx`.

---

## File Structure

- Create `lib/receivables/bentoPayment.ts`: pure types and update-payload builder for one date group.
- Create `scripts/test-receivables-daily-payment.mjs`: behavioral and UI regression assertions.
- Modify `app/receivables/ReceivablesClient.tsx`: date-level button, confirmation dialog, batch write, error and refresh behavior.

### Task 1: Define Date-Level Payment Updates

**Files:**
- Create: `scripts/test-receivables-daily-payment.mjs`
- Create: `lib/receivables/bentoPayment.ts`

- [ ] **Step 1: Write the failing helper test**

Create a test with two orders in the chosen date group and one unrelated order. Assert that `buildBentoPaymentUpdates(group.orders)` returns only the two selected IDs with `paid: true`, `payment_status: 'paid'`, and each row's own amount as `amount_paid`.

```js
import assert from 'node:assert/strict'
import { buildBentoPaymentUpdates } from '../lib/receivables/bentoPayment.ts'

const updates = buildBentoPaymentUpdates([
  { id: 11, amount: 576 },
  { id: 12, amount: 240 },
])

assert.deepEqual(updates, [
  { id: 11, paid: true, payment_status: 'paid', amount_paid: 576 },
  { id: 12, paid: true, payment_status: 'paid', amount_paid: 240 },
])
```

- [ ] **Step 2: Run the helper test and verify red**

Run: `node --import tsx scripts/test-receivables-daily-payment.mjs`

Expected: FAIL because `lib/receivables/bentoPayment.ts` does not exist.

- [ ] **Step 3: Implement the pure helper**

```ts
export type BentoPaymentOrder = { id: number; amount: number | null }

export type BentoPaymentUpdate = {
  id: number
  paid: true
  payment_status: 'paid'
  amount_paid: number
}

export function buildBentoPaymentUpdates(orders: BentoPaymentOrder[]): BentoPaymentUpdate[] {
  return orders.map(order => ({
    id: order.id,
    paid: true,
    payment_status: 'paid',
    amount_paid: Number(order.amount || 0),
  }))
}
```

- [ ] **Step 4: Run the helper test and verify green**

Run: `node --import tsx scripts/test-receivables-daily-payment.mjs`

Expected: `Receivables daily payment tests passed.`

### Task 2: Add the Date Button and Confirmation Flow

**Files:**
- Modify: `scripts/test-receivables-daily-payment.mjs`
- Modify: `app/receivables/ReceivablesClient.tsx:31-260`

- [ ] **Step 1: Add failing UI assertions**

Read `ReceivablesClient.tsx` in the test and assert it contains:

```js
assert.match(source, /aria-label={`Confirm payment for \${fmtDate\(g.date\)}`}/)
assert.match(source, /Confirm received payment/)
assert.match(source, /buildBentoPaymentUpdates\(paymentTarget.orders\)/)
```

- [ ] **Step 2: Run the UI test and verify red**

Run: `node --import tsx scripts/test-receivables-daily-payment.mjs`

Expected: FAIL because the confirmation control is absent.

- [ ] **Step 3: Add state and the batch-payment handler**

Import `buildBentoPaymentUpdates`, add `paymentTarget`, `paymentSaving`, and `paymentError` state, and implement a handler that updates exactly the target group's orders:

```ts
async function confirmBentoPayment() {
  if (!paymentTarget || paymentSaving) return
  setPaymentSaving(true)
  setPaymentError(null)
  const updates = buildBentoPaymentUpdates(paymentTarget.orders)
  const results = await Promise.all(updates.map(({ id, ...values }) =>
    supabase.from('bento_orders').update(values).eq('id', id),
  ))
  const failed = results.find(result => result.error)
  if (failed?.error) {
    setPaymentError(failed.error.message || 'Failed to confirm payment.')
    setPaymentSaving(false)
    return
  }
  setPaymentTarget(null)
  setBentoDetail(null)
  await load()
  setPaymentSaving(false)
}
```

- [ ] **Step 4: Add one button per date group**

Place an orange button beside each date total, guarded by `canWrite`, with this accessible name and target:

```tsx
<button
  type="button"
  aria-label={`Confirm payment for ${fmtDate(g.date)}`}
  onClick={() => { setPaymentError(null); setPaymentTarget(g) }}
  className="rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-600 active:opacity-70"
>
  Confirm payment
</button>
```

- [ ] **Step 5: Add the in-app confirmation dialog**

Render a centered portal above the detail sheet. Show the customer, formatted date, order count, and total. Provide Cancel and `Confirm received payment` buttons. Disable both controls while saving, label the submit state `Processing…`, and render `paymentError` in red without closing the dialog.

- [ ] **Step 6: Run the focused regression test**

Run: `node --import tsx scripts/test-receivables-daily-payment.mjs`

Expected: `Receivables daily payment tests passed.`

### Task 3: Verify the Complete Change

**Files:**
- Verify: `app/receivables/ReceivablesClient.tsx`
- Verify: `lib/receivables/bentoPayment.ts`
- Verify: `scripts/test-receivables-daily-payment.mjs`

- [ ] **Step 1: Run focused and existing Receivables tests**

```bash
node --import tsx scripts/test-receivables-daily-payment.mjs
node scripts/test-receivables-bento-close-button.mjs
```

Expected: both scripts print their pass messages.

- [ ] **Step 2: Run static verification**

```bash
npx eslint app/receivables/ReceivablesClient.tsx lib/receivables/bentoPayment.ts scripts/test-receivables-daily-payment.mjs
npx tsc --noEmit
git diff --check
```

Expected: exit code 0 with no errors.

- [ ] **Step 3: Commit only feature files**

```bash
git add app/receivables/ReceivablesClient.tsx lib/receivables/bentoPayment.ts scripts/test-receivables-daily-payment.mjs docs/superpowers/plans/2026-07-02-receivables-daily-payment.md
git commit -m "Add daily receivable payment confirmation"
```
