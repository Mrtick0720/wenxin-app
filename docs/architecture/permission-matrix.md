# Wenxin Permission Matrix — CONSOLIDATION DRAFT

**Status:** 🟡 DRAFT — Consolidation in review. **NOT yet Approved.**
**Draft date:** 2026-06-09
**Base document:** R1 `permission-matrix.md` (granular enumeration)
**Re-attached from:** R2 `permission-matrix.md` (architecture blueprint) — Sections C, D, F, and naming-standard rules
**Supersedes (pending approval):** the two prior 2026-06-08 "Approved" variants of this file
**Sources:** [permission-layer-design.md](permission-layer-design.md) · [information-architecture.md](information-architecture.md)

> ⚠️ **This document is not authoritative until the DECISION NEEDED items below are resolved and the status is changed to Approved.** Until then, treat both 2026-06-08 variants as historical references, not active policy.

---

## Changelog

- **2026-06-09 — Consolidation draft created.** Merges two divergent files that both carried `Status: Approved` and `Date: 2026-06-08` under the same filename (`docs/architecture/permission-matrix.md`):
  - **R1 variant** ("Wenxin Permission Matrix", 284 lines) — granular `module:action` permission keys, Operational KPIs, Purchase Workflow, permission counts. Used here as the structural base.
  - **R2 variant** ("Permission Matrix + Module Dependency Blueprint (V1)", 107 lines) — compact V/C/E/A/X matrix plus architecture sections. Sections C (Module Dependency Blueprint), D (Data Ownership Rules), F (Architecture Risks + Development Order), and the naming-standard rules from Section B are re-attached here.
  - **Taxonomy restored:** R2's distinct **Bookings** and **Customers** modules, dropped in R1, are reinstated as explicit rows.
  - **7 cross-variant contradictions** (Kitchen/Delivery access to Complaints, Incidents, Dine-in; Delivery task edit; Front Desk cashier close) are **left unresolved** and tagged `⚠️ DECISION NEEDED` — no policy was chosen automatically.
  - **Open:** single canonical key-notation choice (`module:action` vs `SCREAMING_SNAKE`) — see Naming Standard.

---

## Decisions Needed (must resolve before Approval)

Each row below differs between the two source variants. Resolve each as an explicit, dated policy decision; do not accept a merge default.

| # | Module · Permission · Role | R2 variant said | R1 variant said | Status |
|---|---|---|---|---|
| 1 | Complaints · view · **Kitchen** | `V` (allowed) | ❌ denied | ⚠️ DECISION NEEDED |
| 2 | Complaints · view/create(self) · **Delivery** | `V C(self)` | ❌ denied | ⚠️ DECISION NEEDED |
| 3 | Incidents · view/create · **Kitchen** | `V C` | ❌ denied | ⚠️ DECISION NEEDED |
| 4 | Incidents · view/create · **Delivery** | `V C` | ❌ denied | ⚠️ DECISION NEEDED |
| 5 | Dine-in · view · **Kitchen** | `V` (allowed) | ❌ denied | ⚠️ DECISION NEEDED |
| 6 | Tasks · edit · **Delivery** | `E(self)` (allowed, self) | ❌ denied (view-only) | ⚠️ DECISION NEEDED |
| 7 | Cashier · close_shift · **Front Desk** | `CLOSE_CASHIER ✓(self)` | ❌ denied (Owner/Manager only) | ⚠️ DECISION NEEDED |

> Note for the decision-owner: R1's stricter Kitchen/Delivery posture and the Owner/Manager-only cashier close align with R2's later commit `90cf249` *"enforce POS-driven payments and segregation of duties."* That context is provided for the decision, not as the decision.

---

## Roles

| Role | Code | Description |
|------|------|-------------|
| Owner | `owner` | Restaurant owner. Full system access including staff account management, finance, and settings. |
| Manager | `manager` | Restaurant supervisor. Operational oversight. Cannot access Finance or Staff Accounts. |
| Kitchen | `kitchen` | Kitchen staff. Purchase, inventory, production, and limited operational KPIs. |
| Front Desk | `front_desk` | Front-of-house. Bento orders, dine-in, reservations, complaints, cashier operations. |
| Delivery | `delivery` | Future role. Minimal access — home, bento orders view, tasks view, self attendance. |

---

## Module Permissions

> Cells marked `⚠️ DECISION` correspond to the numbered items in **Decisions Needed** above and must be resolved before approval.

