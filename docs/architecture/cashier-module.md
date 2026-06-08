# Cashier Module — Product & Architecture Spec (V1)

> Status: **Approved**. Product + data architecture only (no UI, no code, no migrations here).

## Approved Business Decisions

1. **Shift model:** one shift per business day for V1. No lunch/dinner or multi-drawer yet. Keep schema flexible for future multiple shifts (`shift_label` + non-unique design; enforce single OPEN/day in app logic).
2. **Denomination counter:** not required in V1 — single `closing_counted_cash` amount. Denomination counter = V1.1.
3. **Variance threshold:** default **RM5**. Front Crew **can** submit a flagged close but **must** provide a mandatory variance note. Supervisor or Owner must **verify** before final.
4. **Supervisor as cashier:** allowed (can be cashier-in-charge). **Segregation of duties is hard-enforced — self-verification is NOT allowed** (closer ≠ verifier; rejected server-side, not merely audited). e.g. Supervisor closes → Owner verifies.
5. **POS provider:** not confirmed. Adapter must be **provider-agnostic**. **Do not implement POS now.**
6. **Payment totals = POS-driven (single source of truth).** V1: staff enter **only Closing Counted Cash**; the Payment Breakdown is **read-only** (POS-sourced) — no manual payment entry, to avoid two competing sources. Cash variance is computed **only when POS payment data exists**; pre-POS V1 records counted cash + **derived takings** (no variance).

## Core Concept — the Shift

Record unit = **Cashier Shift** (one cash-drawer session per business day in V1).
Lifecycle: `OPEN → CLOSED → VERIFIED` with audited `REOPEN` and `VOID`.

## Screens

| # | Screen | Purpose | Roles |
|---|---|---|---|
| S1 | Shift List / Cashier Home | Today + history; status, sales, variance | All (FC = own) |
| S2 | Open Shift | cashier-in-charge, opening float → start | FC/Sup/Owner |
| S3 | Active Shift | overview; pay-in/pay-out adjustments | owner + Sup/Owner |
| S4 | Close Shift | counted cash only (breakdown read-only/POS) → variance(POS)+note → submit | owner + Sup/Owner |
| S5 | Shift Detail / Review | full breakdown, variance, audit; Verify/Reopen/Void | Sup/Owner (FC read own) |
| S6 | Cashier Reports | daily/variance/payment-mix/period; export | Owner; Sup(ops) |
| S7 | Settings → Payment Methods & POS | config (future POS) | Owner only |

## User Flows

- **Open:** pick cashier → opening float → `OPEN` (guard: one OPEN per business day in V1).
- **Operate:** pay-in / pay-out adjustments (petty cash, cash drop) with reason.
- **Close:** enter `closing_counted_cash` **only** (payment breakdown is read-only/POS). With POS → compute `expected_cash` & `cash_variance`; if |variance| > RM5 mandatory note. Without POS (V1) → record derived takings, no variance. Submit `CLOSED`.
- **Verify:** Sup/Owner approves → `VERIFIED` (locks) or **Reopen** (reason). **Verifier must differ from the closer — self-verification is blocked (hard rule).**
- **Variance exception (POS data only):** > RM5 ⇒ flagged + mandatory note + verified by a **different** user.
- **Void:** cancel erroneous shift (audited; never hard-delete).

## Database Schema (design)

**cashier_shift** (core): `id, outlet_id(future), business_date, shift_label('full' default), cashier_id→staff, status(open|closed|verified|reopened|void), opening_float, opened_by, opened_at, closing_counted_cash, expected_cash, cash_variance, total_sales, pos_source(manual|pos|mixed), closed_by, closed_at, verified_by, verified_at, variance_note, notes, created_at, updated_at`.
> V1 invariant (app-enforced, not DB-unique): at most one non-void shift per `(outlet_id, business_date)`. Keep columns that allow many later.

**payment_method** (reference/config): `code pk, label, is_cash, sort_order, active, outlet_id?`. Seed: cash(is_cash=true), tng, alipay, card, other.

**cashier_payment_line**: `id, shift_id→cashier_shift, method_code→payment_method, amount, txn_count?, source(manual|pos), unique(shift_id, method_code)`.

