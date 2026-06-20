# Payables Consistency and Purchase Progressive Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use Purchase Records as the sole Payables source, make Mark Paid update the matching Purchase Record, and progressively reveal Purchase hero, checklist, then records.

**Architecture:** Extract pure Payables projection/summary logic so Home and Payables share one data contract. Replace legacy `payables` table mutations with `purchase_items.payment_status` updates. Split the Purchase navigation-stack bootstrap into independently staged context/KPI, checklist, and records requests while preserving cached and SSR initial data.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Supabase · existing Node/tsx script tests

---

## File Map

- Create `lib/payables/purchasePayables.ts` — pure status normalization, row projection, and summary aggregation.
- Create `scripts/test-purchase-payables.mjs` — regression tests for Payables data behavior.
- Create `scripts/test-purchase-progressive-loading.mjs` — contract test for staged Purchase bootstrap.
- Modify `package.json` — register the two focused test commands.
- Modify `app/payables/actions.ts` — query and update only `purchase_items`; share projection/summary helpers; normalize errors.
- Modify `app/payables/PayablesClient.tsx` — remove create/edit/partial-payment UI and prevent stale cached totals.
- Modify `app/payables/PayableDetail.tsx` — expose only Mark Paid.
- Modify `app/payables/PaymentModal.tsx` — simplify to a Mark Paid confirmation/amount display.
- Modify `app/page.tsx` — continue delegating to the shared Payables summary action.
- Modify `app/purchase/actions.ts` — expose small bootstrap actions for context/KPI and records/summary.
- Modify `app/purchase/PurchaseClient.tsx` — manage staged loading and per-section skeleton/error states.

### Task 1: Lock Payables behavior with failing tests

**Files:**
- Create: `scripts/test-purchase-payables.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing pure-behavior test**

Create a test importing these not-yet-created exports:

```js
import {
  isPaidPaymentStatus,
  purchaseRowToPayable,
  summarizePurchasePayables,
} from '../lib/payables/purchasePayables.ts'

const rows = [
  { id: 1, supplier: 'A', name: 'Fish', total_price: 100, payment_status: 'unpaid', date: '2026-06-20', note: null, created_at: '2026-06-20T00:00:00Z' },
  { id: 2, supplier: 'B', name: 'Rice', total_price: 50, payment_status: 'Paid', date: '2026-06-20', note: null, created_at: '2026-06-20T00:00:00Z' },
]

assert(isPaidPaymentStatus('paid'), 'lowercase paid is paid')
assert(isPaidPaymentStatus('Paid'), 'title-case Paid is paid')
assert(!isPaidPaymentStatus('unpaid'), 'unpaid is outstanding')
assert(purchaseRowToPayable(rows[0]).balance === 100, 'unpaid balance equals total')
assert(summarizePurchasePayables(rows, '2026-06-20').totalBalance === 100, 'paid rows are excluded')
assert(summarizePurchasePayables(rows, '2026-06-20').dueTodayCount === 1, 'only outstanding due-today rows count')
```

- [ ] **Step 2: Register and run the test**

Add:

```json
"test:purchase-payables": "npx tsx scripts/test-purchase-payables.mjs"
```

Run: `npm run test:purchase-payables`

Expected: FAIL because `lib/payables/purchasePayables.ts` does not exist.

- [ ] **Step 3: Commit the red test**

```bash
git add package.json scripts/test-purchase-payables.mjs
git commit -m "test: define purchase-backed payables behavior"
```

### Task 2: Add the shared Payables projection

**Files:**
- Create: `lib/payables/purchasePayables.ts`
- Test: `scripts/test-purchase-payables.mjs`

- [ ] **Step 1: Implement the minimal pure helper**

Define:

```ts
export type PurchasePayableRow = {
  id: number
  supplier: string | null
  name: string
  total_price: number | null
  payment_status: string | null
  date: string
  note: string | null
  created_at: string
}

export function isPaidPaymentStatus(status: string | null): boolean {
  return status?.trim().toLowerCase() === 'paid'
}

