# Cash Drawer V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Cash Drawer module — two new DB tables, six server actions, a 5-step import wizard, a Coupon/Pay Out adjustment sheet, and a fully wired `CashierClient` with counter selector, hero card, and adjustments list.

**Architecture:** A Supabase migration creates `cash_drawer_sessions` (immutable FeedMe import) and `cash_adjustments` (soft-deleted Wenxin records). Six server actions in `app/cashier/actions.ts` own all DB writes. `page.tsx` fetches both tables server-side and passes data + permission flags to `CashierClient`, which manages two bottom-sheet UIs via `useState`.

**Tech Stack:** Next.js 15 App Router · TypeScript · Tailwind CSS v4 · Supabase (postgres + RLS) · `createServerSupabaseClient` · `requireRole` / `requireCurrentStaff` · `businessToday()` from `lib/purchaseLedger/time`

**Spec:** `docs/superpowers/specs/2026-06-25-cash-drawer-v1-design.md`

**Clarification (approved):** Adjustments (Coupon, Pay Out) are tracked and displayed but do NOT affect the computed Current Cash in V1. The UI must make this clear with a visible note.

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `supabase/migrations/20260625_cash_drawer.sql` | **Create** | Both tables + RLS policies |
| `lib/cashDrawer/types.ts` | **Create** | `CashDrawerSession`, `CashAdjustment`, `ImportSessionInput`, `CreateAdjustmentInput` |
| `app/cashier/actions.ts` | **Create** | 6 server actions (fetch, import, delete, adjustments) |
| `scripts/test-cash-drawer.mjs` | **Create** | Integration test: verify tables + RLS via Supabase |
| `app/cashier/page.tsx` | **Modify** | Fetch sessions + adjustments; derive `canImport`/`canAdjust`; pass to client |
| `app/cashier/CashierClient.tsx` | **Rewrite** | Counter selector · Hero Card · Import button · Drawer Session · Cash Summary · Payments · Adjustments list |
| `app/cashier/ImportSessionSheet.tsx` | **Create** | 5-step import wizard (bottom sheet) |
| `app/cashier/AddAdjustmentSheet.tsx` | **Create** | Coupon + Pay Out tabs (bottom sheet) |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260625_cash_drawer.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260625_cash_drawer.sql
-- ═══════════════════════════════════════════════════════════════════
-- Cash Drawer V1
-- cash_drawer_sessions  — immutable FeedMe import data
-- cash_adjustments      — Wenxin-managed, soft-deleted
-- ═══════════════════════════════════════════════════════════════════

-- ── cash_drawer_sessions ─────────────────────────────────────────────
create table if not exists public.cash_drawer_sessions (
  id                    bigserial        primary key,
  business_date         date             not null,
  counter               text             not null,
  outlet_id             uuid             not null,
  outlet_name           text,

  open_time             timestamptz,
  close_time            timestamptz,
  opened_by             text,
  closed_by             text,

  opening_float         numeric(10,2),
  closing_float         numeric(10,2),

  cash_sales            numeric(10,2),
  pay_in                numeric(10,2),
  pay_out               numeric(10,2),

  alipay                numeric(10,2),
  duitnow               numeric(10,2),
  maybank_qr            numeric(10,2),
  touchngo              numeric(10,2),
  wechat                numeric(10,2),

  source                text             not null default 'manual_import',
  raw_source_payload    jsonb,
  imported_at           timestamptz,
  imported_by           uuid             references auth.users(id),
  created_at            timestamptz      not null default now(),

  constraint cash_drawer_sessions_source_check
    check (source in ('manual_import', 'feedme_relay')),
  constraint cash_drawer_sessions_unique_date_counter_outlet
    unique (business_date, counter, outlet_id)
);

create index if not exists cash_drawer_sessions_date_outlet_idx
  on public.cash_drawer_sessions(outlet_id, business_date desc);

alter table public.cash_drawer_sessions enable row level security;

-- SELECT: owner + manager
drop policy if exists cash_drawer_sessions_select on public.cash_drawer_sessions;
create policy cash_drawer_sessions_select
  on public.cash_drawer_sessions
  for select to authenticated
  using (public.staff_role_is(array['owner', 'manager']));

-- INSERT: owner only
drop policy if exists cash_drawer_sessions_insert on public.cash_drawer_sessions;
create policy cash_drawer_sessions_insert
  on public.cash_drawer_sessions
  for insert to authenticated
  with check (public.staff_role_is(array['owner']));

-- UPDATE: nobody (no policy = no access — immutable by design)

-- DELETE: owner only (re-import correction)
drop policy if exists cash_drawer_sessions_delete on public.cash_drawer_sessions;
create policy cash_drawer_sessions_delete
  on public.cash_drawer_sessions
  for delete to authenticated
  using (public.staff_role_is(array['owner']));

-- ── cash_adjustments ─────────────────────────────────────────────────
create table if not exists public.cash_adjustments (
  id                    bigserial        primary key,
  business_date         date             not null,
  outlet_id             uuid             not null,
  session_id            bigint           references public.cash_drawer_sessions(id) on delete set null,

  adjustment_type       text             not null,
  amount                numeric(10,2)    not null,
  quantity              integer,
  reference_no          text,
  receipt_url           text,
  category              text,
  note                  text,

  status                text             not null default 'approved',
  approved_by           uuid             references auth.users(id),
  approved_at           timestamptz,

  created_by            uuid             not null references auth.users(id),
  created_at            timestamptz      not null default now(),

  deleted_at            timestamptz,
  deleted_by            uuid             references auth.users(id),

  constraint cash_adjustments_type_check
    check (adjustment_type in ('coupon','voucher','refund','manual_adjustment','pay_out','other')),
  constraint cash_adjustments_status_check
    check (status in ('draft','pending_approval','approved','rejected'))
);

create index if not exists cash_adjustments_date_outlet_idx
  on public.cash_adjustments(outlet_id, business_date desc)
  where deleted_at is null;

alter table public.cash_adjustments enable row level security;

-- SELECT: owner + manager
drop policy if exists cash_adjustments_select on public.cash_adjustments;
create policy cash_adjustments_select
  on public.cash_adjustments
  for select to authenticated
  using (public.staff_role_is(array['owner', 'manager']));

-- INSERT: owner + manager
drop policy if exists cash_adjustments_insert on public.cash_adjustments;
create policy cash_adjustments_insert
  on public.cash_adjustments
  for insert to authenticated
  with check (public.staff_role_is(array['owner', 'manager']));