### Home

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `home:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `home:view_revenue` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `home:view_alerts` | ✅ | ✅ | ✅ | ✅ | ✅ |

### Bento

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `bento:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `bento:orders:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `bento:orders:edit` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `bento:customers:view` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `bento:customers:edit` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `bento:payments:view` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `bento:payments:edit` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `bento:production:view` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `bento:weekly_menu:view` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `bento:weekly_menu:edit` | ✅ | ✅ | ❌ | ❌ | ❌ |

### Customers  *(restored from R2 taxonomy — absent in R1 base)*

> R1 folded customer access under `bento:customers:*`. R2 treated Customers as a first-class module. Restored here as explicit rows for review; confirm whether Customers is a standalone module or remains nested under Bento.

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `customers:view` | ✅ | ✅ (no PII) | ❌ | ✅ | ⚠️ future (address-only) |
| `customers:edit` | ✅ | ❌ | ❌ | ✅ | ❌ |

### Bookings  *(restored from R2 taxonomy — R1 named this "Reservations")*

> R2 used **Bookings**; R1 used **Reservations**. These appear to denote the same concept. Restored as an explicit row; **taxonomy reconciliation needed** — pick one canonical module name (not counted among the 7 policy decisions, but resolve before approval).

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `bookings:view` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `bookings:edit` | ✅ | ✅ | ❌ | ✅ | ❌ |

### Reservations  *(R1 base — pending merge with Bookings above)*

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `reservations:view` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `reservations:edit` | ✅ | ✅ | ❌ | ✅ | ❌ |

### Dine-in

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `dine_in:view` | ✅ | ✅ | ⚠️ DECISION (#5) | ✅ | ❌ |
| `dine_in:edit` | ✅ | ✅ | ❌ | ✅ | ❌ |

### Purchase

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `purchase:view` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `purchase:edit` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `purchase:approve` | ✅ | ✅ | ❌ | ❌ | ❌ |

> **Purchase Price Visibility Rule:** Kitchen and Front Desk submit purchase requests with item, quantity, unit, reason, urgency, and notes only. They do NOT enter or view unit prices, supplier pricing, or total purchase cost. Purchase prices and final purchase amounts are entered or confirmed only by Supervisor (Manager) and Owner/Admin. See [Purchase Workflow](#purchase-workflow) below.

### Inventory

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `inventory:view` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `inventory:edit` | ✅ | ✅ | ✅ | ❌ | ❌ |

### Finance

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `finance:view` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `finance:edit` | ✅ | ❌ | ❌ | ❌ | ❌ |

### Reports

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `reports:view` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `reports:purchase_sales_ratio:view` | ✅ | ✅ | ✅ (pct + status only) | ❌ | ❌ |

> **Kitchen Restriction:** Kitchen can view the Purchase-to-Sales Ratio as a percentage and status color (green/yellow/red) only. Kitchen cannot view raw revenue, profit margins, finance reports, or cashier sales totals. See [Operational KPIs](#operational-kpis) below.

### Complaints

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `complaints:view` | ✅ | ✅ | ⚠️ DECISION (#1) | ✅ | ⚠️ DECISION (#2) |
| `complaints:edit` | ✅ | ✅ | ❌ | ✅ | ⚠️ DECISION (#2, create-self) |

### Incidents

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `incidents:view` | ✅ | ✅ | ⚠️ DECISION (#3) | ✅ | ⚠️ DECISION (#4) |
| `incidents:edit` | ✅ | ✅ | ⚠️ DECISION (#3, create) | ✅ | ⚠️ DECISION (#4, create) |

### Tasks

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `tasks:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `tasks:edit` | ✅ | ✅ | ✅ | ✅ | ⚠️ DECISION (#6, edit-self) |

### Staff

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `staff:schedule:view` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `staff:schedule:edit` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `staff:accounts:manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `staff:activity:view` | ✅ | ❌ | ❌ | ❌ | ❌ |

### Attendance

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `attendance:self:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `attendance:self:edit` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `attendance:all:view` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `attendance:all:edit` | ✅ | ✅ | ❌ | ❌ | ❌ |

### Checklist

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `checklist:self:view` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `checklist:self:edit` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `checklist:all:view` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `checklist:verify` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `checklist:templates:manage` | ✅ | ✅ | ❌ | ❌ | ❌ |

### Suppliers

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `suppliers:view` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `suppliers:edit` | ✅ | ✅ | ❌ | ❌ | ❌ |

### Assets

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `assets:view` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `assets:edit` | ✅ | ✅ | ❌ | ❌ | ❌ |

### Cashier

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `cashier:view` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `cashier:operate` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `cashier:close_shift` | ✅ | ✅ | ❌ | ⚠️ DECISION (#7, self) | ❌ |

### Profile

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `profile:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `profile:edit` | ✅ | ✅ | ✅ | ✅ | ✅ |

### Sensitive Data

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `sensitive:customer_pii:view` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `sensitive:financial_data:view` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `sensitive:staff_pii:view` | ✅ | ✅ | ❌ | ❌ | ❌ |

### Administrative

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `admin:settings:manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `admin:roles:manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `admin:export` | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## Operational KPIs

### Purchase-to-Sales Ratio

**Permission:** `VIEW_PURCHASE_SALES_RATIO` (`reports:purchase_sales_ratio:view`)

**Business Meaning:** Kitchen needs to see whether today's purchase amount is proportional to today's sales.

**Formula:**
```
Purchase-to-Sales Ratio = Approved / Confirmed Purchase Amount ÷ Sales Amount × 100%
```

The numerator uses only **approved/confirmed** purchase amounts — not raw purchase requests. Purchase requests submitted by Kitchen and Front Desk do not include prices; prices are entered or confirmed by Supervisor or Owner/Admin. Only purchases with confirmed prices are included in the ratio calculation.

**Data Sources:**
- Purchase module — today's approved/confirmed purchase amounts (prices entered by Manager/Owner)
- Cashier module — today's sales amount
- Reports module — aggregates and calculates the KPI

**Display Thresholds:**

| Range | Color | Meaning |
|-------|-------|---------|
| ≤ 25% | Green | Healthy — purchase cost is well within revenue |
| > 25% and ≤ 35% | Yellow | Warning — purchase cost is elevated relative to sales |
| > 35% | Red | Alert — purchase cost is too high relative to sales |

Thresholds are configurable via `restaurant_settings` in a future phase.

**Visibility Rules:**

| Role | Can See Ratio | Can See Raw Revenue | Can See Purchase Amount |
|------|:------------:|:-------------------:|:----------------------:|
| Owner | ✅ Full access | ✅ | ✅ |
| Manager | ✅ Full access | ✅ | ✅ |
| Kitchen | ✅ KPI output only (pct + color) | ❌ | ❌ |
| Front Desk | ❌ | ❌ | ❌ |
| Delivery | ❌ | ❌ | ❌ |

**Kitchen Restriction (KPI-Only Access):**
- Kitchen receives only the **derived KPI output**: percentage value and status color (green/yellow/red).
- Kitchen CANNOT view: today's sales amount, today's purchase amount, unit prices, supplier prices, purchase cost breakdown, revenue totals, profit margins, finance reports, or cashier sales totals.
- The KPI is displayed to Kitchen as an isolated operational metric — a single percentage with a color badge. No underlying financial values are exposed.
- This is operational guidance ("are we over-purchasing relative to sales?"), not financial disclosure.

---

## Purchase Workflow

### Purchase Price Visibility

Kitchen and Front Desk staff submit purchase requests without prices. They enter only operational details. Prices are added or confirmed by Supervisor or Owner/Admin as a separate step.

**Request Submission (Kitchen / Front Desk):**

| Field | Visible | Editable |
|-------|:-------:|:--------:|
| Item name | ✅ | ✅ |
| Quantity | ✅ | ✅ |
| Unit | ✅ | ✅ |
| Reason / urgency | ✅ | ✅ |
| Notes | ✅ | ✅ |
| Unit price | ❌ | ❌ |
| Supplier name | ✅ (reference) | ✅ (reference) |
| Supplier price | ❌ | ❌ |
| Total cost | ❌ | ❌ |

**Price Confirmation (Manager / Owner):**

| Field | Visible | Editable |
|-------|:-------:|:--------:|
| All request fields | ✅ | ✅ |
| Unit price | ✅ | ✅ |
| Supplier price | ✅ | ✅ |
| Total purchase cost | ✅ | ✅ |
| Approve / confirm | ✅ | ✅ |

**Rationale:** Kitchen and Front Desk identify what needs to be purchased. Manager and Owner control pricing and supplier relationships. This separation ensures purchasing decisions are made by those with budget authority while keeping operational staff focused on identifying needs.

---

## Permission Counts by Role

> ⚠️ These counts are inherited from the R1 base and **will shift** once the 7 DECISION NEEDED items and the Bookings/Customers taxonomy are resolved. Recompute before approval.

| Role | Permission Count (provisional) |
|------|:----------------:|
| Owner | 60 (all) |
| Manager | 52 |
| Kitchen | 24 |
| Front Desk | 28 |
| Delivery | 9 |

---

## Permission Naming Standard

> Re-attached from R2 Section B. **Open decision:** the base matrix above uses `module:action` notation; R2's rules and examples use `SCREAMING_SNAKE` (`VIEW_PURCHASE_COST`). Choose **one** canonical key format and mark the other deprecated before approval.

Format: `ACTION_MODULE[_QUALIFIER]`, SCREAMING_SNAKE_CASE.
- **Actions:** `VIEW CREATE EDIT DELETE APPROVE EXPORT` (+ domain verbs: `CLOSE ASSIGN RESOLVE`).
- **Qualifiers:** `_SELF _ALL _PII _PAYMENT _COST _PAYMENT_TERMS _REPORTS _ADDRESS`.
- **Examples:** `VIEW_INVENTORY`, `APPROVE_PURCHASE`, `VIEW_PURCHASE_COST`, `CLOSE_CASHIER_SELF`, `VIEW_BENTO_CUSTOMER_PII`.
- **Rules:**
  - Check **keys, never role names**.
  - Roles are bundles of keys (`ROLE_PERMISSIONS`).
  - Permissions are **additive** — absence of a key = deny.
  - Field sensitivity is its own key (do not infer from module access).
  - Reserve `@outlet` / `@org` scope qualifiers for the future multi-outlet model.

---

## Section C — Module Dependency Blueprint

> Re-attached verbatim from R2. Absent from R1.

```
Suppliers → Purchase → Inventory → Reports;  Purchase → Finance(costs);  Purchase → Tasks(APPROVE_PURCHASE)
Customers → Bookings / Bento / Dine-in / Delivery(future)
Schedule → Attendance → Payroll(future);  Schedule → Tasks(leave)
Cashier → Finance → Reports;  (Dine-in + Bento) → Cashier;  Assets[POS] ↔ Cashier;  POS API(future) → Cashier
Assets → Incidents (Asset/Maintenance) → Maintenance(future);  Incidents → Tasks
Complaints → Customers;  (Bento/Dine-in/Delivery) → Complaints → Reports
Checklist → Inventory(stock-check) / Cashier(cash-closing) / standalone(opening,closing,hygiene)
Finance/Reports ← consume: Cashier, Purchase, Bento, Dine-in, Inventory, Complaints
```

---

## Section D — Data Ownership Rules

> Re-attached verbatim from R2. Absent from R1.

| Module | Data owner | Edit | Approve | Export |
|---|---|---|---|---|
| Bento | Supervisor | O/Sup/FC; K(status) | Owner | Owner |
| Bookings/Dine-in | Front Crew | O/Sup/FC | Supervisor | Owner |
| Customers | Owner | O/FC | Owner | Owner |
| Staff | Owner | Owner | Owner | Owner |
| Schedule | Supervisor | O/Sup | Owner | Owner |
| Attendance | Supervisor | self; O/Sup correct | O/Sup | Owner |
| Complaints/Incidents/Tasks/Checklist | Supervisor | per matrix | O/Sup | Owner |
| Inventory/Purchase | Kitchen/Sup | O/Sup/K | O/Sup | Owner |
| Suppliers | Supervisor | O/Sup | Owner | Owner |
| Assets | Supervisor | O/Sup | Owner | Owner |
| Cashier | Front Crew (shift) | FC(self); O/Sup | O/Sup | Owner |
| Finance/Reports | Owner | — | — | O; Sup(ops) |

---

## Section F — Architecture Risks + Development Order

> Re-attached verbatim from R2. Absent from R1.

**Risks:**
1. Role-hardcoded access → migrate to permission keys — **[HIGH, prerequisite]**
2. Multi-outlet scope — **[MED, future — add `outlet_id` now]**
3. POS readiness — **[MED — provider-agnostic adapter]**
4. Payroll readiness — **[MED — trustworthy attendance + PII gating]**
5. Delivery readiness — **[LOW — address exposure]**

**Development Order:**
**0) Permission layer (prerequisite) → 1) Cashier → 2) Checklist → 3) Attendance → 4) Suppliers (upgrade) → 5) Assets** → later: Delivery role, Payroll, POS API, Outlet scoping.

---

## Related Documents

- [permission-layer-design.md](permission-layer-design.md) — Full architecture design and migration strategy
- [permission-phase0-checklist.md](permission-phase0-checklist.md) — Phase 0 implementation checklist
- [information-architecture.md](information-architecture.md) — Companion IA document (referenced by the R2 variant)
