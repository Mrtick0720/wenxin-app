# Information Architecture — Wenxin Operations (V1 Baseline)

> Status: **Approved**. Source of truth for module structure, navigation, roles, and dashboard architecture.
> Scope: architecture/IA only. No UI or code is defined here.

## Roles

Requested roles → live `StaffRole` enum mapping (keep stored values; relabel in UI; add `delivery`):

| Product role | Enum value | Notes |
|---|---|---|
| Owner / Admin | `owner` | Full access |
| Supervisor | `manager` | Display rename only (do NOT change stored value) |
| Front Crew | `front_desk` | Service · Packing · Customer handling · Counter support |
| Kitchen | `kitchen` | Production |
| Delivery | `delivery` (NEW) | Future-ready, minimal permissions (not yet in enum) |

## Finalized All Modules Structure (V1)

```
Operations               Bento · Bookings · Dine-in · Customers
People                   Staff · Schedule · Attendance
Operations Control       Complaints · Incidents · Tasks · Checklist
Inventory & Procurement  Inventory · Purchase · Suppliers
Assets & Cash            Assets · Cashier
Business                 Finance · Reports
System & Personal        Me/Profile (all) · Settings (owner) · Audit Log · All-Modules
```

Decisions baked in:
- **Maintenance** is NOT a module → handled via **Incidents** (`Incident Type = Asset / Maintenance`).
- **Announcements** is NOT a module → future via Notifications.
- **Outlet Management** is future scope; `outlet_id` + permission scope concepts are included in the architecture now to avoid future migrations.
- **Checklist** and **Cashier** are required V1 modules.

## Module Registry

`status`: 🟢 live · 🟡 build (V1) · 🔵 future.

| moduleId | Name | Group | Route | Required perm | Status |
|---|---|---|---|---|---|
| bento | Bento | Operations | /bento | VIEW_BENTO | 🟢 |
| bookings | Bookings | Operations | /reservations | VIEW_BOOKINGS | 🟢 |
| dine_in | Dine-in | Operations | /dine-in | VIEW_DINEIN | 🟢 |
| customers | Customers | Operations | /bento/customers | VIEW_CUSTOMERS | 🟢 (elevate) |
| staff | Staff | People | /staff/accounts | MANAGE_STAFF_ACCOUNTS | 🟢 |
| schedule | Schedule | People | /staff | VIEW_SCHEDULE | 🟢 |
| attendance | Attendance | People | /attendance | (self) | 🟡 |
| complaints | Complaints | Ops Control | /complaints | VIEW_COMPLAINTS | 🟢 |
| incidents | Incidents | Ops Control | /incidents | VIEW_INCIDENTS | 🟢 |
| tasks | Tasks | Ops Control | /tasks | VIEW_TASKS | 🟢 |
| checklist | Checklist | Ops Control | /checklist | VIEW_CHECKLIST | 🟡 |
| inventory | Inventory | Inventory&Proc | /inventory | VIEW_INVENTORY | 🟢 |
| purchase | Purchase | Inventory&Proc | /purchase | VIEW_PURCHASE | 🟢 |
| suppliers | Suppliers | Inventory&Proc | /suppliers | VIEW_SUPPLIERS | 🟢 (upgrade) |
| assets | Assets | Assets&Cash | /assets | VIEW_ASSETS | 🟡 |
| cashier | Cashier | Assets&Cash | /cashier | VIEW_CASHIER_* | 🟡 |
| finance | Finance | Business | /finance | VIEW_FINANCE | 🟢 |
| reports | Reports | Business | /reports | VIEW_REPORTS | 🟢 |
| profile | Me | System | /profile | (all) | 🟢 |
| all_modules | All Modules | System | /all | (all) | 🟢 |

Current placeholder pages (V1 build pending): `/attendance`, `/checklist`, `/assets`, `/cashier`.

## Four Separated Layers (keep independent)

1. **Modules** — what exists (registry above).
2. **Permissions** — who may access/act (capability keys; roles = bundles). The only access gate. See `permission-matrix.md`.
3. **Dashboard Widgets** — data surfaces, each gated by a permission, sourced from a module.
4. **Navigation/Placement** — (a) nav membership derived from permissions; (b) prominence (hero/kpi/quick) from per-role Dashboard Profile. Prominence changes never change access.

## Dashboard Widget Registry

| widgetId | Title | Source | Required perm | Size |
|---|---|---|---|---|
| revenue_today | Revenue (carousel) | finance/cashier | VIEW_REPORTS | hero |
| cashier_status | Cash close status / variance | cashier | VIEW_CASHIER_* | section/kpi |
| kpi_bookings | Reservations today | bookings | VIEW_BOOKINGS | kpi |
| kpi_complaints | Complaints | complaints | VIEW_COMPLAINTS | kpi |
| kpi_incidents | Incidents | incidents | VIEW_INCIDENTS | kpi |
| kpi_tasks | Tasks/Approvals | tasks | VIEW_TASKS | kpi |
| todays_issues | Low stock + attendance | inventory/attendance | VIEW_INVENTORY | section |
| shift_board | Today's staffing | schedule | VIEW_SCHEDULE | section |
| prep_list | Kitchen prep | bento | VIEW_BENTO | hero/section |
| delivery_runs | Today's deliveries | delivery | VIEW_DELIVERY | hero/section |
| my_schedule / attendance_checkin / my_tasks | Personal | schedule/attendance/tasks | *_SELF | section/kpi |
| quick_access | Launcher | — | — | quick |

## Dashboard Profiles by Role

| Role | Hero | KPI row | Sections | Quick Access |
|---|---|---|---|---|
| Owner | revenue_today | bookings · complaints · incidents · tasks | todays_issues · shift_board · cashier_status | inventory · finance · customers · reports · suppliers · all |
| Supervisor | revenue_today | tasks(approvals) · complaints · incidents · attendance | todays_issues · shift_board · pending_approvals | purchase · inventory · schedule · cashier · complaints · all |
| Front Crew | cashier_status | bookings · dine_in · complaints · my_tasks | my_schedule · attendance_checkin | bookings · customers · cashier · complaints · all |
| Kitchen | prep_list | bento · low_stock · my_tasks · incidents | checklist · attendance_checkin | inventory · purchase · bento · checklist · all |
| Delivery (future) | delivery_runs | my_runs · bento_to_deliver · my_tasks · incidents | my_schedule · attendance_checkin | delivery · customers · all |

Principle demonstrated: a module can be a small Quick Access item for one role and a hero card for another (e.g. Cashier = hero for Front Crew, section for Supervisor; Inventory = quick for Owner, near-hero for Kitchen).

## Scalability

- **Multi-outlet:** add `outlet_id` to operational tables + `@outlet/@org` permission scope + per-outlet role assignment now (slots), even if unused while single-outlet.
- **Delivery / Payroll / POS / Maintenance:** future nodes; designed-for, not built (see permission-matrix + cashier docs).

## Risks / Next Steps

- Access is currently route+role hardcoded (`lib/auth/permissions.ts`). Migrate to a permission-key layer (`ROLE_PERMISSIONS` + `hasPermission`) before building new modules — zero behavior change if derived sets == current rules.
- Recommended build order: **Permission layer (prereq) → Cashier → Checklist → Attendance → Suppliers (upgrade) → Assets**.
