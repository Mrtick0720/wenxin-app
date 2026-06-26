# Inventory Count Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow kitchen and front-desk staff to record counted quantities, update stock levels atomically, and produce a `stock_check` audit trail — without any stock-in, stock-out, adjustment, or item management.

**Architecture:** A `security definer` Postgres RPC (`save_inventory_count`) owns all write logic — it derives staff identity from `auth.uid()`, reads `previous_quantity` from the DB, and inserts movement rows for every counted item (including zero-delta). Two client entry points (floating button + category-tab button) open an in-page overlay component (`CountSheet`). Server actions call the RPC after their own role/category validation.

**Tech Stack:** Next.js 16 App Router · TypeScript · Tailwind CSS v4 · Supabase (postgres RPC, RLS) · React useState/useEffect

---

## File Map

| File | Action | What it does |
|---|---|---|
| `supabase/migrations/20260623_inventory_count_rls.sql` | Create | front_desk SELECT policies + `save_inventory_count` RPC + grant |
| `lib/inventory/types.ts` | Modify | Add `CountItem`, `CountEntry` types |
| `lib/inventory/permissions.ts` | Modify | Add `CATEGORY_COUNT_PERMISSIONS`, `canCountCategory()` |
| `app/inventory/count-actions.ts` | Create | `fetchCountItemsAction`, `saveCountAction` |
| `app/inventory/CountSheet.tsx` | Create | Full-screen overlay: category picker + item list + inputs |
| `app/inventory/page.tsx` | Modify | Add `useStaff()`, floating Count Stock button, Count This Category per tab |

No changes to NavigationStack, stackRoutes, BackButton, BottomNav, or layout.

---

## Task 1 — DB Migration: RLS + RPC