export function purchaseRowToPayable(row: PurchasePayableRow): PayableProjection {
  const total = Number(row.total_price ?? 0)
  const paid = isPaidPaymentStatus(row.payment_status)
  return {
    id: row.id,
    supplier_name: row.supplier || row.name || 'Unknown',
    original_amount: total,
    paid_amount: paid ? total : 0,
    balance: paid ? 0 : total,
    due_date: row.date,
    status: paid ? 'paid' : 'outstanding',
    notes: row.note,
    created_at: row.created_at,
  }
}

export function summarizePurchasePayables(rows: PurchasePayableRow[], today: string) {
  const outstanding = rows.filter((row) => !isPaidPaymentStatus(row.payment_status))
  return {
    totalBalance: outstanding.reduce((sum, row) => sum + Number(row.total_price ?? 0), 0),
    dueTodayCount: outstanding.filter((row) => row.date === today).length,
  }
}
```

- [ ] **Step 2: Run the focused test**

Run: `npm run test:purchase-payables`

Expected: PASS with zero failures.

- [ ] **Step 3: Commit**

```bash
git add lib/payables/purchasePayables.ts scripts/test-purchase-payables.mjs package.json
git commit -m "feat: share purchase-backed payables calculations"
```

### Task 3: Fix Mark Paid and remove the legacy Payables write path

**Files:**
- Modify: `app/payables/actions.ts`
- Modify: `app/payables/PayablesClient.tsx`
- Modify: `app/payables/PayableDetail.tsx`
- Modify: `app/payables/PaymentModal.tsx`

- [ ] **Step 1: Make structured Supabase errors readable**

Change `fail()` to prefer `error.message` for plain objects:

```ts
function fail(error: unknown): ActionResult<never> {
  const message =
    error instanceof Error
      ? error.message
      : error != null && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error)
  return { ok: false, error: message }
}
```

- [ ] **Step 2: Use the shared projection and summary**

Select the Purchase Payables columns from `purchase_items`, map rows through
`purchaseRowToPayable`, and calculate Home summary through
`summarizePurchasePayables`. Keep payment-status matching case tolerant.

- [ ] **Step 3: Replace payment recording with a Purchase Record update**

Implement:

```ts
export async function markPurchasePaidAction(id: number): Promise<ActionResult<{ id: number }>> {
  try {
    await requireRole(...WRITE_ROLES)
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('purchase_items')
      .update({ payment_status: 'paid' })
      .eq('id', id)
      .select('id')
      .single()
    if (error) throw error
    return { ok: true, data: { id: Number(data.id) } }
  } catch (error) {
    return fail(error)
  }
}
```

Delete the client use of `createPayableAction`, `updatePayableAction`,
`recordPayablePaymentAction`, and partial-payment controls. The legacy server
exports may be removed when no callers remain.

- [ ] **Step 4: Make Mark Paid update the UI immediately**

On success, remove the paid item from local `items`, update `payablesCache` with
the same rows, close the detail sheet, then call the background `load()` to
reconcile with the server.

- [ ] **Step 5: Run focused tests and type checking**

Run:

```bash
npm run test:purchase-payables
npx tsc --noEmit
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/payables lib/payables app/page.tsx
git commit -m "fix: mark purchase payables paid consistently"
```

### Task 4: Lock the progressive-loading contract

**Files:**
- Create: `scripts/test-purchase-progressive-loading.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing source contract test**

Read `app/purchase/PurchaseClient.tsx` and assert:

```js
assert(source.includes('fetchPurchaseHeroAction'), 'client fetches hero stage')
assert(source.includes('fetchChecklistAction'), 'client fetches checklist stage')
assert(source.includes('fetchPurchaseRecordsAction'), 'client fetches records stage')
assert(!source.includes('Promise.all([fetchPurchaseContextAction(), fetchChecklistAction()])'),
  'initial navigation no longer gates all content behind one Promise.all')
```

- [ ] **Step 2: Register and run**

Add:

```json
"test:purchase-loading": "node scripts/test-purchase-progressive-loading.mjs"
```

Run: `npm run test:purchase-loading`

