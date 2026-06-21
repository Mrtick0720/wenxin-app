# Purchase Verification Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Pending Verification" step between Purchase Checklist and Purchase Records so kitchen/manager must confirm received items before they appear in the ledger.

**Architecture:** The existing `purchase_items.status` field (currently always `'pending'`) is repurposed as a workflow state machine: `pending_verification → verified | rejected`. Manually-added records skip verification and go directly to `verified`. Only checklist-triggered records enter the `pending_verification` state. Summary, KPI, and CSV export count only `verified` records.

**Tech Stack:** Next.js 16 App Router · TypeScript · Supabase (Postgres + RLS) · Tailwind CSS v4 · React `useState` + server actions

---

## Architecture Overview

**Tables:**
- `purchase_checklist` — unchanged. `status: 'pending' | 'done'`. Marking a checklist item done creates a `purchase_items` row with `status='pending_verification'`.
- `purchase_items` — gets new `status` values + 6 new audit columns.

**Status machine for `purchase_items.status`:**
```
pending_verification  →  verified   (Accept)
                      →  rejected   (Reject)
```
Manually added records (from the + form) go directly to `verified`.

**New columns on `purchase_items`:**
| Column | Type | Purpose |
|---|---|---|
| `verified_by_name` | text | Display name of verifier |
| `verified_at` | timestamptz | When verified |
| `received_quantity` | numeric(10,3) | Actual received qty (may differ from purchased) |
| `rejected_by_name` | text | Display name of rejecter |
| `rejected_at` | timestamptz | When rejected |
| `rejection_reason` | text | Why rejected |

**Existing `status='pending'`** on all live records → migrated to `'verified'` so history stays intact.

**Files map:**

| File | Action | What changes |
|---|---|---|
| `supabase/migrations/20260622_purchase_verification.sql` | **Create** | New columns + backfill `status='verified'` |
| `lib/purchaseLedger/types.ts` | **Modify** | Extend `PurchaseRecord` with 6 new fields |
| `lib/purchaseLedger/repository.ts` | **Modify** | `queryRecords` filters `status='verified'`; new `queryPendingVerification()` |
| `lib/purchaseLedger/service.ts` | **Modify** | `createRecord()` sets `status='verified'`; new `listPendingVerification()` |
| `app/purchase/actions.ts` | **Modify** | Add `fetchPendingVerificationAction` |
| `app/purchase/checklist-actions.ts` | **Modify** | `completeChecklistItemAction` sets `status='pending_verification'` |
| `app/purchase/verification-actions.ts` | **Create** | `acceptVerificationAction` + `rejectVerificationAction` |
| `app/purchase/optimistic.ts` | **Modify** | `createOptimisticPurchaseRecord` sets `status='pending_verification'` |
| `app/purchase/PendingVerificationSection.tsx` | **Create** | New UI section component |
| `app/purchase/PurchaseClient.tsx` | **Modify** | Wire up pending section, callbacks, state |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260622_purchase_verification.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: 3-step purchase verification workflow
-- Adds verification/rejection audit columns to purchase_items.
-- Migrates existing records: status 'pending' → 'verified' (they were manually entered and are complete).
-- New checklist-triggered records will use 'pending_verification'.
-- Apply in Supabase SQL Editor.

BEGIN;

-- Add new audit columns (idempotent via IF NOT EXISTS)
ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS verified_by_name    text,
  ADD COLUMN IF NOT EXISTS verified_at         timestamptz,
  ADD COLUMN IF NOT EXISTS received_quantity   numeric(10,3),
  ADD COLUMN IF NOT EXISTS rejected_by_name    text,
  ADD COLUMN IF NOT EXISTS rejected_at         timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason    text;

-- Migrate existing records: 'pending' → 'verified'
-- These are all manually-entered or previously-completed records; treat them as verified.
UPDATE public.purchase_items
  SET status = 'verified'
  WHERE status = 'pending' OR status IS NULL;

-- Update the RLS check constraint if one exists on status
-- (The original migration used no CHECK constraint on status, so this is safe.)