-- UPDATE: owner + manager (application layer only writes deleted_at + deleted_by)
drop policy if exists cash_adjustments_update on public.cash_adjustments;
create policy cash_adjustments_update
  on public.cash_adjustments
  for update to authenticated
  using (public.staff_role_is(array['owner', 'manager']));

-- DELETE: nobody (hard delete disabled; soft delete only)
```

- [ ] **Step 2: Apply the migration in Supabase**

Run in the Supabase dashboard SQL editor OR via CLI:
```bash
supabase db push
```
Or paste the SQL directly into the dashboard.

Expected: both tables visible in the Supabase table editor with RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260625_cash_drawer.sql
git commit -m "feat(cash-drawer): add cash_drawer_sessions and cash_adjustments tables with RLS"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `lib/cashDrawer/types.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/cashDrawer/types.ts

export type CashDrawerSession = {
  id: number
  businessDate: string        // YYYY-MM-DD
  counter: string
  outletId: string
  outletName: string | null
  openTime: string | null     // ISO timestamptz
  closeTime: string | null
  openedBy: string | null
  closedBy: string | null
  openingFloat: number | null
  closingFloat: number | null
  cashSales: number | null
  payIn: number | null
  payOut: number | null
  alipay: number | null
  duitnow: number | null
  maybankQr: number | null
  touchngo: number | null
  wechat: number | null
  source: 'manual_import' | 'feedme_relay'
  importedAt: string | null
  importedBy: string | null
  createdAt: string
}

export type CashAdjustmentType =
  | 'coupon' | 'voucher' | 'refund'
  | 'manual_adjustment' | 'pay_out' | 'other'

export type CashAdjustment = {
  id: number
  businessDate: string
  outletId: string
  sessionId: number | null
  adjustmentType: CashAdjustmentType
  amount: number
  quantity: number | null
  referenceNo: string | null
  receiptUrl: string | null
  category: string | null
  note: string | null
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected'
  approvedBy: string | null
  approvedAt: string | null
  createdBy: string
  createdAt: string
}

export type ImportSessionInput = {
  businessDate: string        // YYYY-MM-DD
  counter: string
  outletName: string | null
  openTime: string | null     // ISO datetime string (from datetime-local input)
  closeTime: string | null
  openedBy: string | null
  closedBy: string | null
  openingFloat: number | null
  closingFloat: number | null
  cashSales: number | null
  payIn: number | null
  payOut: number | null
  alipay: number | null
  duitnow: number | null
  maybankQr: number | null
  touchngo: number | null
  wechat: number | null
}