Expected: FAIL because the staged action names are not present and the combined
bootstrap remains.

- [ ] **Step 3: Commit the red test**

```bash
git add package.json scripts/test-purchase-progressive-loading.mjs
git commit -m "test: define progressive purchase loading"
```

### Task 5: Split Purchase bootstrap into three visible stages

**Files:**
- Modify: `app/purchase/actions.ts`
- Modify: `app/purchase/PurchaseClient.tsx`
- Test: `scripts/test-purchase-progressive-loading.mjs`

- [ ] **Step 1: Add focused server actions**

Add:

```ts
export type PurchaseHeroContext = {
  role: StaffRole
  today: string
  perms: Perms
  kpi: PurchaseKpi
}

export async function fetchPurchaseHeroAction(): Promise<ActionResult<PurchaseHeroContext>> {
  try {
    const staff = await requireRole(...ROLES)
    return {
      ok: true,
      data: {
        role: staff.role,
        today: businessToday(),
        perms: permsFor(staff.role),
        kpi: await computeKpi(staff.role),
      },
    }
  } catch (error) {
    return fail(error)
  }
}

export async function fetchPurchaseRecordsAction(): Promise<ActionResult<{
  records: PurchaseRecord[]
  summary: PurchaseSummary | null
}>> {
  try {
    const staff = await requireRole(...ROLES)
    const [records, summary] = await Promise.all([
      svc.listRecords(staff.role, {}),
      svc.getSummary(staff.role),
    ])
    return { ok: true, data: { records, summary } }
  } catch (error) {
    return fail(error)
  }
}
```

- [ ] **Step 2: Add independent loading state**

Track `heroLoading`, `checklistLoading`, and `recordsLoading`. When no cache or
SSR props exist, fetch the stages in sequence:

```ts
const heroRes = await fetchPurchaseHeroAction()
// render hero as soon as this state is committed
const checklistRes = await fetchChecklistAction()
// render checklist as soon as this state is committed
const recordsRes = await fetchPurchaseRecordsAction()
// finally render records/history
```

Guard every state update with the existing `active` flag. Preserve already
loaded sections if a later request fails.

- [ ] **Step 3: Render section skeletons instead of a full-page gate**

Always render the Purchase header and scroll container. Show:

- hero skeleton only while `heroLoading`,
- checklist skeleton only while `checklistLoading`,
- records skeleton only while `recordsLoading`.

Keep the existing full-page retry only when context/permissions fail. Add a
small retry button to the records section when only records fail.

- [ ] **Step 4: Preserve cache semantics**

Update `purchaseCache` after each stage without discarding fields populated by
an earlier stage. Cached repeat visits render immediately; stale cache refreshes
the same stages in the background.

- [ ] **Step 5: Run the loading contract and Purchase tests**

Run:

```bash
npm run test:purchase-loading
npm run test:purchase-ledger
npx tsc --noEmit
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/purchase/actions.ts app/purchase/PurchaseClient.tsx scripts/test-purchase-progressive-loading.mjs package.json
git commit -m "perf: progressively load purchase sections"
```

### Task 6: Final integration verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run focused regression tests**

```bash
npm run test:purchase-payables
npm run test:purchase-loading
npm run test:purchase-ledger
```

Expected: all tests pass.

- [ ] **Step 2: Run static checks**

```bash
npx tsc --noEmit
npx eslint app/payables app/purchase/actions.ts app/purchase/PurchaseClient.tsx lib/payables scripts/test-purchase-payables.mjs scripts/test-purchase-progressive-loading.mjs
```

Expected: exit 0 with no errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Next.js build exits 0.

- [ ] **Step 4: Verify the user flows locally**

Confirm:

1. Home and Payables show the same outstanding total.
2. Mark Paid removes the row immediately without `[object Object]`.
3. The matching Purchase Record remains and shows Paid.
4. Returning Home shows the reduced Payables total.
5. A cold Purchase entry shows hero first, checklist second, records last.
6. A repeat Purchase entry uses cached content immediately.

- [ ] **Step 5: Review the final diff**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; unrelated Bento and proxy changes remain
untouched.

