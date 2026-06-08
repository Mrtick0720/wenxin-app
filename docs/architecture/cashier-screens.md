# Cashier Module — Screen Specification (V1)

> Status: **Approved** (with updates 1–3 below). Product spec only — no code, no migrations.
> Based on `cashier-module.md`. Roles: Owner / Supervisor / Front Crew (Kitchen & Delivery: no access).

## Approved Updates (override earlier drafts)

1. **Terminology:** use **"Cashier Home"** (not "Shift List").
2. **Payment totals are POS-driven (single source of truth).**
   - V1: staff enter **only Closing Counted Cash**.
   - Payment Breakdown is **read-only summary data** (sourced from POS when POS data exists).
   - The system must **not maintain two competing sources** of payment totals → **no manual payment-breakdown entry**.
   - **Implication (V1, pre-POS):** with no POS connected there is no sales source to reconcile against, so **cash variance is not computed in V1**. The close records opening float, adjustments, and counted cash, and shows **derived cash takings** (`counted − opening − Σpay_in + Σpay_out`). The RM5 variance check + mandatory note **activate once POS payment data is present**.
3. **Segregation of duties (hard-enforced).** Closer and Verifier **must be different users**. **Self-verification is not allowed** (hard block — audit flags are *not* sufficient). Examples: Front Crew closes → Supervisor verifies; Supervisor closes → Owner verifies.

## Global Conventions

- **Mobile-first:** single-column stacked cards; sticky header (`BackButton` + title + status badge); **bottom sticky action bar** for the primary CTA; ≥44px targets; numeric keypad for currency; currency = **RM, 2 decimals**.
- **Status badges:** `OPEN` (orange) · `CLOSED` (blue, "pending verification") · `VERIFIED` (green, locked) · `REOPENED` (amber) · `VOID` (gray).
- **Variance display:** `+RM` green = Over · `−RM` red = Short · flagged chip ⚠ when |variance| > RM5 *(POS-data only)*. When no POS data: show "Cash takings (derived)" with no variance comparison.
- Toasts for success; inline errors for validation; retry banner for load failures.

## Navigation Flow

```
Home → All Modules → Cashier Home (S1)
S1 ─(no shift today + CREATE_CASHIER)─▶ Open Shift (S2) ─open─▶ Active Shift (S3)
S1 ─(shift OPEN)──────────────────────▶ Active Shift (S3) ─Close─▶ Close Shift (S4)
S1 ─(shift CLOSED/VERIFIED)───────────▶ Shift Review (S5)
S4 ─submit─▶ Shift Review (S5)
S5 ─Verify/Reopen/Void (Sup/Owner, verifier≠closer)─▶ S5 (updated)
S1 ─Reports─▶ Cashier Reports (S6)      S1 ─Settings (Owner)─▶ Payment Method Settings (S7)
```

---

## 1. Cashier Home (S1) — `/cashier`