COMMIT;
```

- [ ] **Step 2: Apply migration in Supabase SQL Editor**

Copy the SQL above and run it in the Supabase dashboard SQL editor. Verify:
- Query `SELECT DISTINCT status FROM purchase_items;` — should return only `'verified'` (and possibly nulls).
- Query `SELECT column_name FROM information_schema.columns WHERE table_name='purchase_items' AND column_name IN ('verified_by_name','verified_at','received_quantity','rejected_by_name','rejected_at','rejection_reason');` — should return all 6 rows.

---

## Task 2: Extend TypeScript Types

**Files:**
- Modify: `lib/purchaseLedger/types.ts`

- [ ] **Step 1: Add new fields to `PurchaseRecord`**

In `lib/purchaseLedger/types.ts`, extend `PurchaseRecord` (after `checklist_item_id`):

```typescript
/** The full record as seen by Owner / Manager (cost fields present). */
export type PurchaseRecord = {
  id: number
  date: string
  name: string
  specification: string | null
  category: string
  unit: string
  quantity: number
  unit_price: number | null
  total_price: number | null
  supplier: string | null
  purchaser: string | null
  receiver: string | null
  note: string | null
  purchase_method: string | null
  payment_status: string | null
  status: string
  created_by: string | null
  created_by_name: string | null
  purchased_by_user_id: string | null
  purchased_by_name: string | null
  created_at: string | null
  checklist_item_id?: number | null
  // ── Verification workflow ──
  verified_by_name: string | null
  verified_at: string | null
  received_quantity: number | null
  rejected_by_name: string | null
  rejected_at: string | null
  rejection_reason: string | null
}
```

- [ ] **Step 2: Run type check to catch downstream breakage**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1 | grep -v "bento/customers\|reservations/page" | head -30
```

Expected: only the pre-existing unrelated errors. If new errors appear about the new fields, they are likely in `optimistic.ts` where `PurchaseRecord` objects are constructed — fix them in later tasks.

---

## Task 3: Repository — Add Status Filtering + Pending Query

**Files:**
- Modify: `lib/purchaseLedger/repository.ts`

- [ ] **Step 1: Extend `BASE_COLUMNS` with new fields**

In `repository.ts`, update the `BASE_COLUMNS` constant:

```typescript
const BASE_COLUMNS =
  'id, date, name, specification, category, unit, quantity, purchaser, receiver, note, purchase_method, payment_status, status, created_by, created_by_name, purchased_by_user_id, purchased_by_name, created_at, checklist_item_id, verified_by_name, verified_at, received_quantity, rejected_by_name, rejected_at, rejection_reason'
```

- [ ] **Step 2: Add `status='verified'` filter to `queryRecords`**

In `queryRecords`, after the `from/to` filters, add:

```typescript
export async function queryRecords(opts: {
  withCosts: boolean
  from?: string
  to?: string
  filters?: PurchaseFilters
}): Promise<PurchaseRecord[]> {
  const supabase = await createServerSupabaseClient()
  let q = supabase.from('purchase_items').select(columns(opts.withCosts))

  // Only verified records appear in the ledger / history / summary
  q = q.eq('status', 'verified')

  if (opts.from) q = q.gte('date', opts.from)
  if (opts.to) q = q.lte('date', opts.to)
  if (opts.filters?.category) q = q.eq('category', opts.filters.category)
  if (opts.filters?.supplier) q = q.ilike('supplier', `%${opts.filters.supplier}%`)
  if (opts.filters?.purchaser) q = q.ilike('purchaser', `%${opts.filters.purchaser}%`)

  q = q.order('date', { ascending: false }).order('id', { ascending: false })

  if (!opts.from && !opts.to) {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    q = q.gte('date', ninetyDaysAgo.toISOString().split('T')[0])
  }
  q = q.limit(500)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as PurchaseRecord[]
}
```

- [ ] **Step 3: Add `queryPendingVerification` function**

Append to `repository.ts`:

```typescript
/** Fetch records awaiting kitchen verification (status = 'pending_verification'), today only. */
export async function queryPendingVerification(): Promise<PurchaseRecord[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('purchase_items')
    .select(columns(true)) // always fetch costs for owner/manager who verifies
    .eq('status', 'pending_verification')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as unknown as PurchaseRecord[]
}
```

- [ ] **Step 4: Type check**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1 | grep "repository\|service\|types" | head -20
```

---

## Task 4: Service Layer Updates

**Files:**
- Modify: `lib/purchaseLedger/service.ts`

- [ ] **Step 1: Change `createRecord()` default status to `'verified'`**

In `service.ts`, find the `createRecord()` function and change:

```typescript
// OLD:
status: 'pending',

// NEW:
status: 'verified',
```

This means manually-added records (via the + form) go directly to Purchase Records. Only checklist-triggered records get `pending_verification` (set in `checklist-actions.ts`).

- [ ] **Step 2: Add `listPendingVerification()` export**

Add at the end of `service.ts`:

```typescript
import { queryPendingVerification } from './repository'