**Files:**
- Create: `supabase/migrations/20260623_inventory_count_rls.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- ═══════════════════════════════════════════════════════════════════
-- Inventory Count Sheet — RLS + RPC
-- Phase: Count Sheet
-- Safe to re-run: all statements are idempotent
-- ═══════════════════════════════════════════════════════════════════

-- ── Fix front_desk SELECT access (v1 gap) ────────────────────────

drop policy if exists inventory_items_frontdesk_read on public.inventory_items;
create policy inventory_items_frontdesk_read
  on public.inventory_items
  for select to authenticated
  using (public.staff_role_is(array['front_desk']));

drop policy if exists inventory_stock_levels_frontdesk_read on public.inventory_stock_levels;
create policy inventory_stock_levels_frontdesk_read
  on public.inventory_stock_levels
  for select to authenticated
  using (public.staff_role_is(array['front_desk']));

-- ── save_inventory_count RPC ──────────────────────────────────────
-- security definer: bypasses RLS for writes.
-- All auth and category checks are performed inside the function.

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
  v_staff_id   uuid;
  v_role       text;
  v_staff_status text;
  v_entry      jsonb;
  v_item_id    bigint;
  v_new_qty    numeric;
  v_opened_qty numeric;
  v_prev_qty   numeric;
  v_item_cat   text;
  c_outlet     constant uuid := '00000000-0000-0000-0000-000000000001';
begin

  -- Step 1: identify caller via auth.uid() (staff_profiles.id = auth.uid())
  select id, role, status
  into v_staff_id, v_role, v_staff_status
  from public.staff_profiles
  where id = auth.uid();

  if not found or v_staff_status != 'active' then
    raise exception 'No active staff profile found';
  end if;

  -- Step 2: validate role is permitted to count this category
  if not (
    v_role in ('owner', 'manager')
    or (v_role = 'kitchen'    and p_category in ('Fresh','Sauces','Dry Goods','Packaging','Supplies'))
    or (v_role = 'front_desk' and p_category in ('Drinks','Packaging'))
  ) then
    raise exception 'Role % is not permitted to count category %', v_role, p_category;
  end if;

  -- Step 3: process each entry atomically
  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    v_item_id    := (v_entry->>'item_id')::bigint;
    v_new_qty    := (v_entry->>'new_quantity')::numeric;
    v_opened_qty := coalesce((v_entry->>'opened_quantity')::numeric, 0);

    -- Reject negative total quantity
    if v_new_qty < 0 then
      raise exception 'Quantity cannot be negative for item %', v_item_id;
    end if;

    -- Verify item exists, is active, and belongs to p_category
    select category into v_item_cat
    from public.inventory_items
    where id = v_item_id and status = 'active';

    if not found then
      raise exception 'Item % not found or inactive', v_item_id;
    end if;

    if v_item_cat != p_category then
      raise exception 'Item % does not belong to category %', v_item_id, p_category;
    end if;

    -- Read previous_quantity from DB — never trust the client
    select current_quantity into v_prev_qty
    from public.inventory_stock_levels
    where item_id = v_item_id and outlet_id = c_outlet;

    v_prev_qty := coalesce(v_prev_qty, 0);

    -- Update stock level (opened_quantity only for Sauces)
    if p_category = 'Sauces' then
      if v_opened_qty < 0 then
        raise exception 'Opened quantity cannot be negative for item %', v_item_id;
      end if;
      if v_opened_qty > v_new_qty then
        raise exception 'Opened quantity exceeds total quantity for item %', v_item_id;
      end if;
      update public.inventory_stock_levels
      set current_quantity = v_new_qty,
          opened_quantity  = v_opened_qty,
          last_counted_at  = now(),
          last_updated_at  = now()
      where item_id = v_item_id and outlet_id = c_outlet;
    else
      -- Non-sauce: do NOT touch opened_quantity
      update public.inventory_stock_levels
      set current_quantity = v_new_qty,
          last_counted_at  = now(),
          last_updated_at  = now()
      where item_id = v_item_id and outlet_id = c_outlet;
    end if;

    -- Insert movement record even when delta = 0
    -- (proves the item was counted; created_by = staff_profiles.id from auth.uid())
    insert into public.inventory_movements
      (item_id, outlet_id, movement_type,
       quantity, previous_quantity, new_quantity,
       created_by, notes)
    values
      (v_item_id, c_outlet, 'stock_check',
       v_new_qty - v_prev_qty, v_prev_qty, v_new_qty,
       v_staff_id,
       'Count sheet: ' || p_category);
  end loop;

end;
$$;

-- Grant execute to all authenticated users.
-- The function enforces its own auth internally.
grant execute on function public.save_inventory_count(jsonb, text) to authenticated;
```

- [ ] **Step 2: Apply in Supabase SQL Editor**

Paste the full migration into Supabase → SQL Editor → Run.

- [ ] **Step 3: Verify front_desk SELECT policies exist**

Run in SQL Editor:
```sql
select policyname, cmd
from pg_policies
where tablename in ('inventory_items','inventory_stock_levels')
  and policyname like '%frontdesk%';
```
Expected: 2 rows — `inventory_items_frontdesk_read` (SELECT), `inventory_stock_levels_frontdesk_read` (SELECT).

- [ ] **Step 4: Verify RPC exists and is executable**

Run in SQL Editor:
```sql
select proname, prosecdef
from pg_proc
where proname = 'save_inventory_count';
```
Expected: 1 row, `prosecdef = true`.

- [ ] **Step 5: Verify RPC rejects unauthorized calls**

Run in SQL Editor (simulates a bad role — replace uuid with a front_desk staff uid):
```sql
select save_inventory_count(
  '[{"item_id":1,"new_quantity":5}]'::jsonb,
  'Sauces'
);
```
When called as a front_desk user, expected error: `Role front_desk is not permitted to count category Sauces`.

---

## Task 2 — Types: CountItem and CountEntry

**Files:**
- Modify: `lib/inventory/types.ts`

- [ ] **Step 1: Add CountItem and CountEntry at the end of `lib/inventory/types.ts`**