**cashier_adjustment**: `id, shift_id, type(pay_in|pay_out), amount, reason, by, at`.

**Deferred:**
- `cash_denomination` (V1.1): `id, shift_id, denom, qty, subtotal` → sums to counted cash.
- `pos_summary` (future): `id, shift_id?/business_date, provider, gross_sales, net_sales, by_method(jsonb), txn_count, raw_payload(jsonb), source_ref(idempotency), imported_at`.

Integrity: RLS by `outlet_id` + permission keys; VERIFIED/void immutable except Owner; all status changes → Audit Log.

## Variance Math

```
With POS payment data (single source):
  expected_cash = opening_float + cash_sales(POS) + Σ pay_in − Σ pay_out
  cash_variance = closing_counted_cash − expected_cash      (+ Over / − Short)
  flagged when |cash_variance| > RM5 → mandatory variance_note; verified by a DIFFERENT user.
Without POS (V1): no sales source → cash_variance NOT computed.
  derived_cash_takings = closing_counted_cash − opening_float − Σ pay_in + Σ pay_out
total_sales = from pos_summary (POS is the single source; staff never key payment amounts).
```

## Payment Breakdown

Payment breakdown is **read-only and POS-sourced (single source of truth)** — staff never key payment amounts. Stored as rows in `cashier_payment_line` keyed to `payment_method` (adding a method = config, not migration). V1 methods: **Cash, Touch 'n Go, Alipay, Card, Other**. `is_cash` drives the (POS-based) variance. **Pre-POS V1: breakdown shows "pending POS integration"** and is empty.

## Shift Ownership

`cashier_id` = person in charge (system-of-record owner). Front Crew owns shifts they open/close (view/edit own only). Supervisor/Owner = oversight (view all, verify, correct[audited], reopen/void). Supervisor may be cashier-in-charge (decision #4); **verifier must differ from the closer — self-verification is blocked (enforced server-side).**

## Future POS Integration (design only)

Adapter `CashierPosAdapter.fetchSummary(outletId, businessDate) → { byMethod, gross, net, txnCount }` → `pos_summary`. Modes: `manual`(V1) · `pos`(prefill+lock) · `mixed`. Idempotent via `source_ref`; raw payload retained. Reconciliation compares `pos_summary.by_method` vs `cashier_payment_line`. Provider/keys in Settings (Owner). Provider-agnostic; **not built in V1**.

## Reports

Daily Cash · Variance (trend by cashier) · Payment-Mix · Cashier Performance · Period Summary · POS Reconciliation(future). Export = `EXPORT_CASHIER` (Owner; Sup ops). Feeds Finance + Reports (Cashier = system-of-record for cash/payment-mix).

## Role Visibility

| Capability | Owner | Supervisor | Front Crew |
|---|---|---|---|
| Open/Close shift | ✓ any | ✓ any | ✓ self |
| Enter breakdown/count | ✓ | ✓ | ✓ self |
| View shifts | All | All | Own only |
| Cross-shift totals/variance | ✓ | ✓ | ✗ |
| Verify/Approve | ✓ | ✓ | ✗ |
| Reopen/Void | ✓ | ✓ | ✗ |
| Reports | All+export | Ops+export | ✗ |
| Payment methods/POS config | ✓ | ✗ | ✗ |

Permission keys: `VIEW_CASHIER_ALL`(O,Sup) · `VIEW_CASHIER_SELF`(FC) · `CREATE_CASHIER`/`CLOSE_CASHIER_SELF`(O,Sup,FC) · `EDIT_CASHIER`(O,Sup) · `APPROVE_CASHIER`(O,Sup) · `EXPORT_CASHIER`(O,Sup) · `MANAGE_PAYMENT_METHODS`/`MANAGE_POS_INTEGRATION`(O). Kitchen & Delivery: no access.

## Edge Cases

Midnight rollover (use `business_date`); missing close (flag next day); refunds/cash drops via adjustments; reopen-after-verify audited; **segregation of duties — self-verify blocked (closer ≠ verifier, enforced)**; single currency V1; partial POS → `mixed` (counted cash authoritative for drawer).
