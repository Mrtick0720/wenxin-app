# Wenxin Assets Module — Product Specification

**Date:** 2026-06-08
**Status:** Draft, pending review
**Depends on:** Staff Authentication (approved, implemented)

## 1. Goal

Add a standalone Assets module to track operational equipment and company-owned assets. When a freezer breaks down or a receipt printer needs repair, staff need to quickly identify the asset, check its warranty status, and link the issue to an incident. Currently there is no asset registry — equipment issues are tracked ad-hoc through incident titles.

Assets is a peer module under the **Assets & Cash** category:

```
Assets & Cash
  ├── Assets    ← NEW
  └── Cashier
```

It is a standalone L2 module accessed from the Home dashboard Quick Access grid. No new BottomNav tab is added.

The first version must provide:

- Asset registry with asset code (internal ID), name, category, description, serial number, and location
- Asset categories: POS, Printer, Kitchen Equipment, Refrigeration, Networking, Furniture, Other
- Purchase tracking: purchase date, purchase price, warranty expiry date
- Four-tier status management: Active, Under Repair, Retired, Disposed
- Warranty expiry visibility — assets with expired or soon-to-expire warranties are flagged
- Incident linkage — the existing `incidents` table gains an optional `asset_id` foreign key
- Task linkage — the existing `tasks` table gains an optional `asset_id` foreign key
- Asset detail view with linked incidents and tasks
- Quick Access card on Home dashboard
- Multi-outlet support via `outlet_id`
- Audit logging of asset record changes

All visible App text remains English.

## 2. Scope

### Included

- Asset CRUD (create, read, update) — Owner and Manager
- Asset categories via enum (POS, printer, kitchen_equipment, refrigeration, networking, furniture, other)
- Asset status lifecycle: Active → Under Repair → Active, Active → Retired, Retired → Disposed
- Warranty expiry date per asset with visual flagging (expired, expiring within 30 days)
- Asset location field (e.g., "Kitchen", "Counter", "Office", "Store Room")
- Purchase date and purchase price for reference
- Serial number for identification
- `asset_id` foreign key added to `incidents` (nullable)
- `asset_id` foreign key added to `tasks` (nullable)
- Asset detail view showing linked incidents and tasks
- Asset list with search by name, filter by category, filter by status
- Quick Access card on Home dashboard
- Row Level Security matching the four-role model
- Audit logging via existing `write_operational_audit()` trigger

### Deferred

- Maintenance scheduling and work orders (handled through Incidents + Tasks in v1)
- Preventive maintenance calendar
- Maintenance history beyond incident/task linkage
- Asset depreciation tracking
- Asset transfer between outlets
- Barcode/QR code scanning for asset identification
- Asset check-in/check-out (staff borrowing equipment)
- Maintenance vendor management
- Spare parts inventory
- Asset inspection checklists (future Checklist module integration)
- Automated warranty expiry notifications

## 3. Module Hierarchy

```
Assets & Cash
  ├── Assets    (/assets)   ← NEW
  └── Cashier   (/cashier, future)
```

Assets is accessed via:

- **Quick Access** card on the Home dashboard (`/assets`)
- **Direct URL** (route-protected by `proxy.ts` and `requireCurrentStaff()`)
- **Cross-reference** from Incident detail (asset name links to asset detail)

No new BottomNav tab. The existing five tabs remain unchanged.

## 4. Business Rules

### BR-1: Asset Code and Name Uniqueness
Asset codes must be unique within an outlet. The unique constraint is on `(outlet_id, asset_code)`. Asset names should also be unique within an outlet, with a unique constraint on `(outlet_id, name)`. This prevents duplicate asset records and ensures each asset has a distinct internal identifier for labeling.

### BR-2: Status Transitions
- **Active → Under Repair**: Asset has an issue and is being fixed. Linked incidents remain open. The asset is flagged with an orange "Under Repair" badge.
- **Under Repair → Active**: Repair complete. Asset returns to normal operation. Associated incidents should be resolved.
- **Active → Retired**: Asset is no longer in use but still on premises. The asset is hidden from default views but visible in history.
- **Retired → Disposed**: Asset has been physically removed (sold, scrapped, returned). Terminal state. The asset is hidden from all default views; visible only in filtered history.
- **Disposed → (any)**: Not allowed. Disposed is terminal.
- **Retired → Active**: Allowed if the asset is put back into service.

### BR-3: Warranty Flagging
- Warranty is **expired** if `warranty_expiry < today`.
- Warranty is **expiring soon** if `warranty_expiry` is within 30 days of today.
- Warranty is **active** otherwise.
- These statuses are derived at query time, not stored.
- The asset list shows a warranty badge: green (active), orange (expiring soon), red (expired).

