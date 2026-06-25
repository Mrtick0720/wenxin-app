# Cash Drawer V1 — Design Specification

**Date:** 2026-06-25  
**Status:** Approved for implementation  
**Scope:** `app/cashier`, `lib/cashDrawer`, `supabase/migrations`

---

## 1. Overview

The Cash Drawer page (`/cashier`) becomes Wenxin's owner-facing cash control module. It answers one question: **what is the current cash situation?**

V1 delivers:
- A `cash_drawer_sessions` table storing FeedMe POS session data (immutable after import).
- A `cash_adjustments` table for Wenxin-managed Coupon and Pay Out records (soft-deleted).
- A 5-step import wizard to bring in a FeedMe Cash Drawer report for any business date.
- Counter-aware display: the page supports multiple POS terminals per day.
- A live "Current Cash" Hero Card computed from session data.
- Coupon and Pay Out entry directly on the Cash Drawer page (V1 core features).

FeedMe data is the source of truth for POS figures. Wenxin owns adjustments only.

---

## 2. Data Model

### 2.1 `cash_drawer_sessions`

One row per business date + counter + outlet. Immutable after import.

```sql
create table public.cash_drawer_sessions (
  id                    bigserial        primary key,
  business_date         date             not null,
  counter               text             not null,
  outlet_id             uuid             not null,
  outlet_name           text,

  -- Timing
  open_time             timestamptz,
  close_time            timestamptz,
  opened_by             text,
  closed_by             text,

  -- Floats
  opening_float         numeric(10,2),
  closing_float         numeric(10,2),

  -- Cash movements
  cash_sales            numeric(10,2),
  pay_in                numeric(10,2),
  pay_out               numeric(10,2),

  -- Digital payments
  alipay                numeric(10,2),
  duitnow               numeric(10,2),
  maybank_qr            numeric(10,2),
  touchngo              numeric(10,2),
  wechat                numeric(10,2),

  -- Source metadata
  source                text             not null default 'manual_import',
  raw_source_payload    jsonb,           -- nullable; preserved for future FeedMe relay debugging
  imported_at           timestamptz,     -- when the FeedMe data was captured (may differ from created_at)
  imported_by           uuid             references auth.users(id),
  created_at            timestamptz      not null default now(),

  constraint cash_drawer_sessions_source_check
    check (source in ('manual_import', 'feedme_relay')),
  constraint cash_drawer_sessions_unique_date_counter_outlet
    unique (business_date, counter, outlet_id)
);
-- No updated_at — immutable by design. UPDATE policy is denied in RLS.
```

**RLS:**

| Operation | Allowed roles |
|-----------|---------------|
| SELECT    | owner, manager |
| INSERT    | owner only |
| UPDATE    | nobody (enforced via no-policy) |
| DELETE    | owner only (re-import correction) |

### 2.2 `cash_adjustments`

Wenxin-managed records. Soft-deleted, never hard-deleted.

```sql
create table public.cash_adjustments (
  id                    bigserial        primary key,
  business_date         date             not null,
  outlet_id             uuid             not null,
  session_id            bigint           references public.cash_drawer_sessions(id) on delete set null,

  adjustment_type       text             not null,
  amount                numeric(10,2)    not null,
  quantity              integer,         -- coupon/voucher count
  reference_no          text,            -- coupon/voucher number
  receipt_url           text,            -- future: Pay Out receipt photo
  category              text,            -- Pay Out reason/category
  note                  text,

  -- Approval workflow (V1: always 'approved'; 'pending_approval' reserved)
  status                text             not null default 'approved',
  approved_by           uuid             references auth.users(id),
  approved_at           timestamptz,

  created_by            uuid             not null references auth.users(id),
  created_at            timestamptz      not null default now(),

  -- Soft delete
  deleted_at            timestamptz,
  deleted_by            uuid             references auth.users(id),

  constraint cash_adjustments_type_check
    check (adjustment_type in ('coupon','voucher','refund','manual_adjustment','pay_out','other')),
  constraint cash_adjustments_status_check
    check (status in ('draft','pending_approval','approved','rejected'))
);
```

**RLS:**

| Operation | Allowed roles | Notes |
|-----------|---------------|-------|
| SELECT    | owner, manager | App filters `deleted_at IS NULL` in queries |
| INSERT    | owner, manager | |
| UPDATE    | owner, manager | Application layer writes only `deleted_at` + `deleted_by`. No other update action exists in V1. A DB trigger enforcing column restriction is deferred to V2. |
| DELETE    | nobody | Hard delete disabled. Soft delete only. |