- **Purpose:** Entry point; today's shift status + history; route to open/active/review/reports/settings.
- **User actions:** Open shift (if none today + permission) · tap a shift → its state screen · open Reports · open Settings (Owner) · filter history by date.
- **Sections:** (a) **Today** card (status, cashier, derived cash takings or POS totals, # unverified) · (b) **Action zone** (*Open Shift* / *Continue Shift* / *Review*) · (c) **History** list (newest first) · (d) Reports entry · (e) Settings entry (Owner).
- **Fields (display):** business_date, status, cashier name, cash takings (derived) / POS totals (if any), variance (only when POS data), opened/closed time.
- **Validation:** ≤1 non-void shift/day → hide "Open Shift" if one exists. Front Crew sees **own shifts only**.
- **Empty:** no shift today → "No shift opened yet today" + *Open Shift* CTA (if `CREATE_CASHIER`). No history → "No past shifts."
- **Error:** load failure → retry banner.
- **Success:** returning from open/close/verify → toast + refreshed Today card.

## 2. Open Shift (S2)

- **Purpose:** Start the day's shift with an opening float.
- **User actions:** Choose cashier-in-charge (FC = self locked; Sup/Owner picker) · enter opening float · confirm.
- **Sections:** Cashier selector · Opening float input · Read-only (business_date, shift = "Full") · optional note · confirm bar.
- **Fields:** `cashier_id`, `opening_float` (currency, **required, ≥0**), `note` (optional).
- **Validation:** opening_float required & ≥0; **block if a non-void shift already exists today**; requires `CREATE_CASHIER`.
- **Empty/default:** opening_float empty (optionally suggest prior day's closing float).
- **Error:** duplicate shift → "A shift already exists for today" + link; save fail → retry.
- **Success:** status `OPEN` → Active Shift (S3) + toast "Shift opened".

## 3. Active Shift (S3)

- **Purpose:** Live view of the open shift; record cash movements; entry to close.
- **User actions:** Add pay-in / pay-out adjustment · review running drawer cash · **Close Shift** · (future) view live POS totals (read-only).
- **Sections:** Shift header (cashier, opened_at, opening_float, `OPEN`) · Running cash (opening float, Σ pay-in, Σ pay-out, running drawer cash) · **Payment breakdown (read-only)** — shows POS totals if connected, else "Pending POS integration" · Adjustments list (+ Add) · Close action bar.
- **Fields:** adjustment `{ type: pay_in|pay_out, amount (>0, required), reason (required) }`.
- **Validation:** amount >0, reason required; pay_out > running cash → soft warn; only shift owner or Sup/Owner (`CLOSE_CASHIER_SELF` / `EDIT_CASHIER`).
- **Empty:** no adjustments → "No cash movements yet." Payment breakdown (no POS) → "Pending POS integration."
- **Error:** add fails → retry; shift no longer OPEN → refresh → Review.
- **Success:** adjustment added → running cash updates + toast.

## 4. Close Shift (S4)

- **Purpose:** Capture **closing counted cash** and submit close. (Payment totals come from POS, not staff.)
- **User actions:** Enter **closing counted cash** · review reconciliation/derived takings · enter variance note **if flagged (POS data only)** · submit.
- **Sections:**
  - (a) **Cash count** — single `closing_counted_cash` field (denomination counter = V1.1).
  - (b) **Payment breakdown (READ-ONLY summary)** — POS-sourced (Cash / TNG / Alipay / Card / Other). V1 (no POS): "Pending POS integration — payment breakdown will appear once POS is connected."
  - (c) **Reconciliation summary** —
    - *With POS:* opening float + POS cash sales + Σpay_in − Σpay_out = **expected cash**; counted cash; **variance** (over/short).
    - *Without POS (V1):* show **derived cash takings** = `counted − opening − Σpay_in + Σpay_out`; **no variance** ("variance available after POS integration").
  - (d) **Variance note** — shown/required only when variance is computed and |variance| > RM5.
  - (e) Submit bar.
- **Fields:** `closing_counted_cash` (**required, ≥0**), `variance_note` (conditional-required when flagged). **No manual payment-amount fields.**
- **Validation:** counted cash required & ≥0; if (POS present and |variance|>RM5) → variance_note required (block submit if empty); requires `CLOSE_CASHIER(_SELF)`; shift must be `OPEN`.
- **Empty/default:** counted cash empty; payment breakdown empty/"pending POS".
- **Error:** flagged + missing note → inline error; submit fail → retry; shift not OPEN → abort.
- **Success:** status `CLOSED` → Shift Review (S5) + toast "Shift closed — pending verification" (+ "variance flagged" if applicable).

## 5. Shift Review (S5) — `/cashier/[id]`

- **Purpose:** Full read of a shift; verify/approve, reopen, void; (future) POS reconciliation.
- **User actions:** **Verify** (Sup/Owner, **must differ from closer**) · **Reopen** (reason) · **Void** (reason) · view audit trail · (future) reconcile POS · export this shift.
- **Sections:** Header (status, business_date, cashier) · Financial summary (opening, payment breakdown read-only/POS, derived takings or expected vs counted, variance + note) · Adjustments list · **Audit trail** (opened/closed/verified by + timestamps) · POS reconciliation (hidden until POS) · Action bar (per status + permission).
- **Fields (read):** all shift fields; `verification_note` (on verify).
- **Validation:**
  - Verify only when status = `CLOSED`.
  - **Segregation of duties (hard block):** the **Verify action is disabled/forbidden if the current user is the closer** (`closed_by`) or the cashier-in-charge who closed. Self-verification is rejected server-side, not just flagged.
  - Reopen/Void require a reason.
  - **Front Crew = read own only** (no verify/reopen/void).
- **Empty:** n/a. FC opening a non-own shift → access-denied.
- **Error:** self-verify attempt → blocked with message "Verifier must be different from the person who closed the shift."; stale action → refresh; no permission → actions hidden.
- **Success:** Verified → `VERIFIED` (locked) + toast; Reopened → `OPEN/CLOSED` + toast; Voided → `VOID` + toast.

## 6. Cashier Reports (S6) — `/cashier/reports`

- **Purpose:** Aggregated cash insights + export.
- **User actions:** Pick report type · set period · filter · view · **export** (`EXPORT_CASHIER`).
- **Sections:** Report selector (Daily Cash · Variance *(POS data)* · Payment-Mix *(POS data)* · Cashier Performance *(Owner)* · Period Summary · POS Reconciliation *(future)*) · Period filter · Results · Export.
- **Fields:** date range; optional cashier/method filters.
- **Validation:** start ≤ end; **Supervisor = operational reports only** (financial/margin = Owner, `VIEW_FINANCE_REPORTS`); export gated.
- **Empty:** no data → "No cashier data for this period." Payment-mix/variance without POS → "Available after POS integration."
- **Error:** load/export fail → retry.
- **Success:** export → confirmation (file generated; download is an explicit user-triggered action).

## 7. Payment Method Settings (S7) — `/cashier/settings` (Owner only)

- **Purpose:** Configure payment methods (and host future POS config). These methods define how POS payment data maps/displays.
- **User actions:** Add / edit / deactivate method · reorder · (future) configure POS provider/keys.
- **Sections:** Methods list (Cash/TNG/Alipay/Card/Other + Add) · Method editor · POS integration (disabled placeholder — "not configured").
- **Fields:** method `{ code (immutable once used), label (required), is_cash, sort_order, active }`; POS (future): provider, credentials, outlet mapping.
- **Validation:** label required; code unique; **cannot delete a used method → deactivate**; `is_cash` change warns (affects future variance); requires `MANAGE_PAYMENT_METHODS` (Owner).
- **Empty:** defaults seeded (Cash/TNG/Alipay/Card/Other).
- **Error:** duplicate code → inline; save fail → retry.
- **Success:** method saved → list updates + toast.

---

## Required Permissions & Role Visibility

| Screen | Required perm | Owner | Supervisor | Front Crew | Kitchen/Delivery |
|---|---|---|---|---|---|
| S1 Cashier Home | VIEW_CASHIER_ALL / _SELF | ✓ all | ✓ all | ✓ own only | ✗ |
| S2 Open | CREATE_CASHIER | ✓ | ✓ | ✓ (self) | ✗ |
| S3 Active | CLOSE_CASHIER_SELF / EDIT_CASHIER | ✓ | ✓ | ✓ (own) | ✗ |
| S4 Close | CLOSE_CASHIER(_SELF) | ✓ | ✓ | ✓ (own) | ✗ |
| S5 Review | VIEW + APPROVE_CASHIER (verify) | ✓ verify** | ✓ verify** | read own only | ✗ |
| S6 Reports | VIEW_CASHIER_ALL (+ EXPORT) | ✓ all + financial | ✓ ops + export | ✗ | ✗ |
| S7 Settings | MANAGE_PAYMENT_METHODS | ✓ | ✗ | ✗ | ✗ |

\** **Verifier ≠ closer (hard-enforced).** A user can never verify a shift they closed. If Supervisor closed, Owner verifies. Front Crew never verifies.

**Cross-cutting:** Front Crew never sees other cashiers' shifts / cross-shift totals / financial reports / config, and cannot verify/reopen/void. Supervisor = full operational incl. verify (of others' closes), no POS/method config, no financial-margin reports. Owner = full. Kitchen & Delivery = no Cashier access.

## Open Implication to confirm
With **no POS in V1**, **cash variance is not computed** (single-source rule). The cashier becomes a cash log (opening float + counted cash + derived takings) until POS is integrated, at which point variance + RM5 flagging activate automatically. Confirm this V1 behavior is acceptable, or decide an interim manual cash-sales capture (note: that would reintroduce a second source).
