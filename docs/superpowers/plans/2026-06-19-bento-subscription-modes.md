# Bento Subscription Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fixed-schedule and flexible-credit Bento customer modes, with database-enforced credit accounting on completed orders.

**Architecture:** Persist the customer mode and optional credit expiry on `bento_customers`, and add a stable `customer_id` foreign key to `bento_orders`. A PostgreSQL trigger reconciles flexible `used_portions` from completed-order deltas, while client components branch their forms and detail views by subscription mode without directly mutating flexible credits.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/PostgreSQL, Tailwind CSS v4, Node assertion scripts.

---

## File map

- Create `supabase/migrations/20260619_bento_subscription_modes.sql`: schema, backfill, trigger, indexes.
- Create `lib/bentoSubscriptionMode.ts`: shared mode types, labels, form normalization, fixed end-date preview helper.
- Create `scripts/test-bento-subscription-mode.mjs`: mode defaults, badge labels, form payloads, fixed end-date preview.
- Create `scripts/test-flexible-credit-accounting.mjs`: pure transition-delta model matching the database trigger.
- Modify `app/bento/customers/new/page.tsx`: required mode selector and mode-specific fields.
- Modify `app/bento/customers/CustomersClient.tsx`: mode fields and customer-card badges.
- Modify `app/bento/customers/page.tsx`: direct-route server list fields and matching badges.
- Modify `app/bento/customers/[id]/page.tsx`: fixed/flexible detail branches and no schedule generation for flexible customers.
- Modify `app/bento/customers/[id]/edit/page.tsx`: display persisted mode and mode-relevant read-only metadata.
- Modify `app/bento/new/page.tsx`: optional customer selection and `customer_id` persistence.
- Modify `app/bento/BentoClient.tsx`: include `customer_id` in order types and preserve it through status changes.
- Modify `app/bento/production/page.tsx`: include `customer_id` in order types/queries where required; status updates remain unchanged.

### Task 1: Verify and apply the database migration

**Files:**

- Review: `supabase/migrations/20260619_bento_subscription_modes.sql`

- [ ] **Step 1: Validate migration invariants**

Confirm the SQL contains:

```sql
subscription_mode text not null default 'fixed'
check (subscription_mode in ('fixed', 'flexible'))
credit_expiry_date date
customer_id bigint references public.bento_customers(id) on delete set null
```

Confirm it backfills `customer_id` only through:

```sql
public.bento_subscription_days.order_id
```

and never through `customer_name`.

- [ ] **Step 2: Review trigger transition coverage**

The trigger must handle:

```text
pending -> completed      +new quantity
completed -> pending      -old quantity
completed -> canceled     -old quantity
completed quantity edit   new quantity - old quantity
completed reassignment    -old customer, +new customer
completed delete          -old quantity
```

Fixed customers must be excluded by:

```sql
and subscription_mode = 'flexible'
```

- [ ] **Step 3: Run migration in a staging or Supabase SQL Editor transaction**

Run the complete migration and verify:

```sql
select subscription_mode, count(*)
from public.bento_customers
group by subscription_mode;
```

Expected before creating flexible customers:

```text
fixed | all existing customers
```

- [ ] **Step 4: Manually verify trigger transitions with a temporary flexible customer**

Use a transaction and an assertion block so verification leaves no data and requires no copied IDs:

```sql
begin;

do $$
declare
  customer_id_value bigint;
  order_id_value bigint;
  used_value integer;
begin
  insert into public.bento_customers (
    name,
    subscription_mode,
    subscription_type,
    delivery_method,
    delivery_frequency,
    total_portions,
    used_portions,
    active
  ) values (
    '__credit_trigger_test__',
    'flexible',
    'monthly',
    'pickup',
    'weekdays',
    20,
    0,
    true
  )
  returning id into customer_id_value;

  insert into public.bento_orders (
    date,
    customer_id,
    customer_name,
    menu_type,
    items,
    amount,
    quantity,
    paid,
    status
  ) values (
    current_date,
    customer_id_value,
    '__credit_trigger_test__',
    'standard',
    'Trigger test',
    0,
    2,
    true,
    'pending'
  )
  returning id into order_id_value;

  select used_portions into used_value
  from public.bento_customers
  where id = customer_id_value;
  if used_value <> 0 then
    raise exception 'Pending order consumed credits: %', used_value;
  end if;

  update public.bento_orders
  set status = 'completed'
  where id = order_id_value;

  select used_portions into used_value
  from public.bento_customers
  where id = customer_id_value;
  if used_value <> 2 then
    raise exception 'Completed order expected 2 credits, got %', used_value;
  end if;

  update public.bento_orders
  set quantity = 3
  where id = order_id_value;

  select used_portions into used_value
  from public.bento_customers
  where id = customer_id_value;
  if used_value <> 3 then
    raise exception 'Quantity edit expected 3 credits, got %', used_value;
  end if;

  update public.bento_orders
  set status = 'pending'
  where id = order_id_value;

  select used_portions into used_value
  from public.bento_customers
  where id = customer_id_value;
  if used_value <> 0 then
    raise exception 'Reverted order expected 0 credits, got %', used_value;
  end if;
end
$$;

rollback;
```