```typescript
// Count Sheet types

export type CountItem = {
  id: number
  name: string
  unit: string
  category: string
  currentQuantity: number
  openedQuantity: number  // 0 for non-sauce items
}

export type CountEntry = {
  item_id: number
  new_quantity: number
  opened_quantity: number  // ignored by RPC for non-Sauces categories
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1 | grep -E "types\.ts|CountItem|CountEntry"
```
Expected: no errors mentioning these types.

- [ ] **Step 3: Commit**

```bash
cd /Users/bruce/wenxin-app
git add lib/inventory/types.ts
git commit -m "feat(inventory): add CountItem and CountEntry types"
```

---

## Task 3 — Permissions: Category Count Map

**Files:**
- Modify: `lib/inventory/permissions.ts`

- [ ] **Step 1: Add count permission exports to the bottom of `lib/inventory/permissions.ts`**

The file currently exports `canPerformInventoryAction`, `canViewInventory`, `canEditInventory`, `getInventoryActionsForRole`. Do not modify those. Add below:

```typescript
// ── Count Sheet permission map ────────────────────────────────────
// Defines which categories each role may count.
// Enforced in: saveCountAction (server) AND save_inventory_count RPC (DB).

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

- [ ] **Step 2: Type-check**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1 | grep "permissions"
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/inventory/permissions.ts
git commit -m "feat(inventory): add CATEGORY_COUNT_PERMISSIONS and canCountCategory"
```

---

## Task 4 — Server Actions: fetchCountItemsAction + saveCountAction

**Files:**
- Create: `app/inventory/count-actions.ts`

- [ ] **Step 1: Create `app/inventory/count-actions.ts`**

```typescript
'use server'

import { requireRole, getCurrentStaff } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { CATEGORY_COUNT_PERMISSIONS, canCountCategory } from '@/lib/inventory/permissions'
import type { CountItem, CountEntry } from '@/lib/inventory/types'

// ── fetchCountItemsAction ─────────────────────────────────────────
// Returns active items in the given category for the count sheet.
// Only returns items in categories the caller's role can count.

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
      .select('id, name, unit, category, inventory_stock_levels(current_quantity, opened_quantity)')
      .eq('outlet_id', '00000000-0000-0000-0000-000000000001')
      .eq('status', 'active')
      .eq('category', category)
      .order('name', { ascending: true })

    if (error) throw error

    const items: CountItem[] = (data ?? []).map((row: Record<string, unknown>) => {
      const sl = Array.isArray(row.inventory_stock_levels)
        ? (row.inventory_stock_levels[0] as Record<string, unknown> | undefined)
        : (row.inventory_stock_levels as Record<string, unknown> | null)
      return {
        id: row.id as number,
        name: row.name as string,
        unit: row.unit as string,
        category: row.category as string,
        currentQuantity: Number(sl?.current_quantity ?? 0),
        openedQuantity: Number(sl?.opened_quantity ?? 0),
      }
    })

    return { ok: true, data: items }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── saveCountAction ───────────────────────────────────────────────
// Saves a batch of counted quantities via the atomic RPC.
// Validates role and category before calling the RPC.

export async function saveCountAction(
  entries: CountEntry[],
  category: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const staff = await requireRole('owner', 'manager', 'kitchen', 'front_desk')

    if (!canCountCategory(staff.role, category)) {
      return { ok: false, error: `Your role cannot count ${category}` }
    }

    // Client-side guard (RPC re-validates, but fail fast here)
    for (const entry of entries) {
      if (entry.new_quantity < 0) {
        return { ok: false, error: 'Quantities cannot be negative' }
      }
      if (category === 'Sauces' && entry.opened_quantity > entry.new_quantity) {
        return { ok: false, error: 'Opened quantity cannot exceed total quantity' }
      }
    }

    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.rpc('save_inventory_count', {
      p_entries: entries,
      p_category: category,
    })

    if (error) throw error

    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
```

