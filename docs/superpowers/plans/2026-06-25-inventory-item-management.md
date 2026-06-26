# Inventory Item Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let owner/manager add, edit, and archive inventory items through a mobile-first full-screen sheet, with per-item `track_opened` flag replacing the hardcoded Sauces category check.

**Architecture:** New `ItemSheet.tsx` portal (same pattern as `CountSheet.tsx`) handles both Add and Edit modes. New `manage-actions.ts` server actions enforce owner/manager-only writes. A DB migration adds `par_level` and `track_opened` columns and updates the `save_inventory_count` RPC to use per-item `track_opened` instead of hardcoding category='Sauces'. All existing count flow files are updated to thread `trackOpened` through.

**Tech Stack:** Next.js 16 App Router server actions · Supabase Postgres RLS · React portals · Tailwind CSS v4 · TypeScript

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260625_inventory_item_management.sql` | Create | Add `par_level`, `track_opened` columns; update RPC |
| `lib/inventory/types.ts` | Modify | Add `parLevel`, `trackOpened` to `InventoryItem`, `InventoryView`, `CountItem`; add `ItemCreateData`, `ItemUpdateData` |
| `lib/inventory/repository.ts` | Modify | `mapItemRow`, `createInventoryItem`, `updateInventoryItem` handle new fields |
| `lib/inventory/permissions.ts` | Modify | Add `canManageInventory()` |
| `app/inventory/count-actions.ts` | Modify | Select `track_opened` in fetch; validate opened_qty per-item not per-category |
| `app/inventory/CountSheet.tsx` | Modify | Use `item.trackOpened` instead of `category === 'Sauces'` |
| `app/inventory/actions.ts` | Modify | Pass `parLevel`, `trackOpened` through `InventoryView` |
| `app/inventory/manage-actions.ts` | Create | `createItemAction`, `updateItemAction`, `archiveItemAction` |
| `app/inventory/ItemSheet.tsx` | Create | Add/Edit full-screen portal |
| `app/inventory/page.tsx` | Modify | Add Item button, Edit button on cards, ItemSheet wiring |
| `scripts/seed-inventory-starter.sql` | Create | Starter seed for 25 items |

---

## Task 1: DB Migration — `par_level`, `track_opened`, updated RPC

**Files:**
- Create: `supabase/migrations/20260625_inventory_item_management.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260625_inventory_item_management.sql
-- ═══════════════════════════════════════════════════════════════════
-- Inventory Item Management — Schema additions + RPC update
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is idempotent;
-- create or replace updates the RPC.
-- Run AFTER 20260623_inventory_sauce_fields.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── New columns on inventory_items ──────────────────────────────────

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS par_level    numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS track_opened boolean       NOT NULL DEFAULT false;

-- Back-fill: existing Sauces items should track opened quantity
UPDATE public.inventory_items
SET track_opened = true
WHERE category = 'Sauces'
  AND track_opened = false;

-- ── Update save_inventory_count RPC ─────────────────────────────────
-- Change: use per-item track_opened flag (queried from DB) instead of
-- hardcoding `p_category = 'Sauces'`. This lets any item in any
-- category opt in to opened-quantity tracking.
-- p_category is still used for role permission checks.