### Task 2: Add shared subscription-mode rules

**Files:**

- Create: `lib/bentoSubscriptionMode.ts`
- Create: `scripts/test-bento-subscription-mode.mjs`
- Create: `scripts/test-flexible-credit-accounting.mjs`

- [ ] **Step 1: Write failing mode tests**

Test:

```typescript
getSubscriptionMode(undefined) === 'fixed'
getSubscriptionBadge({ subscriptionMode: 'fixed', deliveryFrequency: 'daily' }) === 'Fixed · Daily'
getSubscriptionBadge({ subscriptionMode: 'fixed', deliveryFrequency: 'weekdays' }) === 'Fixed · Weekdays'
getSubscriptionBadge({ subscriptionMode: 'flexible', deliveryFrequency: 'weekdays' }) === 'Flexible'
```

Test fixed end-date preview:

```typescript
getFixedScheduleEndDate({
  startDate: '2026-06-16',
  totalMeals: 30,
  deliveryFrequency: 'daily',
}) === '2026-07-15'
```

Test payload normalization:

```typescript
normalizeCustomerSubscriptionInput({
  subscriptionMode: 'flexible',
  totalPortions: 30,
  creditExpiryDate: '2026-12-31',
})
```

must return:

```typescript
{
  subscription_mode: 'flexible',
  total_portions: 30,
  used_portions: 0,
  credit_expiry_date: '2026-12-31',
  start_date: null,
}
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
node --no-warnings --experimental-strip-types scripts/test-bento-subscription-mode.mjs
```

Expected: module or export missing.

- [ ] **Step 3: Implement minimal shared rules**

Export:

```typescript
export type SubscriptionMode = 'fixed' | 'flexible'
export function getSubscriptionMode(value: unknown): SubscriptionMode
export function getSubscriptionBadge(input: {
  subscriptionMode: SubscriptionMode
  deliveryFrequency: 'daily' | 'weekdays'
}): string
export function getFixedScheduleEndDate(input: {
  startDate: string
  totalMeals: number
  deliveryFrequency: 'daily' | 'weekdays'
}): string | null
export function normalizeCustomerSubscriptionInput(...)
```

Reuse `buildSubscriptionPlan()` for the fixed preview instead of duplicating date logic.

- [ ] **Step 4: Write and run the pure credit-transition tests**

Model the same old/new contribution calculation used by SQL:

```typescript
getCompletedCreditContribution({ status: 'pending', quantity: 2 }) === 0
getCompletedCreditContribution({ status: 'completed', quantity: 2 }) === 2
getFlexibleCreditDelta(oldCompleted2, newCompleted3) === 1
getFlexibleCreditDelta(oldCompleted2, newPending3) === -2
```

Run:

```bash
node --no-warnings --experimental-strip-types scripts/test-flexible-credit-accounting.mjs
```

Expected: PASS after implementation.

### Task 3: Add Subscription Mode to New Customer

**Files:**

- Modify: `app/bento/customers/new/page.tsx`

- [ ] **Step 1: Add form state**

Add:

```typescript
subscription_mode: 'fixed',
credit_expiry_date: '',
```

- [ ] **Step 2: Add required mode controls**

Render before delivery-frequency fields:

```text
Subscription Mode *
○ Fixed Schedule
○ Flexible Credits
```

Use existing mobile button/radio styling without redesigning the page.

- [ ] **Step 3: Render fixed-only fields**

When `subscription_mode === 'fixed'`, show:

```text
Delivery Frequency
Start Date
Total Meals
Estimated End Date
```

Estimated End Date is read-only and uses `getFixedScheduleEndDate()`.

- [ ] **Step 4: Render flexible-only fields**

When `subscription_mode === 'flexible'`, show:

```text
Total Meal Credits
Optional Expiry Date
```

Do not show delivery frequency, start date, or estimated end date in this branch.

- [ ] **Step 5: Persist normalized fields**

Insert:

```typescript
subscription_mode
credit_expiry_date
total_portions
used_portions: 0
```

Fixed inserts keep `start_date` and `delivery_frequency`.

Flexible inserts set `start_date: null`; `delivery_frequency` may retain the database default but must not drive UI or schedule generation.

- [ ] **Step 6: Run target lint**

Run:

```bash
npx eslint app/bento/customers/new/page.tsx lib/bentoSubscriptionMode.ts
```

Expected: zero errors.

### Task 4: Add mode badges to customer lists

**Files:**

- Modify: `app/bento/customers/CustomersClient.tsx`
- Modify: `app/bento/customers/page.tsx`

- [ ] **Step 1: Extend customer types**

Add:

```typescript
subscription_mode: 'fixed' | 'flexible'
credit_expiry_date: string | null
```

Treat missing legacy values as fixed with `getSubscriptionMode()`.

- [ ] **Step 2: Replace the existing subscription badge text**

Use:

```typescript
getSubscriptionBadge({
  subscriptionMode: getSubscriptionMode(customer.subscription_mode),
  deliveryFrequency: customer.delivery_frequency ?? 'weekdays',
})
```

Expected labels:

```text
Fixed · Daily
Fixed · Weekdays
Flexible
```

- [ ] **Step 3: Preserve balance rendering**

Both modes continue to show:

```text
used
remaining
progress
```

For flexible customers, label the values as credits where space allows; do not add a second card layout.

- [ ] **Step 4: Run target lint**

Run:

```bash
npx eslint app/bento/customers/CustomersClient.tsx app/bento/customers/page.tsx
```

Expected: zero errors.

### Task 5: Split Customer Detail by mode

**Files:**

- Modify: `app/bento/customers/[id]/page.tsx`

- [ ] **Step 1: Extend the Customer type**

Add:

```typescript
subscription_mode: 'fixed' | 'flexible'
credit_expiry_date: string | null
```

- [ ] **Step 2: Stop flexible schedule generation**

Guard the subscription-day generation block:

```typescript
if (
  cust.subscription_mode !== 'flexible' &&
  !subDaysRes.error &&
  cust.start_date &&
  cust.total_portions > 0
) {
  // existing fixed schedule generation
}
```

- [ ] **Step 3: Render the fixed branch**

For fixed customers, preserve:

```text
Start
Est. End
Calendar
Schedule controls
```

- [ ] **Step 4: Render the flexible branch**

For flexible customers, show:

```text
Total Credits
Delivered Credits
Remaining
Expiry (only when present)
Upcoming Orders
```

Upcoming orders must be:

```typescript
supabase
  .from('bento_orders')
  .select('id,date,status,quantity,menu_type,time_slot,items,note')
  .eq('customer_id', customer.id)
  .gte('date', today)
  .neq('status', 'completed')
  .neq('status', 'canceled')
  .order('date', { ascending: true })
  .limit(20)
```

Do not render estimated end date or subscription calendar.

- [ ] **Step 5: Remove direct flexible used-credit editing**

Hide `Edit used` for flexible customers. Their `used_portions` must only change through the database trigger.

- [ ] **Step 6: Run existing and new tests**

Run:

```bash
node --no-warnings --experimental-strip-types scripts/test-bento-subscription-mode.mjs
node --no-warnings --experimental-strip-types scripts/test-customer-calendar-status.mjs
node --no-warnings --experimental-strip-types scripts/test-subscription-calendar-view.mjs
npm run test:subscription-schedule
```

Expected: all pass.

### Task 6: Persist customer IDs on orders

**Files:**

- Modify: `app/bento/customers/[id]/page.tsx`
- Modify: `app/bento/new/page.tsx`
- Modify: `app/bento/BentoClient.tsx`
- Modify: `app/bento/production/page.tsx`

- [ ] **Step 1: Add customer ID to generated subscription orders**

In the fixed schedule `orderRow`, add:

```typescript
customer_id: cust.id,
```

This ensures generated orders remain linked before the subscription day receives its `order_id`.

- [ ] **Step 2: Add customer selection to New Bento Order**

Fetch active customers with:

```typescript
.from('bento_customers')
.select('id,name,phone,delivery_address,area,subscription_mode,total_portions,used_portions')
.eq('active', true)
.order('name')
```

Selecting a customer stores:

```typescript
customer_id
customer_name
phone
address
area
```

Keep manual customer-name entry possible only when no managed customer is selected; such orders do not participate in flexible credits.

- [ ] **Step 3: Validate flexible balance before order creation**

Do not deduct credits. Show a warning or block only when requested quantity exceeds:

```typescript
total_portions - used_portions
```

The trigger remains the source of truth at completion.

- [ ] **Step 4: Preserve customer ID in Bento order types**

Add:

```typescript
customer_id?: number | null
```

to Bento and Production Sheet order types/queries. Existing status update calls stay unchanged; the trigger runs automatically.

- [ ] **Step 5: Run Bento interaction tests and lint**

Run:

```bash
npm run test:bento-interactions
npx eslint app/bento/new/page.tsx app/bento/BentoClient.tsx app/bento/production/page.tsx
```

Expected: all pass.

### Task 7: Update the edit page metadata

**Files:**

- Modify: `app/bento/customers/[id]/edit/page.tsx`

- [ ] **Step 1: Read persisted mode metadata**

Extend `SubscriptionMeta`:

```typescript
subscription_mode: 'fixed' | 'flexible'
credit_expiry_date: string | null
```

- [ ] **Step 2: Keep subscription mode read-only**

This implementation chooses mode at creation and does not support converting existing customers. Display:

```text
Mode: Fixed Schedule
```

or:

```text
Mode: Flexible Credits
Expiry: ...
```

Do not include `subscription_mode` in the profile update payload.

- [ ] **Step 3: Show mode-relevant accounting labels**

For flexible:

```text
Total Credits
Delivered Credits
Remaining Credits
```

For fixed, preserve current portion labels.

### Task 8: Final verification

**Files:**

- Review all files listed above.

- [ ] **Step 1: Run focused tests**

```bash
node --no-warnings --experimental-strip-types scripts/test-bento-subscription-mode.mjs
node --no-warnings --experimental-strip-types scripts/test-flexible-credit-accounting.mjs
node --no-warnings --experimental-strip-types scripts/test-customer-calendar-status.mjs
node --no-warnings --experimental-strip-types scripts/test-customer-order-history.mjs
node --no-warnings --experimental-strip-types scripts/test-subscription-calendar-view.mjs
npm run test:subscription-schedule
npm run test:bento-interactions
```

- [ ] **Step 2: Run target lint**

```bash
npx eslint \
  lib/bentoSubscriptionMode.ts \
  app/bento/customers/new/page.tsx \
  app/bento/customers/CustomersClient.tsx \
  app/bento/customers/page.tsx \
  'app/bento/customers/[id]/page.tsx' \
  'app/bento/customers/[id]/edit/page.tsx' \
  app/bento/new/page.tsx \
  app/bento/BentoClient.tsx \
  app/bento/production/page.tsx
```

- [ ] **Step 3: Run TypeScript**

```bash
npx tsc --noEmit
```

If unrelated dirty-worktree errors remain, report them separately and confirm there are no errors in changed subscription-mode files.

- [ ] **Step 4: Run whitespace and scope checks**

```bash
git diff --check
git diff -- \
  supabase/migrations/20260619_bento_subscription_modes.sql \
  lib/bentoSubscriptionMode.ts \
  app/bento/customers \
  app/bento/new/page.tsx \
  app/bento/BentoClient.tsx \
  app/bento/production/page.tsx
```

- [ ] **Step 5: Manual acceptance test**

Create one fixed daily customer:

```text
Mode: Fixed Schedule
Start: 2026-06-16
Meals: 30
Expected end: 2026-07-15
```

Create one flexible customer:

```text
Mode: Flexible Credits
Credits: 10
Expiry: optional
```

Verify:

```text
Pending quantity 2 => used remains 0
Complete order     => used becomes 2
Edit completed qty to 3 => used becomes 3
Revert to pending => used becomes 0
Cancel pending    => used remains 0
```