Note: `requireRole` returns `CurrentStaff` which has a `role` property. Verify this matches the existing `requireRole` signature in `lib/auth/currentStaff.ts` before committing.

- [ ] **Step 2: Check requireRole return type**

```bash
grep -n "export.*requireRole\|returns\|Promise" /Users/bruce/wenxin-app/lib/auth/currentStaff.ts | head -20
```
Confirm `requireRole` returns `CurrentStaff` (or similar type with `.role`). If the signature differs, adjust the action accordingly.

- [ ] **Step 3: Type-check**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1 | grep "count-actions"
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/inventory/count-actions.ts
git commit -m "feat(inventory): add fetchCountItemsAction and saveCountAction"
```

---

## Task 5 — CountSheet Component

**Files:**
- Create: `app/inventory/CountSheet.tsx`

- [ ] **Step 1: Create `app/inventory/CountSheet.tsx`**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { CATEGORY_COUNT_PERMISSIONS } from '@/lib/inventory/permissions'
import { fetchCountItemsAction, saveCountAction } from './count-actions'
import type { CountItem, CountEntry } from '@/lib/inventory/types'

type Screen = 'category' | 'items'

type Props = {
  isOpen: boolean
  role: string
  initialCategory?: string   // set by "Count This Category" shortcut
  onClose: () => void
  onSaved: () => void        // parent re-fetches inventory on success
}

export default function CountSheet({ isOpen, role, initialCategory, onClose, onSaved }: Props) {
  const [screen, setScreen] = useState<Screen>(initialCategory ? 'items' : 'category')
  const [category, setCategory] = useState<string>(initialCategory ?? '')
  const [items, setItems] = useState<CountItem[]>([])
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [openedQtys, setOpenedQtys] = useState<Record<number, string>>({})
  const [loadingItems, setLoadingItems] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const permittedCategories = CATEGORY_COUNT_PERMISSIONS[role] ?? []

  const loadItems = useCallback(async (cat: string) => {
    setLoadingItems(true)
    setLoadError(null)
    const result = await fetchCountItemsAction(cat)
    if (result.ok) {
      setItems(result.data)
      const qtys: Record<number, string> = {}
      const opened: Record<number, string> = {}
      result.data.forEach(item => {
        qtys[item.id] = String(item.currentQuantity)
        opened[item.id] = String(item.openedQuantity)
      })
      setQuantities(qtys)
      setOpenedQtys(opened)
    } else {
      setLoadError(result.error)
    }
    setLoadingItems(false)
  }, [])

  // Load items when category screen transitions
  useEffect(() => {
    if (isOpen && category && screen === 'items') {
      loadItems(category)
    }
  }, [isOpen, category, screen, loadItems])

  // Reset when sheet opens
  useEffect(() => {
    if (isOpen) {
      if (initialCategory) {
        setCategory(initialCategory)
        setScreen('items')
      } else {
        setCategory('')
        setScreen('category')
      }
      setItems([])
      setQuantities({})
      setOpenedQtys({})
      setSaveError(null)
      setToast(null)
    }
  }, [isOpen, initialCategory])

  function selectCategory(cat: string) {
    setCategory(cat)
    setScreen('items')
  }

  function getQty(id: number): number {
    return parseFloat(quantities[id] ?? '0') || 0
  }

  function getOpened(id: number): number {
    return parseFloat(openedQtys[id] ?? '0') || 0
  }

  function openedExceedsTotal(item: CountItem): boolean {
    return category === 'Sauces' && getOpened(item.id) > getQty(item.id)
  }

  const hasValidationError = items.some(openedExceedsTotal)

  async function handleSave() {
    if (hasValidationError) return
    setSaving(true)
    setSaveError(null)

    const entries: CountEntry[] = items.map(item => ({
      item_id: item.id,
      new_quantity: getQty(item.id),
      opened_quantity: category === 'Sauces' ? getOpened(item.id) : 0,
    }))

    const result = await saveCountAction(entries, category)
    setSaving(false)

    if (result.ok) {
      setToast(`Count saved — ${category}`)
      onSaved()
      setTimeout(() => {
        setToast(null)
        onClose()
      }, 1200)
    } else {
      setSaveError(result.error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col">

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 z-[210] bg-green-600 text-white text-sm px-4 py-3 rounded-xl text-center shadow-lg">
          {toast}
        </div>
      )}

      {/* ── Category screen ── */}
      {screen === 'category' && (
        <>
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-lg font-light leading-none"
              aria-label="Close"
            >
              ✕
            </button>
            <span className="font-semibold text-base">Count Stock</span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6">
            <p className="text-sm text-gray-500 mb-4">Select a category to count:</p>
            <div className="flex flex-wrap gap-3">
              {permittedCategories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => selectCategory(cat)}
                  className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 text-sm font-medium hover:bg-orange-50 hover:text-orange-600 transition-colors"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Items screen ── */}
      {screen === 'items' && (
        <>
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            {!initialCategory && (
              <button
                type="button"
                onClick={() => setScreen('category')}
                className="text-gray-400 hover:text-gray-600 text-sm"
                aria-label="Back to categories"
              >
                ←
              </button>
            )}
            {initialCategory && (
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-lg font-light leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            )}
            <span className="font-semibold text-base flex-1">{category}</span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 space-y-3">
            {loadingItems ? (
              <div className="text-center py-16 text-sm text-gray-400">Loading items...</div>
            ) : loadError ? (
              <div className="bg-red-50 rounded-xl p-4 text-sm text-red-500">{loadError}</div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 text-sm text-gray-400">No items in this category</div>
            ) : (
              items.map(item => {
                const qtyVal = quantities[item.id] ?? ''
                const openedVal = openedQtys[item.id] ?? ''
                const isSauce = category === 'Sauces'
                const qtyNum = getQty(item.id)
                const openedNum = getOpened(item.id)
                const openedErr = isSauce && openedNum > qtyNum

                return (
                  <div key={item.id} className="bg-gray-50 rounded-2xl p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Currently: {item.currentQuantity} {item.unit}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-gray-500 w-28 flex-shrink-0">
                          Total counted
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={qtyVal}
                          onChange={e => setQuantities(q => ({ ...q, [item.id]: e.target.value }))}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-orange-400"
                          placeholder="0"
                        />
                        <span className="text-xs text-gray-400 w-12 flex-shrink-0">{item.unit}</span>
                      </div>

                      {isSauce && (
                        <>
                          <div className="flex items-center gap-3">
                            <label className="text-xs text-gray-500 w-28 flex-shrink-0">
                              Opened
                            </label>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={openedVal}
                              onChange={e => setOpenedQtys(q => ({ ...q, [item.id]: e.target.value }))}
                              className={`flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none ${
                                openedErr
                                  ? 'border-red-400 bg-red-50 text-red-700 focus:border-red-500'
                                  : 'border-gray-200 text-gray-900 focus:border-orange-400'
                              }`}
                              placeholder="0"
                            />
                            <span className="text-xs text-gray-400 w-12 flex-shrink-0">{item.unit}</span>
                          </div>
                          {openedErr && (
                            <p className="text-xs text-red-500 pl-31">
                              Opened cannot exceed total
                            </p>
                          )}
                          {!openedErr && (
                            <p className="text-xs text-gray-400 pl-31">
                              Unopened: {Math.max(0, qtyNum - openedNum)} {item.unit}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* ── Save button ── */}
          {!loadingItems && !loadError && items.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-[201] bg-white border-t px-4 py-4 space-y-2">
              {saveError && (
                <div className="text-xs text-red-500 text-center">{saveError}</div>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || hasValidationError}
                className={`w-full py-3 rounded-2xl text-sm font-semibold transition-colors ${
                  saving || hasValidationError
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-orange-500 text-white active:bg-orange-600'
                }`}
              >
                {saving ? 'Saving...' : 'Save Count'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1 | grep "CountSheet"
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/inventory/CountSheet.tsx
git commit -m "feat(inventory): add CountSheet overlay component"
```