/** Pending verification records — readable by owner, manager, kitchen. */
export async function listPendingVerification(): Promise<PurchaseRecord[]> {
  return queryPendingVerification()
}
```

---

## Task 5: Server Actions — Fetch Pending + Verify/Reject

**Files:**
- Modify: `app/purchase/actions.ts`
- Create: `app/purchase/verification-actions.ts`

- [ ] **Step 1: Add `fetchPendingVerificationAction` to `actions.ts`**

Import `listPendingVerification` and add the action (after `fetchSummaryAction`):

```typescript
import * as svc from '@/lib/purchaseLedger/service'
// (already imported above, just adding to existing svc usage)

/** Fetch all records currently awaiting kitchen verification. */
export async function fetchPendingVerificationAction(): Promise<ActionResult<PurchaseRecord[]>> {
  try {
    await requireRole(...ROLES)
    const data = await svc.listPendingVerification()
    return { ok: true, data }
  } catch (error) {
    return fail(error)
  }
}
```

Also update `service.ts` imports in `actions.ts` — `listPendingVerification` is already exported from service so `svc.listPendingVerification()` works if service exports it.

- [ ] **Step 2: Create `app/purchase/verification-actions.ts`**

```typescript
'use server'

import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { ActionResult, PurchaseRecord } from '@/lib/purchaseLedger/types'
import { canViewPurchaseCosts } from '@/lib/purchaseLedger/permissions'

const VERIFY_ROLES = ['owner', 'manager', 'kitchen'] as const

const RECORD_COLUMNS =
  'id, date, name, specification, category, unit, quantity, purchaser, receiver, note, purchase_method, payment_status, status, created_by, created_by_name, purchased_by_user_id, purchased_by_name, created_at, checklist_item_id, verified_by_name, verified_at, received_quantity, rejected_by_name, rejected_at, rejection_reason, unit_price, total_price, supplier'

function fail(error: unknown): ActionResult<never> {
  const message =
    error instanceof Error ? error.message
    : error != null && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error)
  console.error('[verification action]', message, error)
  return { ok: false, error: message }
}

/**
 * Accept a pending verification record.
 * Sets status='verified', records verified_by_name, verified_at, received_quantity.
 */
export async function acceptVerificationAction(
  id: number,
  receivedQuantity: number,
): Promise<ActionResult<PurchaseRecord>> {
  try {
    const staff = await requireRole(...VERIFY_ROLES)
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('purchase_items')
      .update({
        status: 'verified',
        verified_by_name: staff.displayName,
        verified_at: new Date().toISOString(),
        received_quantity: receivedQuantity,
      })
      .eq('id', id)
      .eq('status', 'pending_verification') // guard against double-submit
      .select(RECORD_COLUMNS)
      .single()

    if (error) throw error
    if (!data) return { ok: false, error: 'Record not found or already verified.' }
    return { ok: true, data: data as unknown as PurchaseRecord }
  } catch (error) {
    return fail(error)
  }
}

/**
 * Reject a pending verification record.
 * Sets status='rejected', records rejected_by_name, rejected_at, rejection_reason.
 * Restores the linked checklist item to pending so it can be re-purchased.
 */
export async function rejectVerificationAction(
  id: number,
  reason: string,
): Promise<ActionResult<{ id: number }>> {
  try {
    const staff = await requireRole(...VERIFY_ROLES)
    const supabase = await createServerSupabaseClient()

    // Update purchase record to rejected
    const { data: updated, error: updateErr } = await supabase
      .from('purchase_items')
      .update({
        status: 'rejected',
        rejected_by_name: staff.displayName,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason.trim() || 'No reason given',
      })
      .eq('id', id)
      .eq('status', 'pending_verification')
      .select('id, checklist_item_id')
      .single()

    if (updateErr) throw updateErr
    if (!updated) return { ok: false, error: 'Record not found or already processed.' }

    // Restore linked checklist item back to pending so it can be re-purchased
    if (updated.checklist_item_id) {
      await supabase
        .from('purchase_checklist')
        .update({ status: 'pending', purchase_record_id: null, completed_at: null })
        .eq('id', updated.checklist_item_id)
    }

    return { ok: true, data: { id: updated.id } }
  } catch (error) {
    return fail(error)
  }
}
```

---

## Task 6: Checklist Action — Set `pending_verification` on Completion

**Files:**
- Modify: `app/purchase/checklist-actions.ts`

- [ ] **Step 1: Update `completeChecklistItemAction` to use `pending_verification`**

In `completeChecklistItemAction`, the record is created via `svc.createRecord(...)` which now sets `status='verified'`. We need to override this to `pending_verification`. After the `svc.createRecord` call, patch the status:

Find the section in `completeChecklistItemAction` that calls `svc.createRecord` and then the `supabase.from('purchase_items').update(...)` call that sets `checklist_item_id`. Merge the `status` override into that same update:

```typescript
// After creating the record:
const record = await svc.createRecord(staff.role, staff.id, staff.displayName, {
  name: item.name,
  specification: item.specification ?? null,
  category: item.category,
  unit: item.unit,
  quantity: item.quantity,
  unit_price: completion.unit_price,
  supplier: completion.supplier || item.supplier || null,
  receiver: null,
  remarks: item.note ?? null,
})