### BR-4: Incident and Task Linkage Is Optional
- Incidents and tasks may reference an asset via the `asset_id` foreign key. This is optional — most incidents and tasks will not be asset-related.
- When creating an incident, the user can optionally link it to an asset. This is useful for equipment failure incidents.
- The asset detail view shows all linked incidents and tasks, grouped by status.
- Deleting an asset sets `asset_id` to null on linked incidents and tasks (`ON DELETE SET NULL`).

### BR-5: No Automatic Incident Generation
Unlike the Checklist module (which auto-creates incidents from failed items), the Assets module does not auto-generate incidents or tasks. Staff manually create an incident and link it to the asset. This keeps the module simple and avoids duplicating Checklist's orchestration pattern.

### BR-6: Asset Categories Are Informational
Categories help with filtering and reporting. They do not enforce any business logic. The category enum can be extended via migration.

## 5. Asset Lifecycle & Status Model

### Statuses

| Status | Meaning | UI Behavior |
|--------|---------|-------------|
| `active` | In normal operation | Green badge. Appears in default views. |
| `under_repair` | Currently being repaired | Orange badge. Appears in default views with warning. |
| `retired` | No longer in use, still on premises | Gray badge. Hidden from default views; visible in filtered history. |
| `disposed` | Physically removed (sold, scrapped) | Dark gray badge. Hidden from all default views; visible only in "All" filter. Terminal state. |

### State Transitions

```
                    ┌──────────┐
                    │  active   │
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          │
        ┌──────────┐ ┌──────────┐   │
        │  under   │ │ retired   │   │
        │  repair  │ └────┬─────┘   │
        └────┬─────┘      │         │
             │            ▼         │
             │      ┌──────────┐    │
             │      │ disposed  │    │
             │      └──────────┘    │
             │       (terminal)     │
             └──────────────────────┘
```

- `active` → `under_repair`: Owner/Manager action. Asset has a problem.
- `under_repair` → `active`: Owner/Manager action. Repair complete.
- `active` → `retired`: Owner/Manager action. Asset no longer needed.
- `retired` → `active`: Owner/Manager action. Asset returned to service.
- `retired` → `disposed`: Owner/Manager action. Asset physically removed.
- `disposed` → (any): Not allowed. Terminal state.

### Who Can Change Status

| Action | Owner | Manager | Kitchen | Front Desk |
|--------|:-----:|:-------:|:-------:|:----------:|
| Create asset | Yes | Yes | No | No |
| Edit asset details | Yes | Yes | No | No |
| Change status (any) | Yes | Yes | No | No |
| View assets | Yes | Yes | Yes | Yes |

All staff can view assets because everyone uses equipment and needs to identify assets when reporting issues.

## 6. Asset Categories

| Category | `category` value | Examples |
|----------|-----------------|----------|
| POS | `pos` | POS terminal, card reader, customer display |
| Printer | `printer` | Receipt printer, kitchen printer, label printer |
| Kitchen Equipment | `kitchen_equipment` | Freezer, refrigerator, rice cooker, stove, oven |
| Refrigeration | `refrigeration` | Walk-in chiller, display fridge, ice maker |
| Networking | `networking` | Router, switch, access point, CCTV camera, tablet |
| Furniture | `furniture` | Tables, chairs, shelving, counter |
| Other | `other` | Any equipment not listed above |

Categories are stored as an enum on the `assets` table. The enum can be extended via migration. Categories are used for filtering in the asset list view.

## 7. Asset Profiles

### Required Fields
- **Asset Code**: Internal identifier (e.g., `FRZ-01`, `PRN-02`). Unique per outlet. Used for labeling and quick identification.
- **Name**: Asset name (e.g., "Kitchen Freezer #1", "Counter POS Terminal")
- **Category**: Enum value from the categories list
- **Status**: `active`, `under_repair`, `retired`, or `disposed`

### Optional Fields
- **Description**: Brief description of the asset
- **Serial Number**: Manufacturer serial number for identification
- **Location**: Where the asset is located (e.g., "Kitchen", "Counter", "Office")
- **Purchase Date**: Date of purchase
- **Purchase Price**: Purchase price in RM
- **Warranty Expiry**: Date the warranty expires (if applicable)
- **Notes**: Free-text notes

### Display Labels
- The asset list shows: asset code, name, category, location, status badge, warranty badge
- The asset detail shows: asset code, all profile fields, linked incidents section, linked tasks section

## 8. Warranty Tracking

### Warranty Status (Derived)

