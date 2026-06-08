# Wenxin Permission Matrix

**Date:** 2026-06-08
**Status:** Approved
**Source:** [permission-layer-design.md](permission-layer-design.md)

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

### Dine-in

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `dine_in:view` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `dine_in:edit` | ✅ | ✅ | ❌ | ✅ | ❌ |

### Reservations

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `reservations:view` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `reservations:edit` | ✅ | ✅ | ❌ | ✅ | ❌ |

### Complaints

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `complaints:view` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `complaints:edit` | ✅ | ✅ | ❌ | ✅ | ❌ |

### Incidents

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `incidents:view` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `incidents:edit` | ✅ | ✅ | ❌ | ✅ | ❌ |

### Tasks

| Permission | Owner | Manager | Kitchen | Front Desk | Delivery |
|---|---:|---:|---:|---:|---:|
| `tasks:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `tasks:edit` | ✅ | ✅ | ✅ | ✅ | ❌ |

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
| `cashier:close_shift` | ✅ | ✅ | ❌ | ❌ | ❌ |

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

| Role | Permission Count |
|------|:----------------:|
| Owner | 60 (all) |
| Manager | 52 |
| Kitchen | 24 |
| Front Desk | 28 |
| Delivery | 9 |

---

## Related Documents

- [permission-layer-design.md](permission-layer-design.md) — Full architecture design and migration strategy
- [permission-phase0-checklist.md](permission-phase0-checklist.md) — Phase 0 implementation checklist