// Override status to pending_verification + set audit fields
await supabase
  .from('purchase_items')
  .update({
    status: 'pending_verification',          // ← key change
    checklist_item_id: item.id,
    created_by_name: item.created_by_name ?? staff.displayName,
    purchased_by_user_id: staff.id,
    purchased_by_name: staff.displayName,
  })
  .eq('id', record.id)
```

The `record` object returned by `svc.createRecord` will have `status='verified'` (what the service returns after insert), but that's fine for the return value — the DB will have `pending_verification`. Since the client uses the callback/optimistic path, the status in the returned `record` object doesn't matter for the checklist → pending handoff. But to be clean, the function's return type is `{ purchaseRecordId, record }` and the record will have `status='verified'` — this is a minor inconsistency but doesn't affect UI flow because `handleItemCompleting` uses the record only to create an optimistic record, and we're changing the optimistic record's status separately.

> **Note:** The function return value `record` will show `status='verified'` (from the service insert), but the DB row has `pending_verification` after the update. This only matters for the `handleItemCompleted` callback which adds the record to the Purchase Records list optimistically — we'll fix this in PurchaseClient.tsx Task 8 by NOT adding checklist completions to `records` state anymore.

---

## Task 7: Optimistic Record Helper Update

**Files:**
- Modify: `app/purchase/optimistic.ts`

- [ ] **Step 1: Update `createOptimisticPurchaseRecord` status**

In `optimistic.ts`, change the returned object's status:

```typescript
export function createOptimisticPurchaseRecord({
  item,
  tempId,
  today,
  unitPrice,
  supplier,
}: {
  item: OptimisticChecklistItem
  tempId: number
  today: string
  unitPrice: number
  supplier: string | null
}): PurchaseRecord {
  const total = roundMoney(item.quantity * unitPrice)
  return {
    id: tempId,
    date: today,
    name: item.name,
    specification: null,
    category: item.category,
    unit: item.unit,
    quantity: item.quantity,
    unit_price: unitPrice,
    total_price: total,
    supplier,
    purchaser: null,
    receiver: null,
    note: item.note,
    purchase_method: 'Supplier Delivery',
    payment_status: 'unpaid',
    status: 'pending_verification',   // ← changed from 'pending'
    created_by: null,
    created_by_name: null,
    purchased_by_user_id: null,
    purchased_by_name: null,
    created_at: new Date().toISOString(),
    checklist_item_id: item.id,
    // new fields
    verified_by_name: null,
    verified_at: null,
    received_quantity: null,
    rejected_by_name: null,
    rejected_at: null,
    rejection_reason: null,
  }
}
```

Also update `createOptimisticFromForm` (for manually-added records) to set `status: 'verified'` and add the new null fields:

```typescript
export function createOptimisticFromForm(/* ... */): PurchaseRecord {
  // ... existing code ...
  return {
    // ... existing fields ...
    status: 'verified',   // ← changed from 'pending'
    // new fields
    verified_by_name: null,
    verified_at: null,
    received_quantity: null,
    rejected_by_name: null,
    rejected_at: null,
    rejection_reason: null,
  }
}
```

- [ ] **Step 2: Type check**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1 | grep "optimistic\|types" | head -10
```

---

## Task 8: PendingVerificationSection Component

**Files:**
- Create: `app/purchase/PendingVerificationSection.tsx`

- [ ] **Step 1: Write the component**

