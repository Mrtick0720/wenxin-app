# Permission Matrix + Module Dependency Blueprint (V1)

> Status: **Approved**. Companion to `information-architecture.md`.
> Roles: Owner/Admin=`owner` · Supervisor=`manager` · Front Crew=`front_desk` · Kitchen=`kitchen` · Delivery=`delivery` (future).

## A. Permission Matrix

Codes: `V`=View `C`=Create `E`=Edit `A`=Approve `X`=Export · `—`=none · `(self)`=own rows.

| Module | Owner | Supervisor | Front Crew | Kitchen | Delivery |
|---|---|---|---|---|---|
| Bento | V C E A X | V C E ¹ | V C E ¹ | V E(status) ¹ | V ¹ ² |
| Bookings | V C E A X | V C E | V C E | V | — |
| Dine-in | V C E A X | V C E | V C E | V | — |
| Customers | V C E A X | V ³ | V C E | — | V ² |
| Staff (directory) | V C E A X | V | — | — | — |
| Schedule | V C E A X | V C E | V(self) | V(self) | V(self) |
| Attendance | V A X | V E A | C E V(self) | C E V(self) | C E V(self) |
| Complaints | V C E A X | V C E A | V C | V | V C(self) |
| Incidents | V C E A X | V C E A | V C | V C | V C |
| Tasks | V C E A X | V C E A | V C E(self) | V C E(self) | V C E(self) |
| Checklist | V C E A X | V C E A | V E | V E | V E |
| Inventory | V C E A X | V C E | V | V C E | — |
| Purchase | V C E A X | V C E A | — | V C ⁴ | — |
| Suppliers | V C E A X | V C E ⁵ | — | V ⁵ | — |
| Assets | V C E A X | V C E | V | V | — |
| Cashier | V C E A X | V C E A | C E V(self) ⁶ | — | — |
| Finance | V X | — | — | — | — |
| Reports | V X | V X ⁷ | — | — | — |

Field-level / sensitive keys:

| Key | O | Sup | FC | K | Del |
|---|---|---|---|---|---|
| VIEW_BENTO_CUSTOMER_PII ¹ | ✓ | — | — | — | — |
| VIEW_BENTO_PAYMENT ¹ | ✓ | — | — | — | — |
| VIEW_BENTO_DELIVERY_ADDRESS ² | ✓ | — | — | — | future |
| VIEW_CUSTOMER_PII ³ | ✓ | — | ✓ | — | future(addr) |
| MANAGE_STAFF_ACCOUNTS | ✓ | — | — | — | — |
| VIEW_PURCHASE_COST ⁴ | ✓ | ✓ | ✓ | — | — |
| APPROVE_PURCHASE | ✓ | ✓ | — | — | — |
| VIEW_SUPPLIER_PAYMENT_TERMS ⁵ | ✓ | ✓ | — | — | — |
| CLOSE_CASHIER ⁶ | ✓ | ✓ | ✓(self) | — | — |
| APPROVE_CASHIER / VIEW_CASHIER_ALL ⁶ | ✓ | ✓ | — | — | — |
| VIEW_FINANCE / VIEW_FINANCE_REPORTS ⁷ | ✓ | — | — | — | — |
| VIEW_EMPLOYEE_PII | ✓ | — | — | — | — |

¹ Bento = production-only for non-Owner (package, qty, notes, pickup/delivery time, status); never customer PII/payment.
³ Supervisor sees Customers without PII. ⁷ Supervisor = operational reports only; P&L/margins = Owner.

## B. Permission Naming Standard

`ACTION_MODULE[_QUALIFIER]`, SCREAMING_SNAKE_CASE.
- Actions: `VIEW CREATE EDIT DELETE APPROVE EXPORT` (+ domain verbs: `CLOSE ASSIGN RESOLVE`).
- Qualifiers: `_SELF _ALL _PII _PAYMENT _COST _PAYMENT_TERMS _REPORTS _ADDRESS`.
- Examples: `VIEW_INVENTORY`, `APPROVE_PURCHASE`, `VIEW_PURCHASE_COST`, `CLOSE_CASHIER_SELF`, `VIEW_BENTO_CUSTOMER_PII`.
- Rules: check **keys, never role names**; roles = bundles (`ROLE_PERMISSIONS`); additive (absence = deny); field sensitivity = its own key; reserve `@outlet/@org` scope for multi-outlet.

## C. Module Dependency Blueprint

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

## D. Data Ownership Rules

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

## E. Sensitive Data Access Rules

| Data | Allowed | Denied |
|---|---|---|
| Revenue / Financial (P&L) | Owner | Sup, FC, Kitchen, Delivery |
| Customer PII | Owner, Front Crew | Supervisor, Kitchen, Delivery* |
| Bento order customer/payment | Owner | Sup, FC, Kitchen, Delivery |
| Employee PII (IC/bank/wage) | Owner | Sup, FC, Kitchen, Delivery |
| Purchase costs | Owner, Supervisor, Kitchen | FC, Delivery |
| Supplier payment terms | Owner, Supervisor | Kitchen, FC, Delivery |
| Cashier totals (all shifts)/variance | Owner, Supervisor | FC(self only), Kitchen, Delivery |

\* Delivery future = address-only.

## F. Architecture Risks + Development Order

Risks: (1) role-hardcoded access → migrate to permission keys [HIGH, prereq]; (2) multi-outlet scope [MED, future — add `outlet_id` now]; (3) POS readiness [MED — provider-agnostic adapter]; (4) payroll readiness [MED — trustworthy attendance + PII gating]; (5) delivery readiness [LOW — address exposure].

Order: **0) Permission layer (prereq) → 1) Cashier → 2) Checklist → 3) Attendance → 4) Suppliers (upgrade) → 5) Assets** → later: Delivery role, Payroll, POS API, Outlet scoping.