create or replace function public.save_inventory_count(
  p_entries  jsonb,
  p_category text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id     uuid;
  v_role         text;
  v_is_active    boolean;
  v_entry        jsonb;
  v_item_id      bigint;
  v_new_qty      numeric;
  v_opened_qty   numeric;
  v_prev_qty     numeric;
  v_item_cat     text;
  v_track_opened boolean;
  c_outlet       constant uuid := '00000000-0000-0000-0000-000000000001';
begin

  select id, role, active
  into v_staff_id, v_role, v_is_active
  from public.staff_profiles
  where id = auth.uid();

  if not found or not v_is_active then
    raise exception 'No active staff profile found';
  end if;

  if not (
    v_role in ('owner', 'manager')
    or (v_role = 'kitchen'    and p_category in ('Fresh','Sauces','Dry Goods','Packaging','Supplies'))
    or (v_role = 'front_desk' and p_category in ('Drinks','Packaging'))
  ) then
    raise exception 'Role % is not permitted to count category %', v_role, p_category;
  end if;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    v_item_id    := (v_entry->>'item_id')::bigint;
    v_new_qty    := (v_entry->>'new_quantity')::numeric;
    v_opened_qty := coalesce((v_entry->>'opened_quantity')::numeric, 0);

    if v_new_qty < 0 then
      raise exception 'Quantity cannot be negative for item %', v_item_id;
    end if;

    select category, track_opened
    into v_item_cat, v_track_opened
    from public.inventory_items
    where id = v_item_id and status = 'active';

    if not found then
      raise exception 'Item % not found or inactive', v_item_id;
    end if;

    if v_item_cat != p_category then
      raise exception 'Item % does not belong to category %', v_item_id, p_category;
    end if;

    select current_quantity into v_prev_qty
    from public.inventory_stock_levels
    where item_id = v_item_id and outlet_id = c_outlet;

    v_prev_qty := coalesce(v_prev_qty, 0);

    if v_track_opened then
      if v_opened_qty < 0 then
        raise exception 'Opened quantity cannot be negative for item %', v_item_id;
      end if;
      if v_opened_qty > v_new_qty then
        raise exception 'Opened quantity exceeds total for item %', v_item_id;
      end if;
      update public.inventory_stock_levels
      set current_quantity = v_new_qty,
          opened_quantity  = v_opened_qty,
          last_counted_at  = now(),
          last_updated_at  = now()
      where item_id = v_item_id and outlet_id = c_outlet;
    else
      update public.inventory_stock_levels
      set current_quantity = v_new_qty,
          last_counted_at  = now(),
          last_updated_at  = now()
      where item_id = v_item_id and outlet_id = c_outlet;
    end if;

    if not FOUND then
      raise exception 'No stock level row for item %', v_item_id;
    end if;

    insert into public.inventory_movements
      (item_id, outlet_id, movement_type,
       quantity, previous_quantity, new_quantity,
       created_by, notes)
    values
      (v_item_id, c_outlet, 'stock_check',
       v_new_qty - v_prev_qty,
       v_prev_qty,
       v_new_qty,
       v_staff_id,
       'Count sheet: ' || p_category);

  end loop;
end;
$$;

grant execute on function public.save_inventory_count(jsonb, text) to authenticated;
```

- [ ] **Step 2: Apply to Supabase**

Paste the SQL above into the Supabase SQL Editor and run. Confirm: no errors, `\d inventory_items` shows `par_level` and `track_opened` columns.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260625_inventory_item_management.sql
git commit -m "feat(inventory): add par_level, track_opened columns; update RPC to use per-item track_opened"
```

---

## Task 2: Type Extensions

**Files:**
- Modify: `lib/inventory/types.ts`

- [ ] **Step 1: Replace `lib/inventory/types.ts`**

```typescript
// lib/inventory/types.ts
// ── Inventory Domain Types ──

export type InventoryItemStatus = 'active' | 'inactive' | 'discontinued'

export type MovementType =
  | 'purchase_receive'
  | 'manual_adjustment'
  | 'stock_check'
  | 'waste'
  | 'usage'
  | 'transfer_in'
  | 'transfer_out'

export type DisplayStatus = 'out' | 'low' | 'need_reorder' | 'need_count' | 'ok'

export type InventoryItem = {
  id: number
  outletId: string
  name: string
  category: string
  unit: string
  reorderLevel: number        // min stock / low-stock threshold (col: reorder_level)
  reorderPoint: number | null // sea-freight reorder trigger (col: reorder_point)
  parLevel: number | null     // target/ideal stock level (col: par_level)
  leadTimeDays: number | null
  location: string | null
  supplier: string | null
  trackOpened: boolean        // whether to show opened-qty tracking (col: track_opened)
  status: InventoryItemStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type InventoryStockLevel = {
  id: number
  itemId: number
  outletId: string
  currentQuantity: number
  openedQuantity: number
  onOrderQuantity: number
  lastCountedAt: string | null
  lastUpdatedAt: string
}

// Flat joined view used by the Inventory page — one object per item
export type InventoryView = {
  id: number
  name: string
  category: string
  unit: string
  notes: string | null
  // item config
  reorderLevel: number
  reorderPoint: number | null
  parLevel: number | null
  leadTimeDays: number | null
  location: string | null
  supplier: string | null
  trackOpened: boolean
  // stock
  currentQuantity: number
  openedQuantity: number
  onOrderQuantity: number
  lastCountedAt: string | null
  lastUpdatedAt: string | null
  // derived
  unopenedQuantity: number
  displayStatus: DisplayStatus
}

export type InventoryMovement = {
  id: number
  itemId: number
  outletId: string
  movementType: MovementType
  quantity: number
  previousQuantity: number
  newQuantity: number
  referenceType: string | null
  referenceId: number | null
  notes: string | null
  createdBy: string | null
  createdAt: string
}

export type InventoryAdjustment = {
  id: number
  itemId: number
  outletId: string
  previousQuantity: number
  adjustedQuantity: number
  reason: string
  createdBy: string
  createdAt: string
}

export type InventoryAction =
  | 'view_items'
  | 'edit_items'
  | 'record_movement'
  | 'record_adjustment'

// Count Sheet types

export type CountItem = {
  id: number
  name: string
  unit: string
  category: string
  currentQuantity: number
  openedQuantity: number
  trackOpened: boolean  // drives Opened input visibility in CountSheet
}

export type CountEntry = {
  item_id: number
  new_quantity: number
  opened_quantity: number  // 0 for non-trackOpened items; RPC uses item's track_opened flag
}

// Item management types

export type ItemCreateData = {
  name: string
  category: string
  unit: string
  trackOpened: boolean
  reorderLevel: number
  reorderPoint: number | null
  parLevel: number | null
  leadTimeDays: number | null
  location: string | null
  supplier: string | null
  notes: string | null
  initialQuantity: number
  initialOpenedQuantity: number
}

export type ItemUpdateData = {
  name: string
  category: string
  unit: string
  trackOpened: boolean
  reorderLevel: number
  reorderPoint: number | null
  parLevel: number | null
  leadTimeDays: number | null
  location: string | null
  supplier: string | null
  notes: string | null
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only about callers that don't yet pass `parLevel`/`trackOpened` — those are fixed in Tasks 3–5. Not yet expected to be clean.

---

## Task 3: Update Repository

**Files:**
- Modify: `lib/inventory/repository.ts`

- [ ] **Step 1: Update `mapItemRow` to extract new fields**

Replace the `mapItemRow` function (lines 18–35):

```typescript
function mapItemRow(row: Record<string, unknown>): InventoryItem {
  return {
    id: row.id as number,
    outletId: row.outlet_id as string,
    name: row.name as string,
    category: row.category as string,
    unit: row.unit as string,
    reorderLevel: Number(row.reorder_level ?? 0),
    reorderPoint: row.reorder_point != null ? Number(row.reorder_point) : null,
    parLevel: row.par_level != null ? Number(row.par_level) : null,
    leadTimeDays: row.lead_time_days != null ? Number(row.lead_time_days) : null,
    location: (row.location as string) ?? null,
    supplier: (row.supplier as string) ?? null,
    trackOpened: Boolean(row.track_opened),
    status: row.status as InventoryItem['status'],
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}
```

- [ ] **Step 2: Update `createInventoryItem` to accept new fields**

Replace `createInventoryItem` (lines 37–68):

```typescript
export async function createInventoryItem(data: {
  name: string
  category: string
  unit: string
  reorderLevel?: number
  reorderPoint?: number | null
  parLevel?: number | null
  leadTimeDays?: number | null
  location?: string | null
  supplier?: string | null
  trackOpened?: boolean
  notes?: string | null
  initialQuantity?: number
  initialOpenedQuantity?: number
}): Promise<InventoryItem> {
  const supabase = await createServerSupabaseClient()
  const { data: created, error } = await supabase
    .from('inventory_items')
    .insert({
      outlet_id: DEFAULT_OUTLET_ID,
      name: data.name.trim(),
      category: data.category,
      unit: data.unit.trim(),
      reorder_level: data.reorderLevel ?? 0,
      reorder_point: data.reorderPoint ?? null,
      par_level: data.parLevel ?? null,
      lead_time_days: data.leadTimeDays ?? null,
      location: data.location ?? null,
      supplier: data.supplier ?? null,
      track_opened: data.trackOpened ?? false,
      notes: data.notes ?? null,
    })
    .select('*')
    .single()

  if (error) throw error

  const initialQty = data.initialQuantity ?? 0
  const initialOpened = data.initialOpenedQuantity ?? 0

  await supabase.from('inventory_stock_levels').insert({
    item_id: created.id,
    outlet_id: DEFAULT_OUTLET_ID,
    current_quantity: initialQty,
    opened_quantity: initialOpened,
    last_counted_at: initialQty > 0 ? new Date().toISOString() : null,
  })

  return mapItemRow(created)
}
```

- [ ] **Step 3: Update `updateInventoryItem` to accept new fields**

Replace `updateInventoryItem` (lines 70–99):

```typescript
export async function updateInventoryItem(
  itemId: number,
  updates: {
    name?: string
    category?: string
    unit?: string
    reorderLevel?: number
    reorderPoint?: number | null
    parLevel?: number | null
    leadTimeDays?: number | null
    location?: string | null
    supplier?: string | null
    trackOpened?: boolean
    status?: string
    notes?: string | null
  },
): Promise<InventoryItem> {
  const supabase = await createServerSupabaseClient()
  const db: Record<string, unknown> = {}
  if (updates.name !== undefined)        db.name = updates.name
  if (updates.category !== undefined)    db.category = updates.category
  if (updates.unit !== undefined)        db.unit = updates.unit
  if (updates.reorderLevel !== undefined) db.reorder_level = updates.reorderLevel
  if (updates.reorderPoint !== undefined) db.reorder_point = updates.reorderPoint
  if (updates.parLevel !== undefined)    db.par_level = updates.parLevel
  if (updates.leadTimeDays !== undefined) db.lead_time_days = updates.leadTimeDays
  if (updates.location !== undefined)    db.location = updates.location
  if (updates.supplier !== undefined)    db.supplier = updates.supplier
  if (updates.trackOpened !== undefined) db.track_opened = updates.trackOpened
  if (updates.status !== undefined)      db.status = updates.status
  if (updates.notes !== undefined)       db.notes = updates.notes

  const { data, error } = await supabase
    .from('inventory_items')
    .update(db)
    .eq('id', itemId)
    .select('*')
    .single()

  if (error) throw error
  return mapItemRow(data)
}
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit 2>&1 | grep "repository" | head -10
```

Expected: no errors in `repository.ts`.

---

## Task 4: Update `actions.ts` — Thread `parLevel` and `trackOpened` through `InventoryView`

**Files:**
- Modify: `app/inventory/actions.ts`

- [ ] **Step 1: Add new fields to the `InventoryView` mapping**

Replace the `views` mapping block inside `fetchInventoryAction` (the `.map(({ item, stock }) => { ... })` call):

```typescript
const views: InventoryView[] = rows.map(({ item, stock }) => {
  const currentQuantity = stock?.currentQuantity ?? 0
  const openedQuantity = stock?.openedQuantity ?? 0

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    notes: item.notes,
    reorderLevel: item.reorderLevel,
    reorderPoint: item.reorderPoint,
    parLevel: item.parLevel,
    leadTimeDays: item.leadTimeDays,
    location: item.location,
    supplier: item.supplier,
    trackOpened: item.trackOpened,
    currentQuantity,
    openedQuantity,
    onOrderQuantity: stock?.onOrderQuantity ?? 0,
    lastCountedAt: stock?.lastCountedAt ?? null,
    lastUpdatedAt: stock?.lastUpdatedAt ?? null,
    unopenedQuantity: Math.max(0, currentQuantity - openedQuantity),
    displayStatus: computeDisplayStatus({
      currentQuantity,
      reorderLevel: item.reorderLevel,
      reorderPoint: item.reorderPoint,
      lastCountedAt: stock?.lastCountedAt ?? null,
      category: item.category,
    }),
  }
})
```

- [ ] **Step 2: Type check `actions.ts`**

```bash
npx tsc --noEmit 2>&1 | grep "actions" | head -10
```

Expected: no errors in `app/inventory/actions.ts`.

---

## Task 5: Update `count-actions.ts` — Select `track_opened`, per-item validation

**Files:**
- Modify: `app/inventory/count-actions.ts`

- [ ] **Step 1: Replace the file**

```typescript
'use server'

import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canCountCategory } from '@/lib/inventory/permissions'
import type { CountItem, CountEntry } from '@/lib/inventory/types'

