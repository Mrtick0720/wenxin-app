# Wenxin Suppliers Module — Product Specification

**Date:** 2026-06-08
**Status:** Draft, pending review
**Depends on:** Staff Authentication (approved, implemented)

## 1. Goal

Add a standalone Suppliers module to centralize supplier information. Currently, the Purchase module uses a free-text `supplier` field on each purchase item — there is no shared supplier record. This module replaces that fragmented approach with a single source of truth for every supplier the restaurant buys from. It is a supplier directory, not a procurement analytics system.

Suppliers is a peer module under the **Inventory & Procurement** category:

```
Inventory & Procurement
  ├── Inventory
  ├── Purchase
  └── Suppliers  ← NEW
```

It is a standalone L2 module accessed from the Home dashboard Quick Access grid. No new BottomNav tab is added.

The first version must provide:

- Supplier profiles with company name, contact person, phone, WhatsApp, email, and address
- Multiple contacts per supplier (e.g., sales rep, delivery contact, accounts)
- Payment terms per supplier (COD, net 15, net 30, etc.)
- Three-tier status management: Active, Inactive, Suspended
- Purchase history visibility — all purchase items linked to a supplier are viewable from the supplier detail
- Integration with Purchase module via `supplier_id` foreign key
- Multi-outlet support via `outlet_id`
- Audit logging of supplier record changes

All visible App text remains English.

## 2. Scope

### Included

- Supplier CRUD (create, read, update) — Owner and Manager
- Supplier contact management (add, edit, remove contacts)
- Supplier status management: Active ↔ Inactive, Active → Suspended
- Supplier list with search and filter by status
- Supplier detail view with contacts and recent purchases
- Purchase history: all purchase items from this supplier, grouped by date
- `supplier_id` foreign key added to `purchase_items` (nullable, coexists with existing free-text `supplier` field)
- Quick Access card on Home dashboard
- Row Level Security matching the four-role model
- Audit logging via existing `write_operational_audit()` trigger

### Deferred

- Supplier product catalog (which products each supplier provides, unit prices, lead times)
- Preferred supplier flagging per product
- Supplier performance tracking (on-time delivery rate, order frequency, total spend analytics)
- Supplier scoring and ranking
- Supplier price history and trend charts
- Supplier payment tracking and accounts payable
- Supplier contract document uploads
- Supplier self-service portal
- Supplier rating and review workflow
- Automated purchase order generation from preferred suppliers
- Bulk product catalog import
- Supplier certification and compliance tracking
- Delivery schedule management

## 3. Module Hierarchy

```
Inventory & Procurement
  ├── Inventory   (/inventory)
  ├── Purchase    (/purchase)
  └── Suppliers   (/suppliers)  ← NEW
```

Suppliers is accessed via:

- **Quick Access** card on the Home dashboard (`/suppliers`)
- **Direct URL** (route-protected by `proxy.ts` and `requireCurrentStaff()`)
- **Cross-reference** from Purchase item detail (supplier name links to supplier detail)

No new BottomNav tab. The existing five tabs remain unchanged.

## 4. Business Rules

### BR-1: Supplier Name Uniqueness
Supplier names must be unique within an outlet. The unique constraint is on `(outlet_id, name)`. This prevents duplicate supplier records while allowing the same supplier name across different outlets in the future.

### BR-2: Status Transitions
- **Active → Inactive**: A supplier no longer used. Existing purchase references are preserved. The supplier does not appear in default dropdowns but is searchable in history.
- **Active → Suspended**: A supplier temporarily blocked (quality issues, payment disputes). Existing purchase references are preserved. The supplier is flagged with a warning in the UI.
- **Inactive → Active**: Re-activation is allowed at any time.
- **Suspended → Active**: Unsuspension is allowed by Owner or Manager.
- There is no hard delete in v1. Soft-delete (status change) is the standard.

### BR-3: At Least One Primary Contact
Every Active supplier must have at least one contact marked `is_primary = true`. The UI enforces this on creation. Inactive and Suspended suppliers may have zero contacts.

### BR-4: Purchase History Is Read-Only
Purchase history displayed on the supplier detail is derived from `purchase_items WHERE supplier_id = <id>`. It cannot be edited from the Suppliers module. To modify a purchase record, the user navigates to the Purchase module.

### BR-5: Payment Terms Are Informational
Payment terms (COD, net 15, net 30, net 60) are stored as a display value. They do not trigger any automated payment workflow in v1. Finance integration is deferred.

## 5. Supplier Lifecycle & Status Model

### Statuses

| Status | Meaning | UI Behavior |
|--------|---------|-------------|
| `active` | Currently engaged, available for new purchases | Appears in all supplier dropdowns and search |
| `inactive` | No longer used, historical reference only | Hidden from default dropdowns; appears in filtered search and history |
| `suspended` | Temporarily blocked | Hidden from dropdowns; flagged with orange warning badge in search results |

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
        │ inactive  │ │suspended │   │
        └────┬─────┘ └────┬─────┘   │
             │            │          │
             └────────────┘──────────┘
                         │
                         ▼
                    ┌──────────┐
                    │  active   │  (re-activated)
                    └──────────┘