### 2.3 Derived: Current Cash

Computed at display time from a session row. Never stored.

```
Current Cash = opening_float + cash_sales + pay_in − pay_out
```

If any component is `null`, the result is `null` and displayed as `—`.

---

## 3. Types (`lib/cashDrawer/types.ts`)

```typescript
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
```

---

## 4. Server Actions (`app/cashier/actions.ts`)

```typescript
// ── Session (owner only for write) ───────────────────────────────────────────

fetchCashDrawerSessionsAction(businessDate: string)
  → ActionResult<CashDrawerSession[]>         // all counters for that date

importCashDrawerSessionAction(input: ImportSessionInput)
  → ActionResult<CashDrawerSession>           // requireRole('owner')

deleteCashDrawerSessionAction(id: number)
  → ActionResult<void>                        // requireRole('owner')

// ── Adjustments (owner + manager) ────────────────────────────────────────────

fetchCashAdjustmentsAction(businessDate: string)
  → ActionResult<CashAdjustment[]>            // filters deleted_at IS NULL

createCashAdjustmentAction(input: CreateAdjustmentInput)
  → ActionResult<CashAdjustment>              // requireRole('owner', 'manager')

softDeleteCashAdjustmentAction(id: number)
  → ActionResult<void>                        // requireRole('owner', 'manager')
                                              // writes only { deleted_at, deleted_by }
```

`ImportSessionInput` mirrors all session columns except `id`, `source`, `imported_by`, `created_at`.

---

## 5. Page Data Flow (`app/cashier/page.tsx`)

```
1. requireCurrentStaff() + canViewCashier check
2. businessDate = businessToday()  (default; URL param ?date= for other dates — future)
3. sessions = fetchCashDrawerSessionsAction(businessDate)  → CashDrawerSession[]
4. activeSession = sessions[0] ?? null           (default first counter)
5. If !activeSession:
     relay = readRelayDaily()
     feedMeCashSales = relay?.payments.find(CASH)?.amount ?? null
     feedMePayments  = relay?.payments ?? null
6. adjustments = fetchCashAdjustmentsAction(businessDate)  → CashAdjustment[]
7. canImport = (role === 'owner')
8. canAdjust = (role === 'owner' || role === 'manager')

Pass to CashierClient:
  sessions         CashDrawerSession[]
  activeSession    CashDrawerSession | null
  adjustments      CashAdjustment[]
  feedMeCashSales  number | null
  feedMePayments   Payment[] | null
  businessDate     string
  canImport        boolean
  canAdjust        boolean
```

---

## 6. CashierClient Display Logic

### 6.1 Counter Selector

When `sessions.length > 1`, a small pill-row selector appears above the Drawer Session card:

```
[Counter 1]  [Counter 2]  ...
```

Tapping a pill updates `activeSession` (client state). No re-fetch; all counters are pre-loaded.

### 6.2 Hero Card

| State | Title | Value | Source label | Badge |
|---|---|---|---|---|
| Session + close_time | Current Cash | Opening Float + Cash Sales + Pay In − Pay Out | FeedMe Import | Closed |
| Session, no close_time | Current Cash | same formula | FeedMe Import | Open |
| No session, FeedMe relay | Cash Sales Today | FeedMe CASH amount | FeedMe POS | Live |
| No session, no relay | Cash Sales Today | — | — | (none) |

### 6.3 Import Cash Drawer Button

Visible when `canImport`. Always present (not conditional on date). Placed between Hero Card and Drawer Session section. Label: **Import Cash Drawer**.

### 6.4 Delete Session

Visible when `canImport && activeSession`. A small destructive link in the Drawer Session card header (`Delete session`). Requires a confirmation dialog before calling `deleteCashDrawerSessionAction`.

### 6.5 Cash Summary

```
Opening Float    session.openingFloat   or  —
Cash Sales       session.cashSales      or  feedMeCashSales  or  —
Pay In           session.payIn          or  —
Pay Out          session.payOut         or  —
Closing Float    session.closingFloat   or  —
──────────────────────────────────────────────
Expected Cash    computed               or  —
```

### 6.6 Payments

If session: rows for Cash, Alipay, DuitNow, Maybank QR, Touch'n Go, WeChat — from session columns.  
If no session: FeedMe `payments[]` array with `methodLabel()` display names.

### 6.7 Cash Adjustments (V1 active)

Shows `adjustments` list (Coupon + Pay Out only in V1 UI).  
Header includes an "Add" button (owner + manager, `canAdjust`).

