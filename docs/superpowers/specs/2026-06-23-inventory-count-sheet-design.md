# Inventory Count Sheet — Design Spec

**Date:** 2026-06-23
**Scope:** Allow owner / manager / kitchen / front_desk to enter real counted quantities, update stock levels atomically, and record a `stock_check` audit trail — without any stock editing, stock-in, stock-out, adjustment, or item management flows.

---

## Business Context

Inventory v1 is a read-only dashboard. `last_counted_at` drives the `need_count` status but there is no way to update it from the app. This spec adds the Count Sheet — the only mechanism for staff to record counted quantities and clear `need_count` status.

Primary risk this addresses: imported Chinese sauces running out before the next sea shipment. Regular counts keep `last_counted_at` fresh and ensure `need_reorder` / `need_count` statuses are accurate.

---

## Out of Scope (this version)

- Stock In / Stock Out / Usage deduction
- Purchase receiving integration
- Manual adjustment flow (inventory_adjustments table)
- Delete or create inventory items
- Expiry tracking
- Tappable Need Count cards (informational only in this version)

---

## Permission Model

Enforced at **two layers**: server action (pre-RPC) AND inside the RPC itself. The RPC must not rely solely on the server action because it is directly executable by any `authenticated` user.

```
owner      → Fresh · Sauces · Dry Goods · Drinks · Packaging · Supplies
manager    → Fresh · Sauces · Dry Goods · Drinks · Packaging · Supplies
kitchen    → Fresh · Sauces · Dry Goods · Packaging · Supplies  (NOT Drinks)
front_desk → Drinks · Packaging  (NOT Fresh / Sauces / Dry Goods / Supplies)
```

The client **must not write to Supabase directly**. All count writes must go through `saveCountAction`, which calls the `save_inventory_count` RPC. The RPC is the only path that can update stock levels and insert movements for count operations.

---

## Data Model

### No new tables. No new columns on existing tables.

All writes stay within the existing schema. The `inventory_adjustments` table is **not used** for count sheet.

### Existing columns used by Count Sheet

**`inventory_stock_levels`** (updated on save):
- `current_quantity` — new counted total
- `opened_quantity` — updated for Sauces only; left unchanged for all other categories
- `last_counted_at` — set to `now()` for every counted item
- `last_updated_at` — set to `now()` for every counted item

**`inventory_movements`** (one row inserted per counted item, even if delta = 0):
- `movement_type = 'stock_check'`
- `quantity` — signed delta (`new_quantity − previous_quantity`), can be 0 or negative
- `previous_quantity` — read from DB inside RPC, never trusted from client
- `new_quantity` — submitted count
- `created_by` — `staff_profiles.id` derived inside RPC from `auth.uid()`, never passed by client
- `notes` — `'Count sheet: [category]'`

### Schema changes (one new migration)

**`supabase/migrations/20260623_inventory_count_rls.sql`** adds:

1. **Fix front_desk SELECT access** (v1 gap — front_desk was added to `requireRole` in the action but the RLS policies never included them):
   ```sql
   create policy inventory_items_frontdesk_read on public.inventory_items
     for select to authenticated
     using (public.staff_role_is(array['front_desk']));

   create policy inventory_stock_levels_frontdesk_read on public.inventory_stock_levels
     for select to authenticated
     using (public.staff_role_is(array['front_desk']));
   ```

2. **`save_inventory_count` Postgres function** (see full spec below).

3. **Grant execute** to `authenticated`:
   ```sql
   grant execute on function public.save_inventory_count(jsonb, text) to authenticated;
   ```

No new UPDATE policies on `inventory_stock_levels`. No new INSERT policies on `inventory_movements`. The `security definer` function bypasses RLS for its writes — the function itself is the controlled write path.

---

## RPC Function Spec

### `public.save_inventory_count(p_entries jsonb, p_category text)`

**Language:** PL/pgSQL  
**Security:** `SECURITY DEFINER` with `SET search_path = public`  
**Called by:** `saveCountAction` server action only  
**Atomicity:** The entire batch succeeds or fails — PL/pgSQL functions run in an implicit transaction

### Input

`p_entries` — JSON array, one object per item:
```json
[
  { "item_id": 1, "new_quantity": 3, "opened_quantity": 1 },
  { "item_id": 2, "new_quantity": 0 }
]
```