| Condition | Badge |
|-----------|-------|
| No warranty expiry set | No badge shown |
| `warranty_expiry >= today + 30 days` | Green "Warranty Active" |
| `warranty_expiry < today + 30 days AND >= today` | Orange "Warranty Expiring" |
| `warranty_expiry < today` | Red "Warranty Expired" |

### Warranty Display
- Asset list: warranty badge shown next to status badge
- Asset detail: warranty expiry date displayed with status badge
- Assets with expired warranties sort to the top of the list (secondary sort after status)
- No automated notifications in v1

## 9. Incident & Task Integration

### Incident Linkage
- A new nullable `asset_id` column is added to the `incidents` table (`ON DELETE SET NULL`).
- When creating or editing an incident, the user can optionally select an asset from a dropdown.
- The asset detail view shows linked incidents grouped by status (open, handling, resolved).
- The incident detail view shows the linked asset name as a tappable link to the asset detail.

### Task Linkage
- A new nullable `asset_id` column is added to the `tasks` table (`ON DELETE SET NULL`).
- When creating or editing a task, the user can optionally select an asset.
- The asset detail view shows linked tasks grouped by status (pending, processing, done).

### Checklist Integration (Future)
When the Checklist module supports asset references on template items, inspection checklists can include specific assets. A future migration adds `asset_id` to `checklist_template_items` or `checklist_item_responses`. This is deferred.

## 10. Reporting

### Asset List View (`/assets`)
- Search by name, serial number, location
- Filter by category
- Filter by status (active, under_repair, retired, disposed)
- Sort by name, status (active first), warranty expiry (expired first)
- Each row shows: name, category, location, status badge, warranty badge

### Asset Detail View (`/assets/[id]`)
- Profile section: all fields, "Edit" button (Owner/Manager)
- Warranty section: expiry date with status badge
- Linked Incidents section: list with status, date, title; tap to open incident
- Linked Tasks section: list with status, date, title; tap to open task

### Home Dashboard
- Quick Access card: "Assets" with active asset count
- Today's Issues: assets under repair appear as informational items

## 11. User Interface

### Asset List (`/assets` — default view)
- Search bar at top
- Category filter: dropdown or horizontal scroll chips
- Status filter tabs: All, Active, Under Repair, Retired, Disposed
- Asset cards: name, category label, location, status badge, warranty badge
- FAB or header "+" button to create new asset (Owner/Manager)
- Tap card → push `/assets/[id]`

### Asset Detail (`/assets/[id]`)
- Header: asset name, status badge, back button
- Profile card: all fields, "Edit" button (Owner/Manager)
- Warranty card: expiry date, warranty status badge
- Linked Incidents card: list grouped by status, "Create Incident" link
- Linked Tasks card: list grouped by status, "Create Task" link

### Create/Edit Asset
- Bottom sheet or modal form
- Required: asset code, name, category
- Optional: description, serial number, location, purchase date, purchase price, warranty expiry, notes
- After create: navigate to detail view

## 12. Error Handling

- **Duplicate asset code**: "An asset with this code already exists."
- **Duplicate name**: "An asset with this name already exists."
- **Invalid status transition to disposed**: Not applicable — all non-terminal transitions are allowed.
- **Cannot change disposed asset**: "Disposed assets cannot be modified. This asset was disposed on {date}."
- **Delete asset with linked incidents/tasks**: Allowed. The `asset_id` on linked records is set to null (`ON DELETE SET NULL`). Show confirmation: "This asset has X linked incidents and Y linked tasks. Deleting it will unlink them."

## 13. Testing & Acceptance

Automated tests cover:

- Asset CRUD operations with validation
- Status transitions (all valid paths, disposed immutability)
- Warranty status derivation (expired, expiring, active, not set)
- Permission checks (Owner/Manager full access, Kitchen/Front Desk view-only)
- Asset code and name uniqueness enforcement
- Incident and task linkage integrity (FK constraint, SET NULL on delete)

Integration checks:

- Owner creates asset → appears in asset list with correct status
- Asset status changed to "Under Repair" → badge updates, linked incident can reference it
- Asset linked to incident → incident appears in asset detail
- Asset deleted → linked incident's `asset_id` is nullified
- Warranty expiry date set → warranty badge shows correct derived status
- RLS prevents Kitchen/Front Desk from editing assets
- RLS allows Kitchen/Front Desk to view assets
- Audit log captures all asset changes

## 14. Rollout

Phase one launches the asset registry with CRUD, status lifecycle, warranty tracking, and incident/task linkage. Phase two adds maintenance scheduling, preventive maintenance calendar, and barcode scanning. Checklist integration is deferred until the Checklist module supports asset references on template items.