---

## Task 6 — Page Integration: Entry Points

**Files:**
- Modify: `app/inventory/page.tsx`

This task adds two entry points:
- **A.** Floating "Count Stock" button (always visible to roles with count permission)
- **B.** "Count This Category" button inside each specific category tab

It also adds `useStaff()` to know the current role for button visibility, and `CountSheet` import.

- [ ] **Step 1: Verify `requireRole` return type to confirm the staff object shape**

```bash
grep -n "export.*requireRole\|export type CurrentStaff\|role:" /Users/bruce/wenxin-app/lib/auth/currentStaff.ts | head -15
grep -n "export type CurrentStaff" /Users/bruce/wenxin-app/lib/auth/types.ts
```

Confirm `CurrentStaff.role` is a `string` or `StaffRole`. `useStaff()` returns a `CurrentStaff | null`.

- [ ] **Step 2: Add imports to `app/inventory/page.tsx`**

Add these three lines to the existing import block at the top of the file:

```typescript
import { useStaff } from '../components/StaffProvider'
import { canCountCategory, CATEGORY_COUNT_PERMISSIONS } from '@/lib/inventory/permissions'
import CountSheet from './CountSheet'
```

- [ ] **Step 3: Add count sheet state inside `InventoryPage` function**

Add these lines after the existing `useState` declarations (after `activeTab`):