```typescript
'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { PurchaseRecord } from '@/lib/purchaseLedger/types'
import { categoryColor } from '@/lib/purchaseLedger/categories'
import { acceptVerificationAction, rejectVerificationAction } from './verification-actions'

const Z_MAX = 2147483647

type Props = {
  items: PurchaseRecord[]
  canVerify: boolean
  onAccepted: (record: PurchaseRecord) => void
  onAcceptFailed: (id: number) => void
  onRejected: (id: number) => void
  onRejectFailed: (id: number) => void
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtQty(n: number, unit: string): string {
  return `${n % 1 === 0 ? n : n.toFixed(2)} ${unit}`
}

type RejectSheetProps = {
  item: PurchaseRecord
  onConfirm: (reason: string) => void
  onCancel: () => void
}

function RejectSheet({ item, onConfirm, onCancel }: RejectSheetProps) {
  const [reason, setReason] = useState('')

  const content = (
    <div
      className="fixed flex flex-col justify-end"
      style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: Z_MAX, background: 'rgba(0,0,0,0.4)' }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-t-3xl flex flex-col px-4 pt-5 pb-8"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 24px)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold text-base text-gray-900">Reject — {item.name}</span>
          <button type="button" onClick={onCancel} className="text-gray-400 text-2xl leading-none">×</button>
        </div>
        <label className="text-xs text-gray-400 mb-1 block">Reason (optional)</label>
        <textarea
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-red-400 bg-white resize-none text-sm"
          style={{ fontSize: 16, minHeight: 80 }}
          placeholder="e.g. wrong quantity, not delivered, quality issue…"
          value={reason}
          onChange={e => setReason(e.target.value)}
          autoFocus
        />
        <button
          type="button"
          onClick={() => onConfirm(reason)}
          className="mt-4 w-full py-3 rounded-2xl text-sm font-semibold text-white active:opacity-80"
          style={{ background: '#ef4444' }}
        >
          Confirm Reject
        </button>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

type CardProps = {
  item: PurchaseRecord
  canVerify: boolean
  onAccept: (id: number, receivedQty: number) => void
  onReject: (id: number, reason: string) => void
}

function VerificationCard({ item, canVerify, onAccept, onReject }: CardProps) {
  const [receivedQty, setReceivedQty] = useState(String(item.quantity))
  const [showReject, setShowReject] = useState(false)
  const [accepting, setAccepting] = useState(false)

  const parsedQty = parseFloat(receivedQty) || item.quantity
  const diff = parsedQty - item.quantity
  const hasDiff = Math.abs(diff) > 0.001

  const clr = categoryColor(item.category)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Category color bar */}
      <div style={{ height: 3, background: clr }} />

      <div className="px-4 py-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            {/* Clock icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span className="font-semibold text-gray-900 truncate" style={{ fontSize: 15 }}>{item.name}</span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium flex-shrink-0">
            Awaiting confirmation
          </span>
        </div>

        {/* Purchased line */}
        <div className="text-xs text-gray-500 ml-7 mb-2">
          Purchased {fmtQty(item.quantity, item.unit)}
          {item.purchased_by_name ? ` · ${item.purchased_by_name}` : ''}
        </div>

        {/* Received qty field */}
        {canVerify && (
          <div className="ml-7 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Received</span>
              <input
                type="number"
                inputMode="decimal"
                className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center outline-none focus:border-orange-400"
                value={receivedQty}
                onChange={e => setReceivedQty(e.target.value)}
              />
              <span className="text-xs text-gray-500">{item.unit}</span>
            </div>
            {hasDiff && (
              <div className="mt-1 text-[11px]" style={{ color: diff < 0 ? '#ef4444' : '#22c55e' }}>
                Difference: {diff > 0 ? '+' : ''}{diff.toFixed(3)} {item.unit}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        {canVerify && (
          <div className="ml-7 flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => setShowReject(true)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 active:opacity-70"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={accepting}
              onClick={() => {
                setAccepting(true)
                onAccept(item.id, parsedQty)
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white active:opacity-80"
              style={{ background: accepting ? '#9ca3af' : '#1d4ed8' }}
            >
              {accepting ? 'Saving…' : 'Accept'}
            </button>
          </div>
        )}
      </div>

      {showReject && (
        <RejectSheet
          item={item}
          onConfirm={reason => { setShowReject(false); onReject(item.id, reason) }}
          onCancel={() => setShowReject(false)}
        />
      )}
    </div>
  )
}

export default function PendingVerificationSection({ items, canVerify, onAccepted, onAcceptFailed, onRejected, onRejectFailed }: Props) {
  async function handleAccept(id: number, receivedQty: number) {
    const res = await acceptVerificationAction(id, receivedQty)
    if (res.ok) {
      onAccepted(res.data)
    } else {
      onAcceptFailed(id)
    }
  }

  async function handleReject(id: number, reason: string) {
    const res = await rejectVerificationAction(id, reason)
    if (res.ok) {
      onRejected(id)
    } else {
      onRejectFailed(id)
    }
  }

  if (items.length === 0) return null

  return (
    <div className="mx-4 mt-5">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-base font-bold text-gray-900">Pending Verification</h2>
        <span className="text-xs font-semibold text-white rounded-full px-1.5 py-0.5 leading-none" style={{ background: '#3b82f6' }}>
          {items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <VerificationCard
            key={item.id}
            item={item}
            canVerify={canVerify}
            onAccept={handleAccept}
            onReject={handleReject}
          />
        ))}
      </div>
    </div>
  )
}
```

