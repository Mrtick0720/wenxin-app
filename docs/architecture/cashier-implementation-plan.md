# Cashier Module — Implementation Plan (V1)

> Status: **Plan only**. No code, no migrations, no UI yet. Companion to `cashier-module.md`.
> Hard dependency: the **permission-key layer** (`ROLE_PERMISSIONS` + `hasPermission`) should land first (Phase 0).

## 1. Required Routes

| Route | Purpose | Stack? | Notes |
|---|---|---|---|
| `/cashier` | Shift list / cashier home (S1) | yes (in `stackRoutes`) | replaces current placeholder |
| `/cashier/[id]` | Shift detail / review (S5) | L3 push from list | open/active/close states render here or as sub-views |
| `/cashier/reports` | Cashier reports (S6) | yes | or a tab within `/cashier` |
| `/cashier/settings` | Payment methods & POS (S7) | yes | Owner only; may live under `/settings` later |

Open Shift (S2) / Close Shift (S4) = modals or sub-routes of `/cashier` (decide at UI step). No new top-level nav entry — reached via All Modules + (optionally) dashboard widget.

## 2. Required Placeholder → Real Pages

- `app/cashier/page.tsx` — **exists as placeholder**; becomes S1 (shift list).
- New: `app/cashier/[id]/…` (detail/review), `app/cashier/reports/…`, `app/cashier/settings/…`.
- Register new routes in `app/lib/stackRoutes.tsx`; permission rules already exist for `/cashier` (extend for sub-paths if needed).

## 3. Required Database Tables (V1)

Build (per `cashier-module.md`):
- `cashier_shift`
- `payment_method` (+ seed: cash, tng, alipay, card, other)
- `cashier_payment_line`
- `cashier_adjustment`

Deferred: `cash_denomination` (V1.1), `pos_summary` (future). Add `outlet_id` columns now (single-outlet default) to avoid later migration. RLS by outlet + permission keys.

## 4. Required Permission Keys

Add to `ROLE_PERMISSIONS` (Phase 0):
`VIEW_CASHIER_ALL` · `VIEW_CASHIER_SELF` · `CREATE_CASHIER` · `CLOSE_CASHIER_SELF` · `EDIT_CASHIER` · `APPROVE_CASHIER` · `EXPORT_CASHIER` · `MANAGE_PAYMENT_METHODS` · `MANAGE_POS_INTEGRATION`.
Bundles: Owner=all; Supervisor=ALL/CREATE/CLOSE/EDIT/APPROVE/EXPORT; Front Crew=SELF/CREATE/CLOSE_SELF; Kitchen/Delivery=none.

## 5. Required API / Service Functions

Service layer `lib/cashier/` (server actions / queries), permission-checked:
- `openShift({ cashierId, openingFloat, businessDate })`
- `addAdjustment({ shiftId, type, amount, reason })`
- `closeShift({ shiftId, countedCash, paymentLines[], note? })` → computes `expected_cash`, `cash_variance`, flag
- `verifyShift({ shiftId, note? })` (Sup/Owner; audited; flag self-verify)
- `reopenShift({ shiftId, reason })` / `voidShift({ shiftId, reason })`
- `listShifts({ scope: self|all, range })` · `getShift(id)`
- `getTodayCashierSummary()` → dashboard widget data
- `listPaymentMethods()` · `upsertPaymentMethod()` (Owner)
- Reports: `dailyCashReport`, `varianceReport`, `paymentMixReport`, `periodSummary` (+ export)
- Pure helper: `computeVariance({ openingFloat, cashSales, payIns, payOuts, countedCash, threshold=5 })` (unit-testable)
- Future: `CashierPosAdapter` interface + `importPosSummary()` (not built now)

## 6. Development Phases

| Phase | Scope | Gate |
|---|---|---|
| **0 — Prereq** | Permission-key layer (`ROLE_PERMISSIONS`, `hasPermission`), add cashier keys | no behavior change vs current rules |
| **1 — Data** | Migrations: cashier_shift, payment_method(+seed), payment_line, adjustment; RLS | schema review |
| **2 — Service** | Service functions §5 + `computeVariance` | unit tests pass |
| **3 — Open/Close** | S1 list, S2 open, S4 close + variance/note | flow tests |
| **4 — Verify/Review** | S5 detail, verify/reopen/void, audit | segregation-of-duties tests |
| **5 — Reports** | S6 reports + export | report correctness |
| **6 — Dashboard** | wire `cashier_status` widget (no dashboard redesign) | role visibility check |
| **V1.1** | Denomination counter (`cash_denomination`) | — |
| **Future** | POS adapter + `pos_summary` + reconciliation | provider confirmed |

## 7. Testing Checklist

**Unit**
- [ ] `computeVariance` over/short/zero; threshold boundary (RM4.99 ok, RM5.01 flagged)
- [ ] expected_cash with pay_in/pay_out, multiple methods
- [ ] total_sales = Σ lines

**Flow**
- [ ] Open → only one OPEN shift per business_date enforced
- [ ] Close with flagged variance requires note (block submit if missing)
- [ ] Verify locks edits; Reopen unlocks (audited); Void cannot be edited
- [ ] Supervisor-as-cashier self-verify is recorded/flagged in audit

**Permissions / visibility**
- [ ] Front Crew sees own shifts only; cannot verify/export/see cross-shift totals
- [ ] Supervisor: all shifts, verify, ops reports; no POS/payment-method config
- [ ] Owner: full incl config
- [ ] Kitchen/Delivery: no access (route + UI)

**Edge cases**
- [ ] Midnight rollover uses business_date not calendar date
- [ ] Missing close flagged next day
- [ ] Refund/cash drop via adjustment, not negative sales
- [ ] Adding a new payment method (config) needs no migration

**Regression / integrity**
- [ ] `npx tsc --noEmit` clean · `npm run build` clean
- [ ] Existing routes unaffected (dashboard/home/nav untouched)
- [ ] RLS denies cross-outlet / unauthorized reads

## Decisions locked (from approval)
One shift/day (schema flexible) · single counted-cash (no denominations V1) · RM5 threshold + FC flagged-submit-with-note + Sup/Owner verify · Supervisor may be cashier (audited) · POS provider-agnostic, not implemented.