```typescript
const staff = useStaff()
const role = staff?.role ?? ''

const [countSheetOpen, setCountSheetOpen] = useState(false)
const [countSheetCategory, setCountSheetCategory] = useState<string | undefined>(undefined)

function openCountSheet(category?: string) {
  setCountSheetCategory(category)
  setCountSheetOpen(true)
}

function handleCountSaved() {
  // Re-fetch inventory data so the page reflects updated last_counted_at and quantities
  setLoading(true)
  fetchInventoryAction().then(result => {
    if (result.ok) setItems(result.data)
    else setFetchError(result.error)
    setLoading(false)
  })
}
```

- [ ] **Step 4: Add "Count This Category" button in the category tab content**

Find the `else` block that renders category and All tab content (the `<div className="space-y-2 pb-4">` block starting around line 237). Replace it with:

```tsx
) : (
  <div className="space-y-2 pb-4">
    {/* ── Count This Category shortcut (category tabs only) ── */}
    {activeTab !== 'All' && canCountCategory(role, activeTab) && (
      <button
        type="button"
        onClick={() => openCountSheet(activeTab)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white rounded-xl border border-orange-200 text-orange-600 text-sm font-medium mb-2"
      >
        <span>Count {activeTab}</span>
        <span className="text-orange-400">→</span>
      </button>
    )}
    {tabItems.length === 0 ? (
      <div className="text-center py-16 text-sm text-gray-400">
        No items in this category
      </div>
    ) : (
      tabItems.map(item => <ItemCard key={item.id} item={item} />)
    )}
  </div>
)}
```

- [ ] **Step 5: Add floating "Count Stock" button and CountSheet**

Find the closing `</main>` and `</PageTransition>` tags (last lines of the return). Add the floating button and CountSheet before `</PageTransition>`:

```tsx
      </div>
    </main>

    {/* ── Floating Count Stock button ── */}
    {CATEGORY_COUNT_PERMISSIONS[role]?.length > 0 && (
      <button
        type="button"
        onClick={() => openCountSheet(undefined)}
        className="fixed bottom-20 right-4 z-50 bg-orange-500 text-white text-sm font-semibold px-4 py-3 rounded-2xl shadow-lg active:bg-orange-600 transition-colors"
      >
        Count Stock
      </button>
    )}

    {/* ── Count Sheet overlay ── */}
    <CountSheet
      isOpen={countSheetOpen}
      role={role}
      initialCategory={countSheetCategory}
      onClose={() => setCountSheetOpen(false)}
      onSaved={handleCountSaved}
    />

    </PageTransition>
```