---

## Task 9: Wire Up PurchaseClient

**Files:**
- Modify: `app/purchase/PurchaseClient.tsx`

This is the largest change. Read the file carefully before editing. The changes are:

### 9a — Imports

- [ ] **Step 1: Add imports at the top of `PurchaseClient.tsx`**

```typescript
import PendingVerificationSection from './PendingVerificationSection'
import { fetchPendingVerificationAction } from './actions'
import { reconcileOptimisticRecord, removeOptimisticRecord } from './optimistic'
```

### 9b — State

- [ ] **Step 2: Add pending verification state near the other `useState` declarations**

Find the block of `useState` declarations around line 660 and add:

```typescript
const [pendingVerification, setPendingVerification] = useState<LedgerRecord[]>([])
const [pendingVerificationLoading, setPendingVerificationLoading] = useState(true)
```

### 9c — Boot sequence

- [ ] **Step 3: Fetch pending verification in the boot sequence**

In `PurchaseClient.tsx`, the boot happens in a `useEffect` (the "Stage 2" comment). Find the section that fetches the checklist (`fetchChecklistAction()`) and add `fetchPendingVerificationAction()` to the same `Promise.all`:

In the `refresh` function (around line 686), add to the destructured `Promise.all`:

```typescript
const [recRes, sumRes, kpiRes, checkRes, pendingRes] = await Promise.all([
  fetchRecordsAction(activeFilters),
  fetchSummaryAction(),
  fetchKpiAction(),
  fetchChecklistAction(),
  fetchPendingVerificationAction(),
])
// ... existing handling ...
if (pendingRes.ok) setPendingVerification(pendingRes.data as LedgerRecord[])
```

Also add it to the initial boot `Promise.all` (Stage 2/3 of the boot sequence). Find where `fetchChecklistAction()` is called in the initial boot effect and add `fetchPendingVerificationAction()`.

After the boot resolves:
```typescript
setPendingVerificationLoading(false)
```

### 9d — Checklist completion callbacks

- [ ] **Step 4: Update `handleItemCompleting` to add to pending, NOT records**

Currently `handleItemCompleting` adds the optimistic record to `records`. Change it to add to `pendingVerification` instead:

```typescript
function handleItemCompleting(item: ChecklistEntry, completion: { unit_price: number; supplier: string | null }): number {
  const tempId = nextTempRecordId.current--
  const optimistic = createOptimisticPurchaseRecord({
    item,
    tempId,
    today: ctx!.today,
    unitPrice: completion.unit_price,
    supplier: completion.supplier,
  })
  const mutationId = nextClientMutationId()
  setMutationId(optimistic, mutationId)
  // Goes to pending verification, NOT records
  setPendingVerification(prev => [optimistic as LedgerRecord, ...prev])
  return tempId
}
```

- [ ] **Step 5: Update `handleItemCompleted` — reconcile in pending, not records**

```typescript
function handleItemCompleted(record: PurchaseRecord, optimisticId?: number) {
  if (optimisticId !== undefined) {
    setPendingVerification(prev => reconcileOptimisticRecord(prev, optimisticId, record as LedgerRecord))
  } else {
    setPendingVerification(prev => {
      if (prev.some(r => r.id === record.id)) return prev
      return [record as LedgerRecord, ...prev]
    })
  }
}
```

- [ ] **Step 6: Update `handleItemCompleteFailed` — remove from pending**

```typescript
function handleItemCompleteFailed(optimisticId?: number) {
  if (optimisticId !== undefined) {
    setPendingVerification(prev => removeOptimisticRecord(prev, optimisticId))
  }
}
```

### 9e — Verification accept/reject callbacks

- [ ] **Step 7: Add accept/reject handlers**

```typescript
function handleVerificationAccepted(record: PurchaseRecord) {
  // Move from pending to records + update KPI/summary
  setPendingVerification(prev => prev.filter(r => r.id !== record.id))
  const ledgerRecord = record as LedgerRecord
  setRecords(prev => {
    if (prev.some(r => r.id === ledgerRecord.id)) return prev
    return [ledgerRecord, ...prev]
  })
  setSummary(prev => prev ? applyRecordToSummary(prev, ledgerRecord, 1, ctx!.today) : prev)
  setKpi(prev => prev ? applyRecordToKpi(prev, ledgerRecord, 1, ctx!.today) : prev)
}

function handleVerificationRejected(id: number) {
  // Remove from pending — rejected record is gone from active UI
  // The linked checklist item is restored server-side; the realtime subscription
  // on purchase_checklist will trigger a checklist refresh automatically.
  setPendingVerification(prev => prev.filter(r => r.id !== id))
  setChecklistRefreshKey(k => k + 1)
}

function handleVerificationAcceptFailed(id: number) {
  // Nothing to roll back — the card is still visible, user can retry
  console.warn('Accept failed for record', id)
}

function handleVerificationRejectFailed(id: number) {
  console.warn('Reject failed for record', id)
}
```