const OUTLET_ID = '00000000-0000-0000-0000-000000000001'

export async function fetchCountItemsAction(
  category: string,
): Promise<{ ok: true; data: CountItem[] } | { ok: false; error: string }> {
  try {
    const staff = await requireRole('owner', 'manager', 'kitchen', 'front_desk')

    if (!canCountCategory(staff.role, category)) {
      return { ok: false, error: `Your role cannot count ${category}` }
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('inventory_items')
      .select(`
        id,
        name,
        unit,
        category,
        track_opened,
        inventory_stock_levels!inner (
          current_quantity,
          opened_quantity
        )
      `)
      .eq('category', category)
      .eq('status', 'active')
      .eq('outlet_id', OUTLET_ID)
      .eq('inventory_stock_levels.outlet_id', OUTLET_ID)
      .order('name', { ascending: true })

    if (error) {
      return { ok: false, error: error.message }
    }

    const items: CountItem[] = (data ?? []).map((row) => {
      const stockLevel = Array.isArray(row.inventory_stock_levels)
        ? row.inventory_stock_levels[0]
        : row.inventory_stock_levels

      return {
        id: row.id,
        name: row.name,
        unit: row.unit,
        category: row.category,
        trackOpened: Boolean(row.track_opened),
        currentQuantity: stockLevel?.current_quantity ?? 0,
        openedQuantity: stockLevel?.opened_quantity ?? 0,
      }
    })

    return { ok: true, data: items }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function saveCountAction(
  entries: CountEntry[],
  category: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const staff = await requireRole('owner', 'manager', 'kitchen', 'front_desk')

    if (!canCountCategory(staff.role, category)) {
      return { ok: false, error: `Your role cannot count ${category}` }
    }

    if (!entries || entries.length === 0) {
      return { ok: false, error: 'No items to save' }
    }

    for (const entry of entries) {
      if (entry.new_quantity < 0) {
        return { ok: false, error: 'Quantities cannot be negative' }
      }
      if (entry.opened_quantity > entry.new_quantity) {
        return { ok: false, error: 'Opened quantity cannot exceed total quantity' }
      }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase.rpc('save_inventory_count', {
      p_entries: entries,
      p_category: category,
    })

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}
```

---

## Task 6: Update `CountSheet.tsx` — Use `item.trackOpened`

**Files:**
- Modify: `app/inventory/CountSheet.tsx`

- [ ] **Step 1: Replace the three `category === 'Sauces'` guards with `item.trackOpened`**

Change 1 — `hasValidationError` (currently lines 74–80):

```typescript
const hasValidationError = items.some(item => {
  if (!item.trackOpened) return false
  const total = parseFloat(quantities[item.id] ?? '0') || 0
  const opened = parseFloat(openedQtys[item.id] ?? '0') || 0
  return opened > total
})
```

Change 2 — entries mapping in `handleSave` (currently line 90):

```typescript
const entries: CountEntry[] = items.map(item => ({
  item_id: item.id,
  new_quantity: parseFloat(quantities[item.id] ?? '0') || 0,
  opened_quantity: item.trackOpened
    ? (parseFloat(openedQtys[item.id] ?? '0') || 0)
    : 0,
}))
```

Change 3 — Opened qty render in item list (currently line 238, `{category === 'Sauces' && (`):

```tsx
{/* trackOpened items: show opened qty input */}
{item.trackOpened && (
  <>
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 w-28 flex-shrink-0">
        Opened
      </label>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        value={openedQtys[item.id] ?? ''}
        onChange={e =>
          setOpenedQtys(prev => ({ ...prev, [item.id]: e.target.value }))
        }
        className={`flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none ${
          (() => {
            const total = parseFloat(quantities[item.id] ?? '0') || 0
            const opened = parseFloat(openedQtys[item.id] ?? '0') || 0
            return opened > total
              ? 'border-red-400 focus:border-red-400'
              : 'border-gray-200 focus:border-orange-400'
          })()
        }`}
      />
      <span className="text-xs text-gray-400 w-12 flex-shrink-0">{item.unit}</span>
    </div>
    {(() => {
      const total = parseFloat(quantities[item.id] ?? '0') || 0
      const opened = parseFloat(openedQtys[item.id] ?? '0') || 0
      return opened > total ? (
        <p className="text-xs text-red-500">Opened cannot exceed total</p>
      ) : (
        <p className="text-xs text-gray-400">
          Unopened: {Math.max(0, total - opened)} {item.unit}
        </p>
      )
    })()}
  </>
)}
```

Also remove the now-unused `openedExceedsTotal` variable (line 204: `const openedExceedsTotal = category === 'Sauces' && opened > total`) — it was only used inside the old `{category === 'Sauces' && (` block which is now replaced.

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | grep "CountSheet\|count-actions" | head -10
```

Expected: no errors in these files.

- [ ] **Step 3: Commit Tasks 2–6**

```bash
git add lib/inventory/types.ts lib/inventory/repository.ts \
  app/inventory/actions.ts app/inventory/count-actions.ts \
  app/inventory/CountSheet.tsx
git commit -m "feat(inventory): add parLevel/trackOpened types; update repository, actions, CountSheet"
```

---

## Task 7: Permissions — `canManageInventory`

**Files:**
- Modify: `lib/inventory/permissions.ts`

- [ ] **Step 1: Add `canManageInventory` export at the bottom of the file**

```typescript
// owner and manager can create, edit, and archive inventory items.
// kitchen and front_desk are count-only.
export function canManageInventory(role: string): boolean {
  return role === 'owner' || role === 'manager'
}
```

---

## Task 8: Create `manage-actions.ts`

**Files:**
- Create: `app/inventory/manage-actions.ts`

- [ ] **Step 1: Write the file**

```typescript
'use server'

import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { ItemCreateData, ItemUpdateData } from '@/lib/inventory/types'

const OUTLET_ID = '00000000-0000-0000-0000-000000000001'

export async function createItemAction(
  data: ItemCreateData,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    await requireRole('owner', 'manager')

    const name = data.name.trim()
    if (!name) return { ok: false, error: 'Name is required' }
    if (!data.category) return { ok: false, error: 'Category is required' }
    if (!data.unit.trim()) return { ok: false, error: 'Unit is required' }

    if (data.trackOpened && data.initialOpenedQuantity > data.initialQuantity) {
      return { ok: false, error: 'Opened quantity cannot exceed total quantity' }
    }

    const supabase = await createServerSupabaseClient()

    const { data: created, error: itemError } = await supabase
      .from('inventory_items')
      .insert({
        outlet_id: OUTLET_ID,
        name,
        category: data.category,
        unit: data.unit.trim(),
        reorder_level: data.reorderLevel,
        reorder_point: data.reorderPoint,
        par_level: data.parLevel,
        lead_time_days: data.leadTimeDays,
        location: data.location,
        supplier: data.supplier,
        track_opened: data.trackOpened,
        notes: data.notes,
        status: 'active',
      })
      .select('id')
      .single()

    if (itemError) {
      if (itemError.code === '23505') {
        return { ok: false, error: 'An item with this name already exists' }
      }
      return { ok: false, error: itemError.message }
    }

    const { error: stockError } = await supabase
      .from('inventory_stock_levels')
      .insert({
        item_id: created.id,
        outlet_id: OUTLET_ID,
        current_quantity: data.initialQuantity,
        opened_quantity: data.trackOpened ? data.initialOpenedQuantity : 0,
        last_counted_at: data.initialQuantity > 0 ? new Date().toISOString() : null,
      })

    if (stockError) return { ok: false, error: stockError.message }

    return { ok: true, id: created.id }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function updateItemAction(
  id: number,
  data: ItemUpdateData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireRole('owner', 'manager')

    const name = data.name.trim()
    if (!name) return { ok: false, error: 'Name is required' }
    if (!data.category) return { ok: false, error: 'Category is required' }
    if (!data.unit.trim()) return { ok: false, error: 'Unit is required' }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('inventory_items')
      .update({
        name,
        category: data.category,
        unit: data.unit.trim(),
        reorder_level: data.reorderLevel,
        reorder_point: data.reorderPoint,
        par_level: data.parLevel,
        lead_time_days: data.leadTimeDays,
        location: data.location,
        supplier: data.supplier,
        track_opened: data.trackOpened,
        notes: data.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('outlet_id', OUTLET_ID)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function archiveItemAction(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireRole('owner', 'manager')

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('inventory_items')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('outlet_id', OUTLET_ID)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | grep "manage-actions\|permissions" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit Tasks 7–8**

```bash
git add lib/inventory/permissions.ts app/inventory/manage-actions.ts
git commit -m "feat(inventory): add canManageInventory, createItemAction, updateItemAction, archiveItemAction"
```

---

## Task 9: Create `ItemSheet.tsx`

**Files:**
- Create: `app/inventory/ItemSheet.tsx`

- [ ] **Step 1: Write the file**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createItemAction, updateItemAction, archiveItemAction } from './manage-actions'
import type { InventoryView, ItemCreateData, ItemUpdateData } from '@/lib/inventory/types'

const CATEGORIES = ['Fresh', 'Sauces', 'Dry Goods', 'Drinks', 'Packaging', 'Supplies']
const UNIT_QUICKPICKS = ['kg', 'g', 'bottles', 'tubs', 'pcs', 'bags', 'pairs', 'cartons', 'packs']

type Props = {
  mode: 'add' | 'edit'
  item?: InventoryView
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

type FormState = {
  name: string
  category: string
  unit: string
  trackOpened: boolean
  reorderLevel: string
  reorderPoint: string
  parLevel: string
  leadTimeDays: string
  location: string
  supplier: string
  notes: string
  initialQuantity: string
  initialOpenedQty: string
}

function emptyForm(): FormState {
  return {
    name: '',
    category: '',
    unit: '',
    trackOpened: false,
    reorderLevel: '',
    reorderPoint: '',
    parLevel: '',
    leadTimeDays: '',
    location: '',
    supplier: '',
    notes: '',
    initialQuantity: '0',
    initialOpenedQty: '0',
  }
}

function formFromItem(item: InventoryView): FormState {
  return {
    name: item.name,
    category: item.category,
    unit: item.unit,
    trackOpened: item.trackOpened,
    reorderLevel: item.reorderLevel > 0 ? String(item.reorderLevel) : '',
    reorderPoint: item.reorderPoint != null ? String(item.reorderPoint) : '',
    parLevel: item.parLevel != null ? String(item.parLevel) : '',
    leadTimeDays: item.leadTimeDays != null ? String(item.leadTimeDays) : '',
    location: item.location ?? '',
    supplier: item.supplier ?? '',
    notes: item.notes ?? '',
    initialQuantity: '0',
    initialOpenedQty: '0',
  }
}

export default function ItemSheet({ mode, item, isOpen, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [archiving, setArchiving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setForm(mode === 'edit' && item ? formFromItem(item) : emptyForm())
      setSaving(false)
      setError(null)
      setToast(null)
      setArchiveConfirm(false)
      setArchiving(false)
    }
  }, [isOpen, mode, item])

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // auto-set trackOpened when category changes
      if (field === 'category') {
        next.trackOpened = value === 'Sauces'
      }
      return next
    })
  }

  const initialQty = parseFloat(form.initialQuantity) || 0
  const initialOpenedQty = parseFloat(form.initialOpenedQty) || 0
  const initOpenedError = form.trackOpened && mode === 'add' && initialOpenedQty > initialQty
  const canSave =
    form.name.trim() !== '' &&
    form.category !== '' &&
    form.unit.trim() !== '' &&
    !initOpenedError

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    setError(null)

    let result: { ok: true; id?: number } | { ok: false; error: string }

    if (mode === 'add') {
      const payload: ItemCreateData = {
        name: form.name.trim(),
        category: form.category,
        unit: form.unit.trim(),
        trackOpened: form.trackOpened,
        reorderLevel: parseFloat(form.reorderLevel) || 0,
        reorderPoint: form.reorderPoint !== '' ? parseFloat(form.reorderPoint) : null,
        parLevel: form.parLevel !== '' ? parseFloat(form.parLevel) : null,
        leadTimeDays: form.leadTimeDays !== '' ? parseInt(form.leadTimeDays, 10) : null,
        location: form.location.trim() || null,
        supplier: form.supplier.trim() || null,
        notes: form.notes.trim() || null,
        initialQuantity: initialQty,
        initialOpenedQuantity: form.trackOpened ? initialOpenedQty : 0,
      }
      result = await createItemAction(payload)
    } else {
      const payload: ItemUpdateData = {
        name: form.name.trim(),
        category: form.category,
        unit: form.unit.trim(),
        trackOpened: form.trackOpened,
        reorderLevel: parseFloat(form.reorderLevel) || 0,
        reorderPoint: form.reorderPoint !== '' ? parseFloat(form.reorderPoint) : null,
        parLevel: form.parLevel !== '' ? parseFloat(form.parLevel) : null,
        leadTimeDays: form.leadTimeDays !== '' ? parseInt(form.leadTimeDays, 10) : null,
        location: form.location.trim() || null,
        supplier: form.supplier.trim() || null,
        notes: form.notes.trim() || null,
      }
      result = await updateItemAction(item!.id, payload)
    }

    setSaving(false)

    if (result.ok) {
      setToast(mode === 'add' ? 'Item added' : 'Item updated')
      onSaved()
      setTimeout(() => {
        setToast(null)
        onClose()
      }, 1200)
    } else {
      setError(result.error)
    }
  }

  async function handleArchive() {
    if (!item || archiving) return
    setArchiving(true)
    const result = await archiveItemAction(item.id)
    setArchiving(false)
    if (result.ok) {
      setToast('Item archived')
      onSaved()
      setTimeout(() => {
        setToast(null)
        onClose()
      }, 1200)
    } else {
      setError(result.error)
      setArchiveConfirm(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[500] bg-white flex flex-col">

      {/* Toast */}
      {toast && (
        <div className="fixed top-0 inset-x-0 z-[210] bg-green-500 text-white text-sm font-medium text-center py-3 px-4">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="text-gray-500 text-lg leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          aria-label="Close"
        >
          ✕
        </button>
        <span className="font-semibold text-base flex-1">
          {mode === 'add' ? 'Add Inventory Item' : 'Edit Item'}
        </span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-5 pb-4 space-y-6">

        {/* ── Basic Info ─────────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Basic Info</h3>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. 牛肉面酱"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">
              Category <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => set('category', cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    form.category === cat
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">
              Unit <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.unit}
              onChange={e => set('unit', e.target.value)}
              placeholder="e.g. bottles"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 mb-2"
            />
            <div className="flex flex-wrap gap-1.5">
              {UNIT_QUICKPICKS.map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => set('unit', u)}
                  className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                    form.unit === u
                      ? 'bg-orange-100 text-orange-600 font-medium'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stock Settings ─────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Stock Settings</h3>

          {/* Track opened toggle */}
          <div className="flex items-center justify-between py-0.5">
            <div>
              <div className="text-sm font-medium text-gray-900">Track Opened / Unopened</div>
              <div className="text-xs text-gray-400 mt-0.5">For sauces and items opened gradually</div>
            </div>
            <button
              type="button"
              onClick={() => set('trackOpened', !form.trackOpened)}
              className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 relative ml-3 ${
                form.trackOpened ? 'bg-orange-500' : 'bg-gray-200'
              }`}
              aria-label="Toggle track opened"
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  form.trackOpened ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Initial quantities — add mode only */}
          {mode === 'add' && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2.5">
              <div className="text-xs text-gray-500 font-medium">Initial Stock</div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 w-20 flex-shrink-0">Total</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={form.initialQuantity}
                  onChange={e => set('initialQuantity', e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-400"
                />
                <span className="text-xs text-gray-400 w-16 flex-shrink-0 truncate">
                  {form.unit || 'units'}
                </span>
              </div>
              {form.trackOpened && (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 w-20 flex-shrink-0">Opened</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={form.initialOpenedQty}
                      onChange={e => set('initialOpenedQty', e.target.value)}
                      className={`flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none ${
                        initOpenedError
                          ? 'border-red-400 focus:border-red-400'
                          : 'border-gray-200 focus:border-orange-400'
                      }`}
                    />
                    <span className="text-xs text-gray-400 w-16 flex-shrink-0 truncate">
                      {form.unit || 'units'}
                    </span>
                  </div>
                  {initOpenedError && (
                    <p className="text-xs text-red-500">Opened cannot exceed total</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Threshold grid */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Min Stock</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={form.reorderLevel}
                onChange={e => set('reorderLevel', e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:border-orange-400"
              />
              <div className="text-xs text-gray-300 mt-0.5">Low Stock</div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Reorder At</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={form.reorderPoint}
                onChange={e => set('reorderPoint', e.target.value)}
                placeholder="—"
                className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:border-orange-400"
              />
              <div className="text-xs text-gray-300 mt-0.5">Order trigger</div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Par Level</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={form.parLevel}
                onChange={e => set('parLevel', e.target.value)}
                placeholder="—"
                className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:border-orange-400"
              />
              <div className="text-xs text-gray-300 mt-0.5">Target</div>
            </div>
          </div>
        </section>

        {/* ── Logistics ──────────────────────────────────────── */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Logistics</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Lead Time (days)</label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={form.leadTimeDays}
                onChange={e => set('leadTimeDays', e.target.value)}
                placeholder="—"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={e => set('location', e.target.value)}
                placeholder="Dry Store"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Supplier</label>
            <input
              type="text"
              value={form.supplier}
              onChange={e => set('supplier', e.target.value)}
              placeholder="Supplier name"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>
        </section>

        {/* ── Notes ─────────────────────────────────────────── */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Notes</h3>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Optional notes..."
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 resize-none"
          />
        </section>

        {/* ── Archive (edit only) ────────────────────────────── */}
        {mode === 'edit' && (
          <section className="border-t pt-4">
            {archiveConfirm ? (
              <div className="bg-red-50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-red-600">Archive this item?</p>
                <p className="text-xs text-red-400">
                  It will be hidden from the inventory list. Historical counts are preserved.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setArchiveConfirm(false)}
                    className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleArchive}
                    disabled={archiving}
                    className="flex-1 py-2 rounded-xl text-sm bg-red-500 text-white font-medium disabled:opacity-50"
                  >
                    {archiving ? 'Archiving…' : 'Yes, Archive'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setArchiveConfirm(true)}
                className="text-sm text-red-400 hover:text-red-500"
              >
                Archive Item
              </button>
            )}
          </section>
        )}

      </div>

      {/* Save bar */}
      <div className="flex-shrink-0 bg-white border-t px-4 py-4 pb-safe">
        {error && <p className="text-xs text-red-500 mb-2 text-center">{error}</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          className={`w-full py-3 rounded-2xl text-sm font-semibold transition-colors ${
            !canSave || saving
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-orange-500 text-white active:bg-orange-600'
          }`}
        >
          {saving ? 'Saving…' : mode === 'add' ? 'Add Item' : 'Save Changes'}
        </button>
      </div>

    </div>,
    document.body
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/inventory/ItemSheet.tsx
git commit -m "feat(inventory): add ItemSheet component for add/edit/archive"
```

---

## Task 10: Update `page.tsx` — Wire Add Item, Edit, and ItemSheet

**Files:**
- Modify: `app/inventory/page.tsx`

- [ ] **Step 1: Add imports**

At the top of `page.tsx`, after the existing imports, add:

```typescript
import { canManageInventory } from '@/lib/inventory/permissions'
import ItemSheet from './ItemSheet'
```

- [ ] **Step 2: Add ItemSheet state and handlers**

Inside `InventoryPage()`, after the existing `countSheetOpen` state declarations, add:

```typescript
const [itemSheetOpen, setItemSheetOpen] = useState(false)
const [itemSheetMode, setItemSheetMode] = useState<'add' | 'edit'>('add')
const [editingItem, setEditingItem] = useState<InventoryView | undefined>(undefined)

function handleItemSaved() {
  setLoading(true)
  fetchInventoryAction().then(result => {
    if (result.ok) setItems(result.data)
    else setFetchError(result.error)
    setLoading(false)
  })
}

function openAddItem() {
  setItemSheetMode('add')
  setEditingItem(undefined)
  setItemSheetOpen(true)
}

function openEditItem(itemToEdit: InventoryView) {
  setItemSheetMode('edit')
  setEditingItem(itemToEdit)
  setItemSheetOpen(true)
}
```

- [ ] **Step 3: Add `onEdit` prop to `StandardCard`, `SauceCard`, and `ItemCard`**

Replace the three card functions:

```tsx
function StandardCard({ item, onEdit }: { item: InventoryView; onEdit?: () => void }) {
  const badge = STATUS_BADGE[item.displayStatus]
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">{item.name}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          Stock: {item.currentQuantity} {item.unit}
          {item.location && <span className="ml-2">· {item.location}</span>}
        </div>
        {item.lastCountedAt && (
          <div className="text-xs text-gray-300 mt-0.5">
            Counted: {new Date(item.lastCountedAt).toLocaleDateString()}
          </div>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-gray-400 hover:text-orange-500 mt-1.5"
          >
            Edit
          </button>
        )}
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${badge.color}`}>
        {badge.label}
      </span>
    </div>
  )
}

function SauceCard({ item, onEdit }: { item: InventoryView; onEdit?: () => void }) {
  const badge = STATUS_BADGE[item.displayStatus]
  const showReorderWarning =
    item.reorderPoint != null && item.currentQuantity <= item.reorderPoint

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{item.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Stock: {item.currentQuantity} {item.unit}
            {(item.openedQuantity > 0 || item.unopenedQuantity > 0) && (
              <span className="text-gray-400">
                {' '}· Opened {item.openedQuantity} · Unopened {item.unopenedQuantity}
              </span>
            )}
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${badge.color}`}>
          {badge.label}
        </span>
      </div>

      {showReorderWarning && (
        <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
          Reorder at {item.reorderPoint} {item.unit}
          {item.leadTimeDays != null && ` · Lead time ${item.leadTimeDays} days`}
        </div>
      )}

      {item.onOrderQuantity > 0 && (
        <div className="text-xs text-blue-600">
          On order: {item.onOrderQuantity} {item.unit}
        </div>
      )}

      {(item.location || item.supplier) && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {item.location && <span className="text-xs text-gray-400">Location: {item.location}</span>}
          {item.supplier && <span className="text-xs text-gray-400">Supplier: {item.supplier}</span>}
        </div>
      )}

      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-gray-400 hover:text-orange-500"
        >
          Edit
        </button>
      )}
    </div>
  )
}

function ItemCard({ item, onEdit }: { item: InventoryView; onEdit?: () => void }) {
  return item.category === 'Sauces'
    ? <SauceCard item={item} onEdit={onEdit} />
    : <StandardCard item={item} onEdit={onEdit} />
}
```

- [ ] **Step 4: Add `+ Add` button to the header**

Replace the header `<div>` (the one with `BackButton` and `"Inventory"` span):

```tsx
<div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-10">
  <BackButton href="/" />
  <span className="font-semibold text-base flex-1">Inventory</span>
  {canManageInventory(role) && (
    <button
      type="button"
      onClick={openAddItem}
      className="text-orange-500 text-sm font-medium"
    >
      + Add
    </button>
  )}
</div>
```

- [ ] **Step 5: Pass `onEdit` to `ItemCard` in the Attention groups**

Replace the line `{group.items.map(item => <ItemCard key={item.id} item={item} />)}`:

```tsx
{group.items.map(item => (
  <ItemCard
    key={item.id}
    item={item}
    onEdit={canManageInventory(role) ? () => openEditItem(item) : undefined}
  />
))}
```

- [ ] **Step 6: Pass `onEdit` to `ItemCard` in the flat tab list**

Replace `tabItems.map(item => <ItemCard key={item.id} item={item} />)`:

```tsx
{tabItems.map(item => (
  <ItemCard
    key={item.id}
    item={item}
    onEdit={canManageInventory(role) ? () => openEditItem(item) : undefined}
  />
))}
```

- [ ] **Step 7: Add `ItemSheet` at the bottom of the return (after `CountSheet`)**

After `</CountSheet>` and before `</PageTransition>`:

```tsx
<ItemSheet
  mode={itemSheetMode}
  item={editingItem}
  isOpen={itemSheetOpen}
  onClose={() => setItemSheetOpen(false)}
  onSaved={handleItemSaved}
/>
```

- [ ] **Step 8: Type check and fix any remaining errors**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add app/inventory/page.tsx lib/inventory/permissions.ts
git commit -m "feat(inventory): wire Add Item button, Edit card entry, ItemSheet in inventory page"
```

---

## Task 11: Seed SQL

**Files:**
- Create: `scripts/seed-inventory-starter.sql`

- [ ] **Step 1: Write the seed file**

```sql
-- scripts/seed-inventory-starter.sql
-- Starter inventory seed for 文心砂锅 restaurant.
-- Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING.
-- Run AFTER all inventory migrations are applied.
-- Replace the outlet_id below if yours differs.

DO $$
DECLARE
  c_outlet uuid := '00000000-0000-0000-0000-000000000001';
  v_id     bigint;
BEGIN

  -- ── Sauces ────────────────────────────────────────────────────────
  INSERT INTO public.inventory_items
    (outlet_id, name, category, unit, reorder_level, reorder_point, par_level, lead_time_days, track_opened, status)
  VALUES
    (c_outlet, '牛肉面酱',   'Sauces', 'bottles', 1, 2, 8,  45, true, 'active'),
    (c_outlet, '金汤酸菜鱼酱', 'Sauces', 'tubs',    1, 2, 6,  45, true, 'active'),
    (c_outlet, '麻辣底料',   'Sauces', 'tubs',    1, 2, 6,  NULL, true, 'active'),
    (c_outlet, '辣椒油',    'Sauces', 'bottles', 1, 1, 4,  NULL, true, 'active'),
    (c_outlet, '豆瓣酱',    'Sauces', 'tubs',    1, 1, 3,  NULL, true, 'active'),
    (c_outlet, '生抽',      'Sauces', 'bottles', 1, 2, 6,  NULL, true, 'active'),
    (c_outlet, '老抽',      'Sauces', 'bottles', 1, 1, 3,  NULL, true, 'active'),
    (c_outlet, '蚝油',      'Sauces', 'bottles', 1, 1, 4,  NULL, true, 'active'),
    (c_outlet, '料酒',      'Sauces', 'bottles', 1, 1, 3,  NULL, true, 'active'),
    (c_outlet, '香醋',      'Sauces', 'bottles', 1, 1, 3,  NULL, true, 'active')
  ON CONFLICT DO NOTHING;

  -- ── Packaging ─────────────────────────────────────────────────────
  INSERT INTO public.inventory_items
    (outlet_id, name, category, unit, reorder_level, reorder_point, par_level, track_opened, status)
  VALUES
    (c_outlet, 'Bento Box M',    'Packaging', 'pcs',   100, 200, 1000, false, 'active'),
    (c_outlet, 'Bento Box L',    'Packaging', 'pcs',   75,  150, 800,  false, 'active'),
    (c_outlet, 'Soup Container', 'Packaging', 'pcs',   50,  100, 600,  false, 'active'),
    (c_outlet, 'Soup Lid',       'Packaging', 'pcs',   50,  100, 600,  false, 'active'),
    (c_outlet, 'Takeaway Bag',   'Packaging', 'pcs',   50,  100, 500,  false, 'active'),
    (c_outlet, 'Chopsticks',     'Packaging', 'pairs', 100, 200, 1000, false, 'active'),
    (c_outlet, 'Napkins',        'Packaging', 'packs', 1,   2,   10,   false, 'active')
  ON CONFLICT DO NOTHING;

  -- ── Dry Goods ──────────────────────────────────────────────────────
  INSERT INTO public.inventory_items
    (outlet_id, name, category, unit, reorder_level, reorder_point, par_level, track_opened, status)
  VALUES
    (c_outlet, 'Rice',           'Dry Goods', 'bags',    1, 2, 8,  false, 'active'),
    (c_outlet, 'Noodles',        'Dry Goods', 'cartons', 1, 2, 10, false, 'active'),
    (c_outlet, 'Corn Starch',    'Dry Goods', 'bags',    1, 1, 4,  false, 'active'),
    (c_outlet, 'Flour',          'Dry Goods', 'bags',    1, 1, 4,  false, 'active'),
    (c_outlet, 'Sugar',          'Dry Goods', 'bags',    1, 1, 4,  false, 'active'),
    (c_outlet, 'Salt',           'Dry Goods', 'bags',    1, 1, 4,  false, 'active'),
    (c_outlet, 'MSG',            'Dry Goods', 'bags',    1, 1, 4,  false, 'active'),
    (c_outlet, 'Chicken Powder', 'Dry Goods', 'tubs',    1, 1, 4,  false, 'active')
  ON CONFLICT DO NOTHING;

  -- Insert a zero stock level row for each item that was just inserted
  -- (items that already existed via ON CONFLICT DO NOTHING won't get duplicates
  -- because the ON CONFLICT on inventory_stock_levels handles it)
  INSERT INTO public.inventory_stock_levels (item_id, outlet_id, current_quantity)
  SELECT id, outlet_id, 0
  FROM public.inventory_items
  WHERE outlet_id = c_outlet
    AND NOT EXISTS (
      SELECT 1 FROM public.inventory_stock_levels sl
      WHERE sl.item_id = inventory_items.id AND sl.outlet_id = c_outlet
    );

END $$;
```

- [ ] **Step 2: Note on running**

Run this in the Supabase SQL Editor. Items that already exist (e.g. 牛肉面酱 and 金汤酸菜鱼酱 from earlier seeds) will be silently skipped by `ON CONFLICT DO NOTHING`.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-inventory-starter.sql
git commit -m "seed(inventory): add starter inventory SQL for 25 sauces/packaging/dry goods items"
```

---

## Task 12: Verification

- [ ] **Step 1: Run type check — must be clean**

```bash
npx tsc --noEmit
```

Expected: exit 0, no output.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

- [ ] **Step 3: Test Add Item (owner)**

1. Open `http://localhost:3000`, navigate to Inventory.
2. Confirm `+ Add` button visible in header.
3. Tap `+ Add` — ItemSheet opens full-screen above BottomNav (z-500).
4. Enter: Name=`Test Sauce`, Category=Sauces (auto-sets Track Opened=ON), Unit=bottles (quickpick).
5. Set Reorder At=2, Par Level=6, Lead Time=45.
6. Set Initial Stock Total=4, Opened=1.
7. Tap `Add Item` — toast "Item added", sheet closes, page refreshes.
8. Confirm `Test Sauce` appears under Sauces tab. Card shows "Stock: 4 bottles · Opened 1 · Unopened 3".

- [ ] **Step 4: Test Edit Item**

1. Tap `Edit` under `Test Sauce` card.
2. Change Reorder At from 2 to 1. Tap `Save Changes`.
3. Confirm page refreshes in-place. Card still shows same quantities.

- [ ] **Step 5: Test that lowered reorder threshold removes Need Reorder status**

1. Add item with Reorder At=10, initial stock=5 — it should appear in Need Reorder.
2. Edit that item, set Reorder At=3.
3. After save, item disappears from Need Reorder.

- [ ] **Step 6: Test Archive**

1. Open Edit sheet for `Test Sauce`.
2. Tap `Archive Item` — confirm panel appears.
3. Tap `Yes, Archive` — item disappears from Inventory page.
4. In Supabase SQL Editor, run:
   ```sql
   SELECT id, name, status FROM inventory_items WHERE name = 'Test Sauce';
   ```
   Confirm: `status = 'inactive'`.
5. Run:
   ```sql
   SELECT COUNT(*) FROM inventory_movements WHERE item_id = <id from above>;
   ```
   Confirm: movement rows still exist (from the initial count during Add).

- [ ] **Step 7: Confirm Count Stock still works**

1. Tap `Count Stock` — CountSheet opens, all original categories present.
2. Pick `Sauces`, confirm Opened input visible for `track_opened=true` items.
3. Pick `Dry Goods`, confirm NO Opened input on any item.
4. Save a count — toast appears, page refreshes, status updates correctly.

- [ ] **Step 8: Confirm kitchen/front_desk cannot see Add/Edit**

Login as kitchen or front_desk role:
- Header `+ Add` button: NOT visible.
- Card Edit link: NOT visible.
- Attempting to call `createItemAction` directly from the browser console would return `{ok: false, error: 'Unauthorised'}` (server-side `requireRole` rejects).

- [ ] **Step 9: Final commit**

```bash
git add -p  # stage any remaining changes
git commit -m "feat(inventory): complete V1 item management — add, edit, archive"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Covered by |
|---|---|
| Add Item button, owner/manager only | Task 10, Step 4 + `canManageInventory` |
| All specified form fields | Task 9 (ItemSheet), Task 8 (manage-actions types) |
| Category quickpick, auto track_opened for Sauces | Task 9 `set('category')` handler |
| track_opened shows Total/Opened/Unopened | Task 9 initial quantities section + Task 6 CountSheet |
| opened ≤ total validation | Task 9 `initOpenedError`, Task 8 server validation |
| Edit entry per card, owner/manager only | Task 10 Steps 3–6 |
| Edit modifies metadata; count flow intact | Tasks 3–6 |
| In-place refresh after edit | Task 10 `handleItemSaved` |
| Archive sets `is_active=false` (= `status='inactive'`) | Task 8 `archiveItemAction`, Task 9 archive section |
| Default page shows only active items | Existing `findInventoryWithStock` already filters `.eq('status', 'active')` |
| Historical movements preserved | Task 12 Step 6 verification |
| RLS: only owner/manager write | Existing `inventory_items_manage` policy covers INSERT/UPDATE |
| kitchen/front_desk count-only | Task 8 `requireRole('owner','manager')` in manage-actions |
| Seed SQL | Task 11 |
| Mobile-first, pb-safe, above BottomNav | Task 9 (z-[500], pb-safe on save bar) |
| After save, in-place refresh | Task 10 `handleItemSaved` |
| Count Stock unchanged | Tasks 5–6 preserve all existing count behavior |