- [ ] **Step 6: Type-check**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1 | grep "page.tsx\|CountSheet"
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/inventory/page.tsx
git commit -m "feat(inventory): add Count Stock button and Count This Category entry points"
```

---

## Task 7 — End-to-End Verification

Manual verification steps — no automated test required for this task.

- [ ] **Step 1: Verify as owner — full access**

Log in as owner. Open Inventory. Confirm:
- "Count Stock" floating button is visible
- All 6 category chips appear in the Count Sheet category picker
- In the Sauces tab: "Count Sauces" button appears
- Enter Sauces count: update 金汤酸菜鱼酱 qty, set opened qty < total → no error
- Try opened qty > total → Save button disabled, red inline error shown
- Set valid values, tap Save → toast "Count saved — Sauces", overlay closes
- Inventory page refreshes, `last_counted_at` updates (NEED COUNT clears for those items)

- [ ] **Step 2: Verify as kitchen — Drinks blocked**

Log in as kitchen. Open Inventory → Drinks tab.
- "Count Drinks" button must NOT appear
- In Count Sheet category picker: Drinks chip must NOT appear
- Sauces, Fresh, Dry Goods, Packaging, Supplies chips ARE present

- [ ] **Step 3: Verify as front_desk — only Drinks + Packaging**

Log in as front_desk. Open Inventory.
- "Count Stock" button IS visible
- In Count Sheet category picker: only Drinks and Packaging appear
- In Drinks tab: "Count Drinks" button appears
- In Sauces tab: no count button
- Count Packaging → verify save works end-to-end
- Also verify the inventory page itself loads correctly (this was the v1 RLS bug)

- [ ] **Step 4: Verify audit trail**

After any count save, run in Supabase SQL Editor:
```sql
select m.item_id, i.name, m.quantity, m.previous_quantity, m.new_quantity,
       m.created_by, p.name as counted_by, m.notes, m.created_at
from public.inventory_movements m
join public.inventory_items i on i.id = m.item_id
join public.staff_profiles p on p.id = m.created_by
where m.movement_type = 'stock_check'
order by m.created_at desc
limit 10;
```
Expected:
- One row per counted item (including zero-delta items)
- `counted_by` shows the name of the staff who counted — NOT null, NOT a passed-in value
- `notes` = `'Count sheet: [category]'`
- `previous_quantity` = the value from the DB before the count (not the client's submitted value)

- [ ] **Step 5: Verify atomicity**

In Supabase SQL Editor, temporarily change one item_id in a count batch to a non-existent value, call the RPC directly, and verify the entire batch rolls back (no partial updates to `inventory_stock_levels`).

---

## Completion Checklist

- [ ] Migration applied: front_desk SELECT policies exist
- [ ] Migration applied: `save_inventory_count` RPC exists and is security definer
- [ ] Types: `CountItem` and `CountEntry` exported from `lib/inventory/types.ts`
- [ ] Permissions: `CATEGORY_COUNT_PERMISSIONS` and `canCountCategory` in `lib/inventory/permissions.ts`
- [ ] Actions: `fetchCountItemsAction` and `saveCountAction` in `app/inventory/count-actions.ts`
- [ ] Component: `CountSheet.tsx` renders overlay with category picker and item list
- [ ] Page: floating "Count Stock" button visible, opens category picker
- [ ] Page: "Count This Category" appears per category tab, filtered by role
- [ ] front_desk can view inventory (v1 RLS bug fixed)
- [ ] Sauce validation: opened > total disables Save, shows error
- [ ] Audit: every counted item has a movement row, `created_by` is staff ID from `auth.uid()`
- [ ] Atomicity: failed batch leaves zero partial writes
- [ ] TypeScript: `npx tsc --noEmit` passes with no errors