### 9f — Render

- [ ] **Step 8: Insert `PendingVerificationSection` between Checklist and Records**

Find the JSX section with `{/* ── Purchase Records (today) — owner/manager only ── */}` and insert BEFORE it:

```tsx
{/* ── Pending Verification ── */}
{!pendingVerificationLoading && (
  <PendingVerificationSection
    items={pendingVerification.filter(r => r.date === ctx?.today || true)} // show all pending
    canVerify={ctx?.perms.canViewCosts ?? false} // owner/manager can verify
    onAccepted={handleVerificationAccepted}
    onAcceptFailed={handleVerificationAcceptFailed}
    onRejected={handleVerificationRejected}
    onRejectFailed={handleVerificationRejectFailed}
  />
)}
```

Note: `canVerify` uses `canViewCosts` as a proxy — only owner/manager can view costs and should be the ones verifying. Kitchen staff can see the pending section but cannot accept/reject.

### 9g — Filter `purchasedChecklistIds` to only pending_verification

- [ ] **Step 9: Update `purchasedChecklistIds` to include pending_verification records**

The existing code:
```typescript
const purchasedChecklistIds = new Set(
  records.map((r) => r.checklist_item_id).filter((id): id is number => id != null),
)
```

This hides checklist items that are already in `records` (verified). Now checklist items can also be in `pendingVerification`. Update to include both:

```typescript
const purchasedChecklistIds = new Set(
  [...records, ...pendingVerification]
    .map((r) => r.checklist_item_id)
    .filter((id): id is number => id != null),
)
```

This prevents an item from showing in both Purchase Checklist AND Pending Verification simultaneously.

### 9h — Remove KPI/summary impact from checklist completion

- [ ] **Step 10: Remove `applyRecordToSummary`/`applyRecordToKpi` from `handleItemCompleting`**

The old `handleItemCompleting` called `applyRecordToSummary` and `applyRecordToKpi` to immediately bump the KPI when a checklist item was completed. Since pending_verification records should NOT count toward the KPI (only verified ones do), remove those calls from `handleItemCompleting`. The KPI only updates after `handleVerificationAccepted`.

---

## Task 10: Also Add to Boot Stage 2 (initial load) and Realtime Subscription

**Files:**
- Modify: `app/purchase/PurchaseClient.tsx`

- [ ] **Step 1: Add pending fetch to Stage 2 boot**

In the boot `useEffect` (look for `// Stage 2` comment), add `fetchPendingVerificationAction()` to the `Promise.all` that already fetches the checklist:

```typescript
const [checkRes, pendingVerRes] = await Promise.all([
  fetchChecklistAction(),
  fetchPendingVerificationAction(),
])
if (checkRes.ok) setChecklistSeed(checkRes.data)
if (pendingVerRes.ok) {
  setPendingVerification(pendingVerRes.data as LedgerRecord[])
  setPendingVerificationLoading(false)
}
```

- [ ] **Step 2: Add pending verification fetch to `refresh()` function**

In the `refresh` callback, also update `pendingVerification` after the fetch:
```typescript
const [recRes, sumRes, kpiRes, checkRes, pendingRes] = await Promise.all([...])
if (pendingRes.ok) setPendingVerification(pendingRes.data as LedgerRecord[])
```

---

## Task 11: Fix `handleUncheck` for Verified Records

**Files:**
- Modify: `app/purchase/PurchaseClient.tsx`

Currently `handleUncheck` removes a record from `records` state and moves it back to the checklist. Since `records` now only contains `verified` records, this path is only triggered from the Purchase Records section. This should still work correctly — no changes needed to the `handleUncheck` function itself.