```

- `active` → `inactive`: Owner/Manager action. Used when a supplier is no longer engaged.
- `active` → `suspended`: Owner/Manager action. Used for temporary blocks.
- `inactive` → `active`: Owner/Manager action. Re-engagement.
- `suspended` → `active`: Owner/Manager action. Block lifted.
- `inactive` → `suspended`: Allowed (a supplier can be suspended even if previously marked inactive).
- `suspended` → `inactive`: Allowed.

### Who Can Change Status

| Action | Owner | Manager | Kitchen | Front Desk |
|--------|:-----:|:-------:|:-------:|:----------:|
| Create supplier | Yes | Yes | No | No |
| Edit supplier details | Yes | Yes | No | No |
| Change status (any) | Yes | Yes | No | No |
| Add/edit contacts | Yes | Yes | No | No |
| View suppliers | Yes | Yes | Yes | No |

Kitchen can view suppliers because they use the Purchase module and need to reference supplier information when creating purchase items.

## 6. Supplier Profiles

### Required Fields
- **Name**: Company or individual name (unique per outlet)
- **Status**: `active`, `inactive`, or `suspended`
- **Contact Person**: Primary contact name (denormalized from contacts for quick display)

### Optional Fields
- **Phone**: Primary phone number
- **WhatsApp**: WhatsApp number (may be same as phone)
- **Email**: Primary email address
- **Address**: Physical or mailing address
- **Payment Terms**: Display value (COD, net 15, net 30, net 60, other)
- **Notes**: Free-text notes about the supplier relationship

### Display Labels
- The supplier list shows: name, contact person, phone, status badge, last purchase date
- The supplier detail shows: all profile fields, contacts section, recent purchases section

## 7. Supplier Contacts

A supplier can have zero or more contacts. Each contact represents a person at the supplier organization.

### Contact Fields
- **Name**: Contact person's full name
- **Role**: Their role (e.g., "Sales Representative", "Delivery Coordinator", "Accounts")
- **Phone**: Direct phone number
- **Email**: Direct email address
- **Is Primary**: Boolean flag. Exactly one contact per Active supplier must be primary.

### Contact Rules
- An Active supplier must have at least one primary contact.
- If the primary contact is removed, another contact must be promoted to primary (enforced in the server action).
- Contacts are displayed in the supplier detail view as a list with edit/delete actions.
- Contact changes are audit-logged.

## 8. Purchase History Integration

### Current State
The `purchase_items` table has a free-text `supplier` column (nullable). There is no foreign key to a suppliers table.

### Integration Approach
1. A new nullable `supplier_id` column is added to `purchase_items` referencing `suppliers(id) ON DELETE SET NULL`.
2. The existing `supplier` text column is preserved. Existing data is unchanged.
3. When creating a purchase item, the Purchase module can set `supplier_id` from the supplier dropdown.
4. The supplier detail view queries: `SELECT * FROM purchase_items WHERE supplier_id = <id> ORDER BY date DESC, id DESC`.
5. For backward compatibility, purchase items without a `supplier_id` but with a `supplier` text value are displayed in a "Legacy (unlinked)" section.
6. A future data migration can match existing `supplier` text values to `suppliers.name` and backfill `supplier_id`.

## 10. Reporting

### Supplier List View (`/suppliers`)
- Search by name, contact person, phone
- Filter by status (active, inactive, suspended)
- Sort by name, last order date
- Each row shows: name, contact person, status badge, last order date

### Supplier Detail View (`/suppliers/[id]`)
- Profile section: all fields, editable inline
- Contacts section: list with add/edit/remove
- Recent purchases section: last 30 purchase items, grouped by date

### Home Dashboard
- Quick Access card: "Suppliers" with active supplier count badge
- No Today's Issues integration (suppliers are operational reference data, not daily tasks)

## 11. User Interface

### Supplier List (`/suppliers` — default view)
- Search bar at top
- Status filter tabs: All, Active, Inactive, Suspended
- Supplier cards: name, contact person, phone, status badge, last order date
- FAB or header "+" button to create new supplier (Owner/Manager)
- Tap card → push `/suppliers/[id]`

### Supplier Detail (`/suppliers/[id]`)
- Header: supplier name, status badge, back button
- Profile card: all fields, "Edit" button (Owner/Manager)
- Contacts card: list of contacts, primary badge, add/edit/remove (Owner/Manager)
- Recent Purchases card: date-grouped list of purchase items with amounts

### Create/Edit Supplier
- Bottom sheet or modal form
- Required: name
- Optional: contact person, phone, WhatsApp, email, address, payment terms, notes
- After create: navigate to detail view to add contacts

## 12. Error Handling

- **Duplicate name**: "A supplier with this name already exists."
- **No primary contact**: "An active supplier must have a primary contact." (on deactivation: allowed)
- **Cannot delete supplier with purchase history**: Soft-delete only (change status to Inactive). Show: "This supplier has purchase history. Mark it as Inactive instead."
- **Invalid status transition**: Not applicable — all transitions are allowed in v1.

## 13. Testing & Acceptance

Automated tests cover:

- Supplier CRUD operations with validation
- Status transitions (active ↔ inactive, active ↔ suspended)
- Contact management (add, edit, remove, primary promotion)
- Permission checks (Kitchen view-only, Front Desk no access)

Integration checks:

- Owner creates supplier → appears in Purchase module dropdown
- Purchase item linked to supplier → appears in supplier detail "Recent Purchases"
- Supplier status changed to Inactive → hidden from Purchase dropdown but visible in search
- Supplier marked as preferred for a product → Purchase module highlights it
- RLS prevents Kitchen from editing supplier records
- RLS prevents Front Desk from viewing suppliers
- Audit log captures all supplier and contact changes

## 14. Rollout

Phase one launches supplier CRUD, contacts, and purchase history display. Phase two adds supplier product catalog, preferred supplier flagging, performance analytics, payment tracking, and automated purchase order suggestions.

The existing Purchase module's free-text `supplier` field is preserved. The `supplier_id` FK is added but optional — existing purchase items continue to work without migration.