export type CreateAdjustmentInput = {
  businessDate: string
  sessionId: number | null
  adjustmentType: CashAdjustmentType
  amount: number
  quantity: number | null
  referenceNo: string | null
  category: string | null
  note: string | null
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/cashDrawer/types.ts
git commit -m "feat(cash-drawer): add CashDrawerSession, CashAdjustment, and input types"
```

---

## Task 3: Server Actions

**Files:**
- Create: `app/cashier/actions.ts`

- [ ] **Step 1: Write the actions file**

```typescript
// app/cashier/actions.ts
'use server'

import { requireRole, requireCurrentStaff } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { CashDrawerSession, CashAdjustment, ImportSessionInput, CreateAdjustmentInput } from '@/lib/cashDrawer/types'

const OUTLET_ID = '00000000-0000-0000-0000-000000000001'

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// ── Session helpers ───────────────────────────────────────────────────

function rowToSession(row: Record<string, unknown>): CashDrawerSession {
  return {
    id:            row.id as number,
    businessDate:  row.business_date as string,
    counter:       row.counter as string,
    outletId:      row.outlet_id as string,
    outletName:    (row.outlet_name as string) ?? null,
    openTime:      (row.open_time as string) ?? null,
    closeTime:     (row.close_time as string) ?? null,
    openedBy:      (row.opened_by as string) ?? null,
    closedBy:      (row.closed_by as string) ?? null,
    openingFloat:  row.opening_float != null ? Number(row.opening_float) : null,
    closingFloat:  row.closing_float != null ? Number(row.closing_float) : null,
    cashSales:     row.cash_sales != null ? Number(row.cash_sales) : null,
    payIn:         row.pay_in != null ? Number(row.pay_in) : null,
    payOut:        row.pay_out != null ? Number(row.pay_out) : null,
    alipay:        row.alipay != null ? Number(row.alipay) : null,
    duitnow:       row.duitnow != null ? Number(row.duitnow) : null,
    maybankQr:     row.maybank_qr != null ? Number(row.maybank_qr) : null,
    touchngo:      row.touchngo != null ? Number(row.touchngo) : null,
    wechat:        row.wechat != null ? Number(row.wechat) : null,
    source:        row.source as 'manual_import' | 'feedme_relay',
    importedAt:    (row.imported_at as string) ?? null,
    importedBy:    (row.imported_by as string) ?? null,
    createdAt:     row.created_at as string,
  }
}

function rowToAdjustment(row: Record<string, unknown>): CashAdjustment {
  return {
    id:             row.id as number,
    businessDate:   row.business_date as string,
    outletId:       row.outlet_id as string,
    sessionId:      (row.session_id as number) ?? null,
    adjustmentType: row.adjustment_type as CashAdjustment['adjustmentType'],
    amount:         Number(row.amount),
    quantity:       (row.quantity as number) ?? null,
    referenceNo:    (row.reference_no as string) ?? null,
    receiptUrl:     (row.receipt_url as string) ?? null,
    category:       (row.category as string) ?? null,
    note:           (row.note as string) ?? null,
    status:         row.status as CashAdjustment['status'],
    approvedBy:     (row.approved_by as string) ?? null,
    approvedAt:     (row.approved_at as string) ?? null,
    createdBy:      row.created_by as string,
    createdAt:      row.created_at as string,
  }
}

// ── Session actions ───────────────────────────────────────────────────

export async function fetchCashDrawerSessionsAction(
  businessDate: string,
): Promise<ActionResult<CashDrawerSession[]>> {
  try {
    await requireRole('owner', 'manager')
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('cash_drawer_sessions')
      .select('*')
      .eq('outlet_id', OUTLET_ID)
      .eq('business_date', businessDate)
      .order('counter', { ascending: true })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []).map(rowToSession) }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function importCashDrawerSessionAction(
  input: ImportSessionInput,
): Promise<ActionResult<CashDrawerSession>> {
  try {
    const staff = await requireRole('owner')
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('cash_drawer_sessions')
      .insert({
        business_date:   input.businessDate,
        counter:         input.counter.trim(),
        outlet_id:       OUTLET_ID,
        outlet_name:     input.outletName?.trim() || null,
        open_time:       input.openTime || null,
        close_time:      input.closeTime || null,
        opened_by:       input.openedBy?.trim() || null,
        closed_by:       input.closedBy?.trim() || null,
        opening_float:   input.openingFloat,
        closing_float:   input.closingFloat,
        cash_sales:      input.cashSales,
        pay_in:          input.payIn,
        pay_out:         input.payOut,
        alipay:          input.alipay,
        duitnow:         input.duitnow,
        maybank_qr:      input.maybankQr,
        touchngo:        input.touchngo,
        wechat:          input.wechat,
        source:          'manual_import',
        imported_at:     new Date().toISOString(),
        imported_by:     staff.id,
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: `A session for ${input.businessDate} / ${input.counter} already exists` }
      }
      return { ok: false, error: error.message }
    }

    return { ok: true, data: rowToSession(data) }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function deleteCashDrawerSessionAction(
  id: number,
): Promise<ActionResult<void>> {
  try {
    await requireRole('owner')
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('cash_drawer_sessions')
      .delete()
      .eq('id', id)

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: undefined }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

// ── Adjustment actions ────────────────────────────────────────────────

export async function fetchCashAdjustmentsAction(
  businessDate: string,
): Promise<ActionResult<CashAdjustment[]>> {
  try {
    await requireRole('owner', 'manager')
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('cash_adjustments')
      .select('*')
      .eq('outlet_id', OUTLET_ID)
      .eq('business_date', businessDate)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []).map(rowToAdjustment) }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function createCashAdjustmentAction(
  input: CreateAdjustmentInput,
): Promise<ActionResult<CashAdjustment>> {
  try {
    const staff = await requireRole('owner', 'manager')
    if (input.amount <= 0) return { ok: false, error: 'Amount must be greater than zero' }

    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('cash_adjustments')
      .insert({
        business_date:    input.businessDate,
        outlet_id:        OUTLET_ID,
        session_id:       input.sessionId,
        adjustment_type:  input.adjustmentType,
        amount:           input.amount,
        quantity:         input.quantity,
        reference_no:     input.referenceNo?.trim() || null,
        category:         input.category?.trim() || null,
        note:             input.note?.trim() || null,
        status:           'approved',
        approved_by:      staff.id,
        approved_at:      new Date().toISOString(),
        created_by:       staff.id,
      })
      .select('*')
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: rowToAdjustment(data) }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function softDeleteCashAdjustmentAction(
  id: number,
): Promise<ActionResult<void>> {
  try {
    const staff = await requireRole('owner', 'manager')
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('cash_adjustments')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: staff.id,
      })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: undefined }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/cashier/actions.ts
git commit -m "feat(cash-drawer): add 6 server actions for sessions and adjustments"
```

---

## Task 4: Integration Test Script

**Files:**
- Create: `scripts/test-cash-drawer.mjs`

- [ ] **Step 1: Write the test script**

```javascript
// scripts/test-cash-drawer.mjs
// Verifies cash_drawer_sessions and cash_adjustments tables exist with correct columns.
// Run: node scripts/test-cash-drawer.mjs

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

let passed = 0
let failed = 0

function ok(label) {
  console.log(`  ✓ ${label}`)
  passed++
}

function fail(label, detail) {
  console.error(`  ✗ ${label}: ${detail}`)
  failed++
}

async function run() {
  console.log('\nCash Drawer — DB Smoke Tests\n')

  // 1. cash_drawer_sessions table exists and is queryable
  {
    const { error } = await supabase
      .from('cash_drawer_sessions')
      .select('id, business_date, counter, outlet_id, source')
      .limit(1)
    if (error) fail('cash_drawer_sessions queryable', error.message)
    else ok('cash_drawer_sessions table exists')
  }

  // 2. cash_adjustments table exists and is queryable
  {
    const { error } = await supabase
      .from('cash_adjustments')
      .select('id, business_date, adjustment_type, amount, deleted_at')
      .limit(1)
    if (error) fail('cash_adjustments queryable', error.message)
    else ok('cash_adjustments table exists')
  }

  // 3. Duplicate constraint on cash_drawer_sessions
  {
    const OUTLET = '00000000-0000-0000-0000-000000000001'
    const TEST_DATE = '2000-01-01'
    const TEST_COUNTER = '__test_counter__'

    // Insert first row (use service role to bypass RLS)
    const { data: first, error: e1 } = await supabase
      .from('cash_drawer_sessions')
      .insert({ business_date: TEST_DATE, counter: TEST_COUNTER, outlet_id: OUTLET, source: 'manual_import' })
      .select('id')
      .single()

    if (e1) {
      fail('unique constraint test: insert first row', e1.message)
    } else {
      // Insert duplicate — must fail
      const { error: e2 } = await supabase
        .from('cash_drawer_sessions')
        .insert({ business_date: TEST_DATE, counter: TEST_COUNTER, outlet_id: OUTLET, source: 'manual_import' })
        .select('id')
        .single()

      if (e2?.code === '23505') ok('unique (business_date, counter, outlet_id) constraint enforced')
      else fail('unique constraint', `expected 23505 but got ${e2?.code ?? 'no error'}`)

      // Cleanup
      await supabase.from('cash_drawer_sessions').delete().eq('id', first.id)
    }
  }

  // 4. cash_adjustments soft-delete: deleted_at filter
  {
    const OUTLET = '00000000-0000-0000-0000-000000000001'
    // We can't insert without a real auth.users row for created_by, so just verify column exists
    const { data, error } = await supabase
      .from('cash_adjustments')
      .select('id, deleted_at')
      .is('deleted_at', null)
      .limit(1)
    if (error) fail('soft-delete filter works', error.message)
    else ok('soft-delete filter (deleted_at IS NULL) works')
  }

  console.log(`\n${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exit(1)
}

run().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Run the test**

```bash
node scripts/test-cash-drawer.mjs
```
Expected:
```
Cash Drawer — DB Smoke Tests

  ✓ cash_drawer_sessions table exists
  ✓ cash_adjustments table exists
  ✓ unique (business_date, counter, outlet_id) constraint enforced
  ✓ soft-delete filter (deleted_at IS NULL) works

4 passed, 0 failed
```

- [ ] **Step 3: Add script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test:cash-drawer": "node scripts/test-cash-drawer.mjs"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/test-cash-drawer.mjs package.json
git commit -m "test(cash-drawer): add DB smoke test for sessions and adjustments tables"
```

---

## Task 5: Update `app/cashier/page.tsx`

**Files:**
- Modify: `app/cashier/page.tsx`

- [ ] **Step 1: Rewrite page.tsx**

Replace the entire file with:

```typescript
// app/cashier/page.tsx
import { requireCurrentStaff } from '@/lib/auth/currentStaff'
import { canViewCashier } from '@/lib/cashier/permissions'
import { redirect } from 'next/navigation'
import { readRelayDaily } from '@/lib/feedme/relayStore'
import { fetchCashDrawerSessionsAction, fetchCashAdjustmentsAction } from './actions'
import { businessToday } from '@/lib/purchaseLedger/time'
import CashierClient from './CashierClient'

export const dynamic = 'force-dynamic'

export default async function CashierPage() {
  const staff = await requireCurrentStaff()

  if (!canViewCashier(staff.role)) {
    redirect('/access-denied')
  }

  const businessDate = businessToday()
  const canImport = staff.role === 'owner'
  const canAdjust = staff.role === 'owner' || staff.role === 'manager'

  // Fetch sessions and adjustments in parallel
  const [sessionsResult, adjustmentsResult] = await Promise.all([
    fetchCashDrawerSessionsAction(businessDate),
    fetchCashAdjustmentsAction(businessDate),
  ])

  const sessions = sessionsResult.ok ? sessionsResult.data : []
  const adjustments = adjustmentsResult.ok ? adjustmentsResult.data : []

  // FeedMe relay — fallback when no session imported yet
  let feedMeCashSales: number | null = null
  let feedMePayments: Array<{ method: string; amount: number; percentage: number }> | null = null

  if (sessions.length === 0) {
    try {
      const relay = await readRelayDaily()
      if (relay?.value) {
        const pmts = relay.value.payments
        feedMeCashSales = pmts?.find(p => p.method === 'CASH')?.amount ?? null
        feedMePayments  = pmts?.length ? pmts : null
      }
    } catch {
      // FeedMe unavailable — page renders with empty states
    }
  }

  return (
    <CashierClient
      sessions={sessions}
      adjustments={adjustments}
      feedMeCashSales={feedMeCashSales}
      feedMePayments={feedMePayments}
      businessDate={businessDate}
      canImport={canImport}
      canAdjust={canAdjust}
    />
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: errors about `CashierClient` not accepting these props yet (Task 6 fixes this). Note the errors — they are expected until `CashierClient` is updated.

- [ ] **Step 3: Commit (even with expected TS errors)**

Skip this commit — commit together with Task 6 once `CashierClient` is updated.

---

## Task 6: Rewrite `app/cashier/CashierClient.tsx`

**Files:**
- Rewrite: `app/cashier/CashierClient.tsx`

This task replaces the current file entirely. The sheets (`ImportSessionSheet`, `AddAdjustmentSheet`) are not yet wired — their buttons will be stubs until Tasks 7–9.

- [ ] **Step 1: Rewrite the file**

```tsx
// app/cashier/CashierClient.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BackButton from '@/app/components/BackButton'
import PageTransition from '@/app/components/PageTransition'
import type { CashDrawerSession, CashAdjustment } from '@/lib/cashDrawer/types'
import { deleteCashDrawerSessionAction, softDeleteCashAdjustmentAction } from './actions'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmount(n: number) {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${DAYS[date.getUTCDay()]}, ${d} ${MONTHS[m - 1]} ${y}`
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('en-MY', {
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kuching',
    })
  } catch { return '—' }
}

const METHOD_LABELS: Record<string, string> = {
  CASH:           'Cash',
  ALIPAY:         'Alipay',
  WECHAT:         'WeChat',
  'WECHAT PAY':   'WeChat Pay',
  DUITNOW:        'DuitNow',
  'DUIT NOW':     'DuitNow',
  'MAYBANK QR':   'Maybank QR',
  "TOUCH'N GO":   "Touch'n Go",
  TOUCHNGO:       "Touch'n Go",
  TNG:            "Touch'n Go",
}

function methodLabel(m: string): string {
  return (
    METHOD_LABELS[m.toUpperCase()] ??
    m.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  )
}

function computeCurrentCash(s: CashDrawerSession): number | null {
  if (s.openingFloat == null || s.cashSales == null || s.payIn == null || s.payOut == null) return null
  return s.openingFloat + s.cashSales + s.payIn - s.payOut
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

function SectionTitle({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between pt-4 pb-1">
      <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</div>
      {action}
    </div>
  )
}

function Row({
  label,
  value,
  highlight,
  dim,
  noBorder,
}: {
  label: string
  value: string
  highlight?: boolean
  dim?: boolean
  noBorder?: boolean
}) {
  return (
    <div className={`flex items-center justify-between py-2.5 ${noBorder ? '' : 'border-b border-gray-50'}`}>
      <span className={`text-sm ${highlight ? 'font-semibold text-gray-900' : dim ? 'text-gray-400' : 'text-gray-500'}`}>
        {label}
      </span>
      <span className={`text-sm tabular-nums ${highlight ? 'font-semibold text-gray-900' : dim ? 'text-gray-300' : 'text-gray-700'}`}>
        {value}
      </span>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-6">
      <span className="text-sm text-gray-400">{message}</span>
    </div>
  )
}

type AdjTypeBadgeProps = { type: CashAdjustment['adjustmentType'] }
function AdjTypeBadge({ type }: AdjTypeBadgeProps) {
  const labels: Record<CashAdjustment['adjustmentType'], string> = {
    coupon: 'Coupon', voucher: 'Voucher', refund: 'Refund',
    manual_adjustment: 'Adjustment', pay_out: 'Pay Out', other: 'Other',
  }
  const colors: Record<CashAdjustment['adjustmentType'], string> = {
    coupon: 'bg-blue-100 text-blue-700',
    voucher: 'bg-purple-100 text-purple-700',
    refund: 'bg-yellow-100 text-yellow-700',
    manual_adjustment: 'bg-gray-100 text-gray-600',
    pay_out: 'bg-orange-100 text-orange-700',
    other: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors[type]}`}>
      {labels[type]}
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

type Payment = { method: string; amount: number; percentage: number }

type Props = {
  sessions: CashDrawerSession[]
  adjustments: CashAdjustment[]
  feedMeCashSales: number | null
  feedMePayments: Payment[] | null
  businessDate: string
  canImport: boolean
  canAdjust: boolean
}

export default function CashierClient({
  sessions,
  adjustments,
  feedMeCashSales,
  feedMePayments,
  businessDate,
  canImport,
  canAdjust,
}: Props) {
  const router = useRouter()
  const [activeSession, setActiveSession] = useState<CashDrawerSession | null>(sessions[0] ?? null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [importSheetOpen, setImportSheetOpen] = useState(false)
  const [addAdjSheetOpen, setAddAdjSheetOpen] = useState(false)

  // Hero Card
  const hasSession = activeSession !== null
  const heroTitle  = hasSession ? 'Current Cash' : 'Cash Sales Today'
  const heroValue  = hasSession ? computeCurrentCash(activeSession) : feedMeCashSales
  const heroSource = hasSession ? 'FeedMe Import' : (feedMeCashSales !== null ? 'FeedMe POS' : null)
  const heroBadge  = hasSession
    ? (activeSession.closeTime ? 'Closed' : 'Open')
    : (feedMeCashSales !== null ? 'Live' : null)
  const heroDisplay = heroValue !== null ? fmtAmount(heroValue) : '—'

  async function handleDeleteSession() {
    if (!activeSession || deleting) return
    setDeleting(true)
    setDeleteError(null)
    const result = await deleteCashDrawerSessionAction(activeSession.id)
    if (result.ok) {
      setShowDeleteConfirm(false)
      router.refresh()
    } else {
      setDeleteError(result.error)
      setDeleting(false)
    }
  }

  async function handleSoftDeleteAdjustment(id: number) {
    const result = await softDeleteCashAdjustmentAction(id)
    if (result.ok) router.refresh()
  }

  // Payments to display
  const sessionPayments: { label: string; value: string }[] = activeSession
    ? [
        { label: 'Cash',       value: activeSession.cashSales != null ? fmtAmount(activeSession.cashSales) : '—' },
        { label: 'Alipay',     value: activeSession.alipay    != null ? fmtAmount(activeSession.alipay)    : '—' },
        { label: 'DuitNow',    value: activeSession.duitnow   != null ? fmtAmount(activeSession.duitnow)   : '—' },
        { label: 'Maybank QR', value: activeSession.maybankQr != null ? fmtAmount(activeSession.maybankQr) : '—' },
        { label: "Touch'n Go", value: activeSession.touchngo  != null ? fmtAmount(activeSession.touchngo)  : '—' },
        { label: 'WeChat',     value: activeSession.wechat    != null ? fmtAmount(activeSession.wechat)    : '—' },
      ]
    : []

  return (
    <PageTransition>
      <main className="min-h-screen bg-gray-50">

        {/* Header */}
        <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-10">
          <BackButton href="/" />
          <span className="font-semibold text-base">Cash Drawer</span>
        </div>

        <div className="px-4 py-4 pb-8 space-y-4">

          {/* ── Counter Selector ── */}
          {sessions.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSession(s)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeSession?.id === s.id
                      ? 'bg-orange-500 text-white'
                      : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                >
                  {s.counter}
                </button>
              ))}
            </div>
          )}

          {/* ── Hero Card ── */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(150deg, #fb923c 0%, #f97316 45%, #ea580c 100%)' }}
          >
            <div className="flex flex-col px-5 pt-4 pb-5">
              <div className="text-sm font-medium text-white/90 mb-2">{heroTitle}</div>
              <div className="text-3xl font-bold tracking-tight text-white leading-none tabular-nums">
                {heroDisplay}
              </div>
              <div className="flex items-end justify-between mt-4">
                <div>
                  {heroSource && (
                    <>
                      <div className="text-[10px] text-orange-100/70 uppercase tracking-wide">Source</div>
                      <div className="text-base font-bold text-white leading-tight">{heroSource}</div>
                    </>
                  )}
                </div>
                {heroBadge && (
                  <span className="bg-white/20 text-white text-xs font-medium rounded-full px-3 py-1">
                    {heroBadge}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Import Cash Drawer button ── */}
          {canImport && (
            <button
              onClick={() => setImportSheetOpen(true)}
              className="w-full bg-white rounded-2xl shadow-sm px-4 py-3.5 text-sm font-medium text-orange-600 text-left flex items-center justify-between"
            >
              <span>Import Cash Drawer</span>
              <span className="text-gray-300">›</span>
            </button>
          )}

          {/* ── Drawer Session ── */}
          <div className="bg-white rounded-2xl shadow-sm px-4">
            <SectionTitle
              label="Drawer Session"
              action={
                canImport && activeSession ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-[11px] text-red-400 font-medium"
                  >
                    Delete session
                  </button>
                ) : undefined
              }
            />
            {activeSession ? (
              <>
                <Row label="Business Date" value={fmtDate(activeSession.businessDate)} />
                <Row label="Counter"       value={activeSession.counter} />
                <Row label="Status"        value={activeSession.closeTime ? 'Closed' : 'Open'} />
                <Row label="Opened By"     value={activeSession.openedBy ?? '—'} dim={!activeSession.openedBy} />
                <Row label="Closed By"     value={activeSession.closedBy ?? '—'} dim={!activeSession.closedBy} />
                <Row label="Open Time"     value={fmtTime(activeSession.openTime)}  dim={!activeSession.openTime} />
                <Row label="Close Time"    value={fmtTime(activeSession.closeTime)} dim={!activeSession.closeTime} noBorder />
              </>
            ) : (
              <EmptyState message="No session imported for today." />
            )}
            <div className="pb-2" />
          </div>

          {/* ── Cash Summary ── */}
          <div className="bg-white rounded-2xl shadow-sm px-4">
            <SectionTitle label="Cash Summary" />
            <Row label="Opening Float" value={activeSession?.openingFloat != null ? fmtAmount(activeSession.openingFloat) : '—'} dim={!activeSession?.openingFloat} />
            <Row label="Cash Sales"    value={activeSession?.cashSales != null ? fmtAmount(activeSession.cashSales) : (feedMeCashSales != null ? fmtAmount(feedMeCashSales) : '—')} dim={activeSession?.cashSales == null && feedMeCashSales == null} />
            <Row label="Pay In"        value={activeSession?.payIn    != null ? fmtAmount(activeSession.payIn)    : '—'} dim={!activeSession?.payIn} />
            <Row label="Pay Out"       value={activeSession?.payOut   != null ? fmtAmount(activeSession.payOut)   : '—'} dim={!activeSession?.payOut} />
            <Row label="Closing Float" value={activeSession?.closingFloat != null ? fmtAmount(activeSession.closingFloat) : '—'} dim={!activeSession?.closingFloat} />
            <div className="h-px bg-gray-100 -mx-4 my-1" />
            <Row
              label="Expected Cash"
              value={activeSession ? (computeCurrentCash(activeSession) != null ? fmtAmount(computeCurrentCash(activeSession)!) : '—') : '—'}
              highlight={activeSession !== null && computeCurrentCash(activeSession) !== null}
              noBorder
            />
            <div className="pb-2" />
          </div>

          {/* ── Payments ── */}
          <div className="bg-white rounded-2xl shadow-sm px-4">
            <SectionTitle label="Payments" />
            {activeSession ? (
              <>
                {sessionPayments.map((p, i) => (
                  <Row key={p.label} label={p.label} value={p.value} noBorder={i === sessionPayments.length - 1} />
                ))}
              </>
            ) : feedMePayments && feedMePayments.length > 0 ? (
              <>
                {feedMePayments.map((p, i) => (
                  <Row key={p.method} label={methodLabel(p.method)} value={fmtAmount(p.amount)} noBorder={i === feedMePayments.length - 1} />
                ))}
              </>
            ) : (
              <EmptyState message="Payment breakdown not available." />
            )}
            <div className="pb-2" />
          </div>

          {/* ── Cash Adjustments ── */}
          <div className="bg-white rounded-2xl shadow-sm px-4">
            <SectionTitle
              label="Cash Adjustments"
              action={
                canAdjust ? (
                  <button
                    onClick={() => setAddAdjSheetOpen(true)}
                    className="text-[11px] font-medium text-orange-500"
                  >
                    + Add
                  </button>
                ) : undefined
              }
            />
            <div className="text-[11px] text-gray-400 pb-2">
              Tracked for visibility — not included in drawer balance
            </div>
            {adjustments.length === 0 ? (
              <EmptyState message="No adjustments today." />
            ) : (
              adjustments.map((adj, i) => (
                <div
                  key={adj.id}
                  className={`flex items-center justify-between py-2.5 ${i < adjustments.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AdjTypeBadge type={adj.adjustmentType} />
                    <div className="text-sm text-gray-700 truncate">
                      {adj.referenceNo ? `Ref #${adj.referenceNo}` : adj.category ?? adj.note ?? '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium text-gray-700 tabular-nums">
                      -{fmtAmount(adj.amount)}
                    </span>
                    {canAdjust && (
                      <button
                        onClick={() => handleSoftDeleteAdjustment(adj.id)}
                        className="text-gray-300 hover:text-red-400 text-base leading-none px-1"
                        aria-label="Remove adjustment"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
            <div className="pb-2" />
          </div>

        </div>

        {/* ── Delete Session Confirm Dialog ── */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 pb-8 px-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3">
              <div className="font-semibold text-gray-900">Delete this session?</div>
              <div className="text-sm text-gray-500">
                This will permanently remove the imported FeedMe data for {activeSession?.counter} on {activeSession ? fmtDate(activeSession.businessDate) : ''}. You can re-import it afterwards.
              </div>
              {deleteError && <div className="text-sm text-red-500">{deleteError}</div>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteError(null) }}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSession}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </PageTransition>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: 0 errors. (`importSheetOpen` and `addAdjSheetOpen` are used but the sheets don't exist yet — that's fine since they're referenced only as state, not as components yet.)

- [ ] **Step 3: Commit tasks 5 + 6 together**

```bash
git add app/cashier/page.tsx app/cashier/CashierClient.tsx
git commit -m "feat(cash-drawer): wire page.tsx and CashierClient with sessions, adjustments, hero card"
```

---

## Task 7: `ImportSessionSheet.tsx`

**Files:**
- Create: `app/cashier/ImportSessionSheet.tsx`

- [ ] **Step 1: Create the file**

```tsx
// app/cashier/ImportSessionSheet.tsx
'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { importCashDrawerSessionAction } from './actions'
import type { ImportSessionInput } from '@/lib/cashDrawer/types'

type Step = 1 | 2 | 3 | 4 | 5

type FormState = {
  businessDate: string
  counter: string
  outletName: string
  openTime: string
  closeTime: string
  openedBy: string
  closedBy: string
  openingFloat: string
  closingFloat: string
  cashSales: string
  payIn: string
  payOut: string
  alipay: string
  duitnow: string
  maybankQr: string
  touchngo: string
  wechat: string
}

function today(): string {
  // YYYY-MM-DD in Asia/Kuching
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuching', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function emptyForm(): FormState {
  return {
    businessDate: today(),
    counter: '',
    outletName: '文心砂锅',
    openTime: '', closeTime: '', openedBy: '', closedBy: '',
    openingFloat: '', closingFloat: '',
    cashSales: '', payIn: '', payOut: '',
    alipay: '', duitnow: '', maybankQr: '', touchngo: '', wechat: '',
  }
}

function parseNum(s: string): number | null {
  const v = parseFloat(s.trim())
  return isNaN(v) ? null : v
}

function buildInput(f: FormState): ImportSessionInput {
  return {
    businessDate: f.businessDate,
    counter:      f.counter.trim(),
    outletName:   f.outletName.trim() || null,
    openTime:     f.openTime  ? new Date(f.openTime).toISOString()  : null,
    closeTime:    f.closeTime ? new Date(f.closeTime).toISOString() : null,
    openedBy:     f.openedBy.trim()  || null,
    closedBy:     f.closedBy.trim()  || null,
    openingFloat: parseNum(f.openingFloat),
    closingFloat: parseNum(f.closingFloat),
    cashSales:    parseNum(f.cashSales),
    payIn:        parseNum(f.payIn),
    payOut:       parseNum(f.payOut),
    alipay:       parseNum(f.alipay),
    duitnow:      parseNum(f.duitnow),
    maybankQr:    parseNum(f.maybankQr),
    touchngo:     parseNum(f.touchngo),
    wechat:       parseNum(f.wechat),
  }
}

function expectedCash(f: FormState): string {
  const of_ = parseNum(f.openingFloat)
  const cs  = parseNum(f.cashSales)
  const pi  = parseNum(f.payIn)
  const po  = parseNum(f.payOut)
  if (of_ == null || cs == null || pi == null || po == null) return '—'
  const v = of_ + cs + pi - po
  return `RM ${v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
}

export default function ImportSessionSheet({ isOpen, onClose, onImported }: Props) {
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setForm(emptyForm())
      setError(null)
    }
  }, [isOpen])

  function set(key: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleImport() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const result = await importCashDrawerSessionAction(buildInput(form))
    if (result.ok) {
      onImported()
      onClose()
    } else {
      setError(result.error)
      setSubmitting(false)
    }
  }

  if (!mounted || !isOpen) return null

  const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400'
  const labelClass = 'block text-xs text-gray-500 mb-1'

  const stepTitles: Record<Step, string> = {
    1: 'Business Date',
    2: 'Drawer Session',
    3: 'Payment Summary',
    4: 'Review',
    5: 'Import',
  }

  const content = (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Sheet Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <button onClick={onClose} className="text-sm text-gray-500">Cancel</button>
        <span className="font-semibold text-sm">Import Cash Drawer</span>
        <span className="text-xs text-gray-400">Step {step}/5</span>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1 px-4 pt-3">
        {([1,2,3,4,5] as Step[]).map(s => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-orange-400' : 'bg-gray-100'}`}
          />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="text-base font-semibold text-gray-900 mb-4">{stepTitles[step]}</div>

        {/* Step 1: Business Date */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Business Date</label>
              <input type="date" value={form.businessDate} onChange={e => set('businessDate', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Counter</label>
              <input type="text" placeholder="e.g. Counter 1" value={form.counter} onChange={e => set('counter', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Outlet Name</label>
              <input type="text" value={form.outletName} onChange={e => set('outletName', e.target.value)} className={inputClass} />
            </div>
          </div>
        )}

        {/* Step 2: Drawer Session */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Open Time</label>
                <input type="datetime-local" value={form.openTime} onChange={e => set('openTime', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Close Time</label>
                <input type="datetime-local" value={form.closeTime} onChange={e => set('closeTime', e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Opened By</label>
                <input type="text" value={form.openedBy} onChange={e => set('openedBy', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Closed By</label>
                <input type="text" value={form.closedBy} onChange={e => set('closedBy', e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Opening Float (RM)</label>
                <input type="number" inputMode="decimal" step="0.01" value={form.openingFloat} onChange={e => set('openingFloat', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Closing Float (RM)</label>
                <input type="number" inputMode="decimal" step="0.01" value={form.closingFloat} onChange={e => set('closingFloat', e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Payment Summary */}
        {step === 3 && (
          <div className="space-y-4">
            {[
              { key: 'cashSales' as const,  label: 'Cash Sales (RM)' },
              { key: 'payIn' as const,       label: 'Pay In (RM)' },
              { key: 'payOut' as const,      label: 'Pay Out (RM)' },
              { key: 'alipay' as const,      label: 'Alipay (RM)' },
              { key: 'duitnow' as const,     label: 'DuitNow (RM)' },
              { key: 'maybankQr' as const,   label: 'Maybank QR (RM)' },
              { key: 'touchngo' as const,    label: "Touch'n Go (RM)" },
              { key: 'wechat' as const,      label: 'WeChat (RM)' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className={labelClass}>{label} <span className="text-gray-300">(optional)</span></label>
                <input type="number" inputMode="decimal" step="0.01" value={form[key]} onChange={e => set(key, e.target.value)} className={inputClass} />
              </div>
            ))}
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-2">Business Date</div>
              <ReviewRow label="Date"        value={form.businessDate} onEdit={() => setStep(1)} />
              <ReviewRow label="Counter"     value={form.counter || '—'} onEdit={() => setStep(1)} />
              <ReviewRow label="Outlet"      value={form.outletName || '—'} onEdit={() => setStep(1)} />
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-2">Drawer Session</div>
              <ReviewRow label="Open Time"     value={form.openTime  ? new Date(form.openTime).toLocaleString('en-MY')  : '—'} onEdit={() => setStep(2)} />
              <ReviewRow label="Close Time"    value={form.closeTime ? new Date(form.closeTime).toLocaleString('en-MY') : '—'} onEdit={() => setStep(2)} />
              <ReviewRow label="Opened By"     value={form.openedBy  || '—'} onEdit={() => setStep(2)} />
              <ReviewRow label="Closed By"     value={form.closedBy  || '—'} onEdit={() => setStep(2)} />
              <ReviewRow label="Opening Float" value={form.openingFloat ? `RM ${form.openingFloat}` : '—'} onEdit={() => setStep(2)} />
              <ReviewRow label="Closing Float" value={form.closingFloat ? `RM ${form.closingFloat}` : '—'} onEdit={() => setStep(2)} />
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-2">Payments</div>
              <ReviewRow label="Cash Sales"   value={form.cashSales  ? `RM ${form.cashSales}`  : '—'} onEdit={() => setStep(3)} />
              <ReviewRow label="Pay In"       value={form.payIn      ? `RM ${form.payIn}`      : '—'} onEdit={() => setStep(3)} />
              <ReviewRow label="Pay Out"      value={form.payOut     ? `RM ${form.payOut}`     : '—'} onEdit={() => setStep(3)} />
              <ReviewRow label="Alipay"       value={form.alipay     ? `RM ${form.alipay}`     : '—'} onEdit={() => setStep(3)} />
              <ReviewRow label="DuitNow"      value={form.duitnow    ? `RM ${form.duitnow}`    : '—'} onEdit={() => setStep(3)} />
              <ReviewRow label="Maybank QR"   value={form.maybankQr  ? `RM ${form.maybankQr}`  : '—'} onEdit={() => setStep(3)} />
              <ReviewRow label="Touch'n Go"   value={form.touchngo   ? `RM ${form.touchngo}`   : '—'} onEdit={() => setStep(3)} />
              <ReviewRow label="WeChat"       value={form.wechat     ? `RM ${form.wechat}`     : '—'} onEdit={() => setStep(3)} />
            </div>
            <div className="bg-orange-50 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">Expected Cash</span>
                <span className="text-sm font-semibold text-gray-800 tabular-nums">{expectedCash(form)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Import */}
        {step === 5 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              All values have been reviewed. Tap Import to save this Cash Drawer session for {form.businessDate} / {form.counter}.
            </p>
            {error && (
              <div className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</div>
            )}
            <button
              onClick={handleImport}
              disabled={submitting}
              className="w-full bg-orange-500 text-white font-semibold py-3.5 rounded-2xl disabled:opacity-50"
            >
              {submitting ? 'Importing…' : 'Import'}
            </button>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      {step < 5 && (
        <div className="px-4 pb-8 pt-3 flex gap-3 border-t border-gray-50">
          {step > 1 && (
            <button
              onClick={() => setStep(s => (s - 1) as Step)}
              className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-medium text-gray-600"
            >
              Back
            </button>
          )}
          <button
            onClick={() => {
              if (step === 1 && !form.counter.trim()) return
              setStep(s => (s + 1) as Step)
            }}
            className="flex-1 py-3 rounded-2xl bg-orange-500 text-white text-sm font-semibold disabled:opacity-50"
          >
            {step === 4 ? 'Confirm' : 'Next'}
          </button>
        </div>
      )}
    </div>
  )

  return createPortal(content, document.body)
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-800 tabular-nums">{value}</span>
        <button onClick={onEdit} className="text-[10px] text-orange-500 font-medium">Edit</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/cashier/ImportSessionSheet.tsx
git commit -m "feat(cash-drawer): add 5-step ImportSessionSheet wizard"
```

---

## Task 8: `AddAdjustmentSheet.tsx`

**Files:**
- Create: `app/cashier/AddAdjustmentSheet.tsx`

- [ ] **Step 1: Create the file**

```tsx
// app/cashier/AddAdjustmentSheet.tsx
'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createCashAdjustmentAction } from './actions'

type Tab = 'coupon' | 'pay_out'

type Props = {
  isOpen: boolean
  businessDate: string
  sessionId: number | null
  onClose: () => void
  onSaved: () => void
}

export default function AddAdjustmentSheet({ isOpen, businessDate, sessionId, onClose, onSaved }: Props) {
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<Tab>('coupon')
  const [amount, setAmount] = useState('')
  const [quantity, setQuantity] = useState('')
  const [referenceNo, setReferenceNo] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (isOpen) {
      setTab('coupon')
      setAmount('')
      setQuantity('')
      setReferenceNo('')
      setCategory('')
      setNote('')
      setError(null)
    }
  }, [isOpen])

  async function handleSubmit() {
    if (submitting) return
    const parsedAmount = parseFloat(amount.trim())
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be greater than zero')
      return
    }
    setSubmitting(true)
    setError(null)

    const result = await createCashAdjustmentAction({
      businessDate,
      sessionId,
      adjustmentType: tab,
      amount:         parsedAmount,
      quantity:       tab === 'coupon' && quantity.trim() ? parseInt(quantity.trim(), 10) : null,
      referenceNo:    tab === 'coupon' && referenceNo.trim() ? referenceNo.trim() : null,
      category:       tab === 'pay_out' && category.trim() ? category.trim() : null,
      note:           note.trim() || null,
    })

    if (result.ok) {
      onSaved()
      onClose()
    } else {
      setError(result.error)
      setSubmitting(false)
    }
  }

  if (!mounted || !isOpen) return null

  const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400'
  const labelClass = 'block text-xs text-gray-500 mb-1'

  const content = (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
      <div className="bg-white rounded-t-3xl overflow-hidden">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-semibold text-base">Add Adjustment</span>
          <button onClick={onClose} className="text-sm text-gray-400">Cancel</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 pb-3">
          {(['coupon', 'pay_out'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === t ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {t === 'coupon' ? 'Coupon' : 'Pay Out'}
            </button>
          ))}
        </div>

        <div className="px-4 pb-2 space-y-4">
          {/* Date (read-only) */}
          <div className="text-xs text-gray-400">
            Date: <span className="font-medium text-gray-600">{businessDate}</span>
          </div>

          {/* Amount */}
          <div>
            <label className={labelClass}>Amount (RM) *</label>
            <input
              type="number" inputMode="decimal" step="0.01" placeholder="0.00"
              value={amount} onChange={e => setAmount(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Coupon-specific fields */}
          {tab === 'coupon' && (
            <>
              <div>
                <label className={labelClass}>Quantity <span className="text-gray-300">(optional)</span></label>
                <input type="number" inputMode="numeric" placeholder="Number of coupons" value={quantity} onChange={e => setQuantity(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Reference No <span className="text-gray-300">(optional)</span></label>
                <input type="text" placeholder="Coupon number / batch" value={referenceNo} onChange={e => setReferenceNo(e.target.value)} className={inputClass} />
              </div>
            </>
          )}

          {/* Pay Out-specific fields */}
          {tab === 'pay_out' && (
            <div>
              <label className={labelClass}>Category <span className="text-gray-300">(optional)</span></label>
              <input type="text" placeholder="e.g. Supplies, Petty cash" value={category} onChange={e => setCategory(e.target.value)} className={inputClass} />
            </div>
          )}

          {/* Note (both tabs) */}
          <div>
            <label className={labelClass}>Note <span className="text-gray-300">(optional)</span></label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} className={inputClass} />
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-orange-500 text-white font-semibold py-3.5 rounded-2xl disabled:opacity-50 mb-2"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* Safe area */}
        <div className="pb-6" />
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/cashier/AddAdjustmentSheet.tsx
git commit -m "feat(cash-drawer): add AddAdjustmentSheet for Coupon and Pay Out"
```

---

## Task 9: Wire Sheets into `CashierClient`

**Files:**
- Modify: `app/cashier/CashierClient.tsx`

Add imports for both sheets and replace the `setImportSheetOpen` / `setAddAdjSheetOpen` stubs with real sheet renders.

- [ ] **Step 1: Add imports at top of CashierClient.tsx**

After the existing imports, add:
```tsx
import ImportSessionSheet from './ImportSessionSheet'
import AddAdjustmentSheet from './AddAdjustmentSheet'
```

- [ ] **Step 2: Add sheet renders at bottom of the component, before the closing `</main>`**

Locate the delete confirm dialog block (near end of the component) and after it, add:

```tsx
        {/* ── Import Session Sheet ── */}
        <ImportSessionSheet
          isOpen={importSheetOpen}
          onClose={() => setImportSheetOpen(false)}
          onImported={() => router.refresh()}
        />

        {/* ── Add Adjustment Sheet ── */}
        <AddAdjustmentSheet
          isOpen={addAdjSheetOpen}
          businessDate={businessDate}
          sessionId={activeSession?.id ?? null}
          onClose={() => setAddAdjSheetOpen(false)}
          onSaved={() => router.refresh()}
        />
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/cashier/CashierClient.tsx
git commit -m "feat(cash-drawer): wire ImportSessionSheet and AddAdjustmentSheet into CashierClient"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Full typecheck**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 2: Run DB smoke tests**

```bash
node scripts/test-cash-drawer.mjs
```
Expected: 4 passed, 0 failed.

- [ ] **Step 3: Start dev server and test the golden path**

```bash
npm run dev
```

Test as owner role:
1. Navigate to `/cashier`
2. Verify Hero Card shows "Cash Sales Today" with FeedMe relay data (or `—` if relay is empty)
3. Tap "Import Cash Drawer" — verify 5-step wizard opens
4. Complete all 5 steps with test data, tap Import
5. Verify page refreshes and shows "Current Cash" hero card with the imported session data
6. Verify Drawer Session card populates with imported values
7. Verify Cash Summary shows computed Expected Cash
8. Verify Payments section shows session payment breakdown
9. Tap "+ Add" in Cash Adjustments — add a Coupon and a Pay Out
10. Verify both appear in the Adjustments list with the note "Tracked for visibility — not included in drawer balance"
11. Tap × on an adjustment, verify it disappears on refresh
12. Tap "Delete session", confirm — verify page returns to relay/empty state
13. Test with a manager role: "Import Cash Drawer" button must not appear; "Delete session" link must not appear; adjustments "+ Add" must still appear

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -p  # stage only changed files
git commit -m "fix(cash-drawer): address issues found during manual testing"
```