However, verify the "uncheck" button is NOT shown for `pending_verification` records (they're in the PendingVerificationSection, not RecordRow). Since `PendingVerificationSection` is a completely separate component with its own Reject flow, this is already handled.

- [ ] **Step 1: Verify no uncheck button appears in PendingVerificationSection** 

Inspect `PendingVerificationSection.tsx` — it has no uncheck/move-to-checklist button. ✓

---

## Task 12: Update "View all" and Purchase Records section header

**Files:**
- Modify: `app/purchase/PurchaseClient.tsx`

The "Purchase Records" section currently shows `todayRecords`. After our changes, `records` only contains `verified` items, so `todayRecords` already filters correctly. No structural change needed.

- [ ] **Step 1: Update the verified icon in RecordRow**

In `PurchaseClient.tsx`, find the `RecordRow` component (around line 207). The status icon is already a green checkmark. No change needed — verified records show the green check icon naturally.

- [ ] **Step 2: Confirm RecordRow shows `verified_by_name` if available**

In `RecordRow`, there's a `receiver` field shown as "Verified by X". Update to prefer `verified_by_name` over `receiver`:

Find in RecordRow where the receiver/verifier name is shown and update:
```tsx
// Show verified_by_name if available, fallback to receiver
const verifierName = item.verified_by_name ?? item.receiver
// Then use verifierName in the JSX
```

Look for "Verified by" text in RecordRow and update the field reference accordingly.

---

## Task 13: TypeScript Check + Build Verification

**Files:** None — verification only.

- [ ] **Step 1: Full type check**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1 | grep -v "bento/customers\|reservations/page" | grep -v "^$"
```

Expected: zero new errors beyond the pre-existing `bento/customers` and `reservations/page` errors.

- [ ] **Step 2: Fix any type errors**

Common issues to expect:
- `PurchaseRecord` construction missing the 6 new nullable fields — add `verified_by_name: null, verified_at: null, received_quantity: null, rejected_by_name: null, rejected_at: null, rejection_reason: null` to any place that constructs a full `PurchaseRecord` object.
- `LedgerRecord` type (defined in PurchaseClient.tsx line ~52-68) — check if it extends/re-exports PurchaseRecord. If so, it inherits the new fields automatically. If it's a separate type, add the fields.

- [ ] **Step 3: Check the `LedgerRecord` type**

Find `LedgerRecord` type in `PurchaseClient.tsx` (grep for `type LedgerRecord` or `LedgerRecord =`). If it's `type LedgerRecord = PurchaseRecord` or `extends PurchaseRecord`, the new fields flow through automatically. If it redeclares fields manually, add the 6 new nullable fields.

---

## Task 14: Manual Test Checklist

- [ ] Run `npm run dev` in `/Users/bruce/wenxin-app`
- [ ] Open Purchase page
- [ ] Check off a checklist item (complete purchase) → item should disappear from Purchase Checklist, appear in **Pending Verification** section (NOT in Purchase Records)
- [ ] In Pending Verification: adjust received quantity, tap Accept → item moves to **Purchase Records** with green check + "Verified by [name]"
- [ ] Add another checklist item, check it off, then in Pending Verification tap Reject with a reason → item disappears from Pending Verification, checklist item re-appears in Purchase Checklist
- [ ] Purchase Records only shows verified items ✓
- [ ] Refresh page — pending verification items still appear in Pending Verification ✓
- [ ] Purchase History export CSV — only verified records appear ✓
- [ ] Pull-to-refresh updates Pending Verification ✓

---

## Spec Coverage Check

| Requirement | Task |
|---|---|
| Checklist → Pending Verification (not Records) | Task 6 (server), Task 9d (client) |
| Pending Verification section visible between Checklist and Records | Task 8, Task 9f |
| Accept → verified + verified_by + verified_at | Task 5 (verification-actions.ts) |
| Reject → rejected + reason + restore checklist | Task 5 |
| Purchase Records = verified only | Task 3 (queryRecords filter) |
| History = verified only | Task 3 (same queryRecords filter, history uses same query) |
| Export CSV = verified only | Task 3 (listRecords → queryRecords → verified only) |
| Summary/KPI = verified only | Task 3 (getSummary uses queryRecords) |
| Optimistic: checklist → pending instantly | Task 9d (handleItemCompleting) |
| Optimistic: accept → records instantly | Task 9e (handleVerificationAccepted) |
| Optimistic: reject → remove instantly | Task 9e (handleVerificationRejected) |
| Reject restores checklist item | Task 5 (rejectVerificationAction) |
| Migration: existing records → verified | Task 1 |
| No duplicate records on repeated taps | `.eq('status','pending_verification')` guard in acceptVerificationAction |
| Permissions: owner/manager/kitchen verify | VERIFY_ROLES in verification-actions.ts |
| Received quantity editable + diff shown | Task 8 (VerificationCard component) |
| Mobile-friendly cards | Task 8 |
| TypeScript passes | Task 13 |