`opened_quantity` is only meaningful for Sauces. The RPC ignores it for all other categories.

`p_category` — the category string being counted (e.g. `'Sauces'`). All submitted items must belong to this category.

### Execution steps (inside the function body)

**Step 1 — Identify caller:**
```sql
select id, role, status
into v_staff_id, v_role, v_staff_status
from public.staff_profiles
where id = auth.uid();

if not found or v_staff_status != 'active' then
  raise exception 'No active staff profile found';
end if;
```

**Step 2 — Validate role is permitted to count this category:**
```sql
if not (
  v_role in ('owner', 'manager')
  or (v_role = 'kitchen'    and p_category in ('Fresh','Sauces','Dry Goods','Packaging','Supplies'))
  or (v_role = 'front_desk' and p_category in ('Drinks','Packaging'))
) then
  raise exception 'Role % cannot count category %', v_role, p_category;
end if;
```

**Step 3 — Loop through entries:**

For each entry object in `p_entries`:

```
a. Parse item_id, new_quantity, opened_quantity from JSON

b. Reject if new_quantity < 0
   → raise exception 'Quantity cannot be negative'

c. Verify item exists, is active, and belongs to p_category
   → SELECT category FROM inventory_items WHERE id = item_id AND status = 'active'
   → raise exception if not found or category != p_category

d. Read previous_quantity from inventory_stock_levels
   → SELECT current_quantity INTO v_prev_qty FROM inventory_stock_levels
      WHERE item_id = v_item_id AND outlet_id = DEFAULT_OUTLET_ID
   → v_prev_qty defaults to 0 if no stock level row exists

e. If p_category = 'Sauces':
   → Reject if opened_quantity < 0
   → Reject if opened_quantity > new_quantity
   → UPDATE inventory_stock_levels
        SET current_quantity = new_quantity,
            opened_quantity  = opened_quantity,
            last_counted_at  = now(),
            last_updated_at  = now()
        WHERE item_id = v_item_id

   Else (all other categories):
   → UPDATE inventory_stock_levels
        SET current_quantity = new_quantity,
            last_counted_at  = now(),
            last_updated_at  = now()
        WHERE item_id = v_item_id
        -- opened_quantity is NOT touched

f. INSERT INTO inventory_movements
     (item_id, outlet_id, movement_type,
      quantity, previous_quantity, new_quantity,
      created_by, notes)
   VALUES
     (v_item_id, DEFAULT_OUTLET_ID, 'stock_check',
      new_quantity - v_prev_qty,  -- signed delta, can be 0 or negative
      v_prev_qty,
      new_quantity,
      v_staff_id,                 -- derived from auth.uid(), never from client
      'Count sheet: ' || p_category)
```

Movement is inserted **for every item**, including items where `quantity − previous_quantity = 0`. This is intentional — it proves the item was counted and records who counted it.

---

## Server Action Spec

### `app/inventory/count-actions.ts`

Two exported functions:

**`fetchCountItemsAction(category: string)`**
- Calls `requireRole('owner', 'manager', 'kitchen', 'front_desk')`
- Validates `CATEGORY_COUNT_PERMISSIONS[role].includes(category)` — returns error if not
- Queries `inventory_items JOIN inventory_stock_levels` for active items in `category`
- Returns `CountItem[]` — id, name, unit, category, currentQuantity, openedQuantity
- Used to populate the Count Sheet item list

**`saveCountAction(entries: CountEntry[], category: string)`**
- Calls `requireRole('owner', 'manager', 'kitchen', 'front_desk')`
- Validates `CATEGORY_COUNT_PERMISSIONS[role].includes(category)` — returns error if not
- Validates each entry: `new_quantity >= 0`; for Sauces: `opened_quantity <= new_quantity`
- Calls `supabase.rpc('save_inventory_count', { p_entries: entries, p_category: category })`
- Returns `{ ok: true }` or `{ ok: false, error: string }`

### Types

```typescript
// lib/inventory/types.ts additions

export type CountItem = {
  id: number
  name: string
  unit: string
  category: string
  currentQuantity: number
  openedQuantity: number   // 0 for non-sauce items
}

export type CountEntry = {
  item_id: number
  new_quantity: number
  opened_quantity: number  // ignored by RPC for non-sauce categories
}
```

### Permission helper