Each row: type badge · amount · reference/note · created time · soft-delete (×).

Empty state: "No adjustments today."

---

## 7. Import Cash Drawer Wizard (`app/cashier/ImportSessionSheet.tsx`)

Five steps, rendered in a bottom sheet (scrollable, full height).

### Step 1 — Business Date
- Date picker (defaults to today; owner can select any past date)
- Counter field (text; the POS terminal identifier from the FeedMe report)
- Outlet Name (pre-filled with default outlet, editable)
- Validation: (business_date, counter) must not already exist — show inline error if duplicate

### Step 2 — Drawer Session
- Open Time (datetime-local)
- Close Time (datetime-local)
- Opened By (text)
- Closed By (text)
- Opening Float (numeric)
- Closing Float (numeric)

### Step 3 — Payment Summary
- Cash Sales (numeric)
- Pay In (numeric)
- Pay Out (numeric)
- Alipay (numeric)
- DuitNow (numeric)
- Maybank QR (numeric)
- Touch'n Go (numeric)
- WeChat (numeric)
- All fields nullable; blank = null stored

### Step 4 — Review
- Read-only summary of all entered values, grouped as above
- "Edit" links jump back to the relevant step
- Computed Expected Cash displayed

### Step 5 — Import
- Single "Import" button
- Calls `importCashDrawerSessionAction`
- On success: sheet closes, `router.refresh()`
- On error: error message shown inline, button re-enabled

Navigation: Back / Next buttons. No data is written until Step 5.

---

## 8. Cash Adjustments (V1: Coupon + Pay Out)

### Add Adjustment Sheet

A simple bottom sheet (`AddAdjustmentSheet.tsx`) with two modes selected via tabs or segment:

**Coupon**
- Amount (numeric, required)
- Quantity (integer, optional) — how many coupons
- Reference No (text, optional) — coupon number / batch
- Note (text, optional)

**Pay Out**
- Amount (numeric, required)
- Category (text, optional) — reason (e.g., "Supplies", "Petty cash")
- Note (text, optional)

Both modes:
- Business Date (pre-filled from current page date, read-only in sheet)
- Linked session_id automatically from `activeSession?.id`

Calls `createCashAdjustmentAction` on submit.

### Adjustment Row Display

```
[Coupon]  -RM 12.00  ×2 · Ref #1042  ·  10:32
[Pay Out] -RM 45.00  Supplies          ·  14:15
```

Amount shown as negative (cash leaves the drawer). Soft-delete via swipe or × button with confirmation.

### Impact on Expected Cash

Expected Cash in the Cash Summary section is NOT adjusted by `cash_adjustments` in V1. Adjustments are tracked separately. Full integration (adjustments affect Expected Cash) is Phase 2.

---

## 9. Permissions Summary

| Action | Owner | Manager | Others |
|---|---|---|---|
| View Cash Drawer page | ✓ | ✓ | ✗ |
| Import Cash Drawer session | ✓ | ✗ | ✗ |
| Delete Cash Drawer session | ✓ | ✗ | ✗ |
| Create adjustment (Coupon, Pay Out) | ✓ | ✓ | ✗ |
| Soft-delete adjustment | ✓ | ✓ | ✗ |

---

## 10. Files

### New

```
supabase/migrations/20260625_cash_drawer.sql
lib/cashDrawer/types.ts
app/cashier/actions.ts
app/cashier/ImportSessionSheet.tsx
app/cashier/AddAdjustmentSheet.tsx
```

### Modified

```
app/cashier/page.tsx          — session fetch, adjustments fetch, canImport/canAdjust
app/cashier/CashierClient.tsx — counter selector, session display, import/delete, adjustments list
```

---

## 11. Future Integration Points

| Item | Trigger |
|---|---|
| Replace manual import with FeedMe relay | Once `cash_drawer` relay kind is available, `source = 'feedme_relay'` rows auto-populate; import wizard becomes secondary |
| Adjustments affect Expected Cash | Phase 2: sum `cash_adjustments` into drawer balance formula |
| Voucher / Refund / Manual Adjustment types | Phase 2: activate in `AddAdjustmentSheet` type selector |
| Adjustment approval workflow | Phase 2: `status = 'pending_approval'` for large amounts; owner approves |
| Actual Cash Count + Variance | Phase 2: owner enters physical count; variance auto-computed |
| Timeline events | Phase 2: derive from session open/close + adjustments created_at |
| URL param `?date=` for historical views | Phase 2 |