```typescript
// lib/inventory/permissions.ts

export const CATEGORY_COUNT_PERMISSIONS: Record<string, string[]> = {
  owner:      ['Fresh', 'Sauces', 'Dry Goods', 'Drinks', 'Packaging', 'Supplies'],
  manager:    ['Fresh', 'Sauces', 'Dry Goods', 'Drinks', 'Packaging', 'Supplies'],
  kitchen:    ['Fresh', 'Sauces', 'Dry Goods', 'Packaging', 'Supplies'],
  front_desk: ['Drinks', 'Packaging'],
}

export function canCountCategory(role: string, category: string): boolean {
  return (CATEGORY_COUNT_PERMISSIONS[role] ?? []).includes(category)
}
```

---

## UX Flow

### Entry Point A — Floating "Count Stock" button

- Fixed position: bottom-right of Inventory page, above the bottom nav
- Visible to all roles with count permission (all four roles)
- Hidden for roles with no count categories (none — all four roles have at least one)
- Tapping opens `CountSheet` as a full-screen overlay (same stack push animation as other pages)
- The overlay starts on the **category selector screen**

### Entry Point B — "Count This Category" inside each category tab

- Rendered as a secondary button at the top of each category tab content
- Shown only for categories the current staff role is permitted to count
- Examples:
  - front_desk on Drinks tab: button shown ("Count Drinks")
  - front_desk on Fresh tab: button hidden
  - kitchen on Drinks tab: button hidden
  - owner on any tab: button shown
- Tapping opens `CountSheet` overlay pre-loaded with that category (skips category picker)

### CountSheet overlay — Screen 1: Category selector (Entry A only)

```
[×]  Count Stock

[ Fresh ]  [ Sauces ]  [ Dry Goods ]
[ Drinks ]  [ Packaging ]  [ Supplies ]
(only categories the current role can count are shown)
```

Tapping a category loads Screen 2.

### CountSheet overlay — Screen 2: Item list

```
[←]  [Category Name]

────────────────────────────────
Item name                  unit
Currently: 3 tubs
Total counted  [    3    ]
Opened         [    1    ]          ← Sauces only
Unopened: 2 tubs                    ← Sauces only, derived
────────────────────────────────
Item name                  unit
Currently: 0 kg
Total counted  [    0    ]
────────────────────────────────

              [ Save Count ]
```

- Inputs pre-filled with current quantities from DB
- Sauce items: two inputs (total + opened); all others: one input (total only)
- `Unopened` text is always derived, never an input
- Validation: `opened > total` → inline red error under opened input, Save button disabled
- Empty category: "No items in this category" message, Save button hidden

### After Save

**Success:**
- Overlay closes
- Inventory page data refetches (re-calls `fetchInventoryAction`)
- Toast: "Count saved — [Category]"
- Items that were counted now have fresh `last_counted_at` → `need_count` clears on refresh

**Error:**
- Red toast with error message (from `saveCountAction`'s `error` field)
- Overlay stays open — staff can correct and retry
- No partial data is committed (RPC rolls back on any failure)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260623_inventory_count_rls.sql` | Create | front_desk SELECT policies + `save_inventory_count` RPC + grant |
| `lib/inventory/types.ts` | Modify | Add `CountItem`, `CountEntry` types |
| `lib/inventory/permissions.ts` | Modify | Add `CATEGORY_COUNT_PERMISSIONS`, `canCountCategory()` |
| `app/inventory/count-actions.ts` | Create | `fetchCountItemsAction`, `saveCountAction` |
| `app/inventory/CountSheet.tsx` | Create | Full-screen overlay: category picker + item list + inputs |
| `app/inventory/page.tsx` | Modify | Add floating Count Stock button + Count This Category per tab |

No changes to navigation stack, BackButton, PageTransition, layout, or other modules.

---

## Error Handling Summary

| Scenario | Handling |
|---|---|
| RPC: no active staff profile | Raised exception → action returns error |
| RPC: role not permitted for category | Raised exception → action returns error |
| RPC: item_id not in category | Raised exception → entire batch rolls back |
| RPC: negative new_quantity | Raised exception → entire batch rolls back |
| RPC: opened > total (Sauces) | Raised exception → entire batch rolls back |
| Client: opened > total (Sauces) | Inline validation, Save disabled — never reaches server |
| Network failure | Action returns `{ ok: false, error }`, overlay stays open |
| Empty category | Count This Category button hidden; item list shows empty state |
