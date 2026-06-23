# Inventory Reorder Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded Inventory stub with a live, action-focused stock management page that shows reorder warnings for imported Chinese sauces and connects to Supabase for the first time.

**Architecture:** A DB migration extends `inventory_items` and `inventory_stock_levels` with 7 new columns. A new `lib/inventory/status.ts` module computes `DisplayStatus` from those values client-side. A server action joins both tables and returns flat `InventoryView` objects; the page renders them in an Attention-first tab structure with a special sauce card layout.

**Tech Stack:** Next.js 16 App Router · TypeScript · Tailwind CSS v4 · Supabase (postgres) · `'use server'` actions

---

## Confirmed Decisions

1. `reorder_level` stays as the existing column name → means **minimum stock / dangerous threshold**.
2. `reorder_point` is a new column → **sea-freight reorder trigger** (higher than `reorder_level`).
3. `unopened_quantity` is derived: `current_quantity − opened_quantity`. Not stored.
4. `need_count` is a derived client-side status based on `last_counted_at` + category thresholds. No DB flag.
5. No expiry tracking.
6. This version is **read-only**. No stock adjustment, count sheet, or stock-in/out editing.
7. Default tab is **Attention** — shows only `out / low / need_reorder / need_count`.
8. `ok` items appear only in **All** or category tabs.
9. Sauce cards show: stock, opened/unopened, reorder point, lead time, on-order qty, location, supplier.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260623_inventory_sauce_fields.sql` | **Create** | ALTER TABLE adds 7 columns to 2 tables |
| `lib/inventory/types.ts` | **Modify** | Add new fields to `InventoryItem`, `InventoryStockLevel`; add `DisplayStatus`, `InventoryView` |
| `lib/inventory/status.ts` | **Create** | `NEED_COUNT_DAYS`, `INVENTORY_CATEGORIES`, `computeDisplayStatus()` |
| `lib/inventory/__tests__/status.test.ts` | **Create** | Unit tests for `computeDisplayStatus` |
| `lib/inventory/repository.ts` | **Modify** | Update `mapItemRow`, `mapStockLevelRow`; add `findInventoryWithStock()` |
| `app/inventory/actions.ts` | **Create** | `'use server'` action — joins items + stock, builds `InventoryView[]` |
| `app/inventory/page.tsx` | **Rewrite** | Full UI: summary strip, tab chips, Attention groups, sauce card, standard card |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260623_inventory_sauce_fields.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260623_inventory_sauce_fields.sql

-- inventory_items: reorder planning fields (item configuration, rarely changes)
alter table public.inventory_items
  add column if not exists reorder_point  numeric(10,2) default null,
  add column if not exists lead_time_days integer       default null,
  add column if not exists location       text          default null,
  add column if not exists supplier       text          default null;

-- inventory_stock_levels: live count fields (changes frequently)
alter table public.inventory_stock_levels
  add column if not exists opened_quantity   numeric(10,2) not null default 0,
  add column if not exists on_order_quantity numeric(10,2) not null default 0,
  add column if not exists last_counted_at   timestamptz   default null;
```

- [ ] **Step 2: Apply the migration to Supabase**

Run via Supabase dashboard SQL editor or CLI. Verify that both tables have the new columns with no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260623_inventory_sauce_fields.sql
git commit -m "feat(db): add reorder planning columns to inventory tables"
```

---

## Task 2: Extend Types

**Files:**
- Modify: `lib/inventory/types.ts`

- [ ] **Step 1: Replace `lib/inventory/types.ts` with the updated version**

Replace the entire file:

```typescript
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
  reorderLevel: number       // = min stock / dangerous threshold (existing col: reorder_level)
  reorderPoint: number | null // = sea-freight reorder trigger (new col: reorder_point)
  leadTimeDays: number | null
  location: string | null
  supplier: string | null
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
  leadTimeDays: number | null
  location: string | null
  supplier: string | null
  // stock
  currentQuantity: number
  openedQuantity: number
  onOrderQuantity: number
  lastCountedAt: string | null
  lastUpdatedAt: string | null
  // derived
  unopenedQuantity: number  // = currentQuantity - openedQuantity
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
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only from files that use the old `InventoryStockLevel` shape (repository.ts) — those will be fixed in Task 4. Zero errors in `types.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add lib/inventory/types.ts
git commit -m "feat(inventory): extend types with reorder planning + DisplayStatus + InventoryView"
```

---

## Task 3: Status Logic + Tests

**Files:**
- Create: `lib/inventory/status.ts`
- Create: `lib/inventory/__tests__/status.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/inventory/__tests__/status.test.ts`:

```typescript
import { computeDisplayStatus, NEED_COUNT_DAYS } from '../status'

const BASE = {
  currentQuantity: 10,
  reorderLevel: 3,
  reorderPoint: 6 as number | null,
  lastCountedAt: new Date().toISOString() as string | null,
  category: 'Sauces',
}

describe('computeDisplayStatus', () => {
  it('returns out when quantity is 0', () => {
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 0 })).toBe('out')
  })

  it('returns low when quantity equals reorderLevel', () => {
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 3 })).toBe('low')
  })

  it('returns low when quantity is below reorderLevel', () => {
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 1 })).toBe('low')
  })

  it('returns need_reorder when quantity is between reorderLevel and reorderPoint', () => {
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 5 })).toBe('need_reorder')
  })

  it('returns need_reorder when quantity equals reorderPoint', () => {
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 6 })).toBe('need_reorder')
  })

  it('returns ok when quantity is above reorderPoint and recently counted', () => {
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 8 })).toBe('ok')
  })

  it('returns need_count when lastCountedAt is null', () => {
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 8, lastCountedAt: null })).toBe('need_count')
  })

  it('returns need_count for Fresh item not counted in 3 days', () => {
    const old = new Date(Date.now() - 4 * 86_400_000).toISOString()
    expect(computeDisplayStatus({ ...BASE, category: 'Fresh', reorderPoint: null, currentQuantity: 10, lastCountedAt: old })).toBe('need_count')
  })

  it('returns ok for Fresh item counted 2 days ago', () => {
    const recent = new Date(Date.now() - 2 * 86_400_000).toISOString()
    expect(computeDisplayStatus({ ...BASE, category: 'Fresh', reorderPoint: null, currentQuantity: 10, lastCountedAt: recent })).toBe('ok')
  })

  it('returns need_count for Sauces item not counted in 14 days', () => {
    const old = new Date(Date.now() - 15 * 86_400_000).toISOString()
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 8, lastCountedAt: old })).toBe('need_count')
  })

  it('out takes priority over need_count when qty is 0 and never counted', () => {
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 0, lastCountedAt: null })).toBe('out')
  })

  it('low takes priority over need_count when qty is at reorderLevel and never counted', () => {
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 3, lastCountedAt: null })).toBe('low')
  })

  it('NEED_COUNT_DAYS has correct values', () => {
    expect(NEED_COUNT_DAYS['Fresh']).toBe(3)
    expect(NEED_COUNT_DAYS['Drinks']).toBe(7)
    expect(NEED_COUNT_DAYS['Sauces']).toBe(14)
    expect(NEED_COUNT_DAYS['Dry Goods']).toBe(14)
    expect(NEED_COUNT_DAYS['Packaging']).toBe(14)
    expect(NEED_COUNT_DAYS['Supplies']).toBe(14)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/bruce/wenxin-app && npx jest lib/inventory/__tests__/status.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../status'`

- [ ] **Step 3: Create `lib/inventory/status.ts`**

```typescript
import type { DisplayStatus } from './types'

export const INVENTORY_CATEGORIES = [
  'Fresh',
  'Sauces',
  'Dry Goods',
  'Drinks',
  'Packaging',
  'Supplies',
] as const

export type InventoryCategory = typeof INVENTORY_CATEGORIES[number]

export const NEED_COUNT_DAYS: Record<string, number> = {
  Fresh: 3,
  Drinks: 7,
  Sauces: 14,
  'Dry Goods': 14,
  Packaging: 14,
  Supplies: 14,
}

export function computeDisplayStatus(item: {
  currentQuantity: number
  reorderLevel: number
  reorderPoint: number | null
  lastCountedAt: string | null
  category: string
}): DisplayStatus {
  const qty = item.currentQuantity

  if (qty === 0) return 'out'
  if (qty <= item.reorderLevel) return 'low'
  if (item.reorderPoint != null && qty <= item.reorderPoint) return 'need_reorder'

  const threshold = NEED_COUNT_DAYS[item.category] ?? 14
  const cutoff = Date.now() - threshold * 86_400_000
  if (!item.lastCountedAt || new Date(item.lastCountedAt).getTime() < cutoff) return 'need_count'

  return 'ok'
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/bruce/wenxin-app && npx jest lib/inventory/__tests__/status.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS — all 13 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/inventory/status.ts lib/inventory/__tests__/status.test.ts
git commit -m "feat(inventory): add status computation with category-based need_count thresholds"
```

---

## Task 4: Update Repository

**Files:**
- Modify: `lib/inventory/repository.ts`

- [ ] **Step 1: Update `mapItemRow` to include new columns**

In `lib/inventory/repository.ts`, find the `mapItemRow` function and replace it:

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
    leadTimeDays: row.lead_time_days != null ? Number(row.lead_time_days) : null,
    location: (row.location as string) ?? null,
    supplier: (row.supplier as string) ?? null,
    status: row.status as InventoryItem['status'],
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}
```

- [ ] **Step 2: Update `mapStockLevelRow` to include new columns**

Find `mapStockLevelRow` and replace it:

```typescript
function mapStockLevelRow(row: Record<string, unknown>): InventoryStockLevel {
  return {
    id: row.id as number,
    itemId: row.item_id as number,
    outletId: row.outlet_id as string,
    currentQuantity: Number(row.current_quantity ?? 0),
    openedQuantity: Number(row.opened_quantity ?? 0),
    onOrderQuantity: Number(row.on_order_quantity ?? 0),
    lastCountedAt: (row.last_counted_at as string) ?? null,
    lastUpdatedAt: row.last_updated_at as string,
  }
}
```

- [ ] **Step 3: Add `findInventoryWithStock` at the end of the Stock Levels section**

After the closing brace of `findLowStockItems`, add:

```typescript
export async function findInventoryWithStock(
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<Array<{ item: InventoryItem; stock: InventoryStockLevel | null }>> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*, inventory_stock_levels(*)')
    .eq('outlet_id', outletId)
    .eq('status', 'active')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error

  return (data ?? []).map(row => {
    const r = row as Record<string, unknown>
    const stockRows = r.inventory_stock_levels
    const stockRow = Array.isArray(stockRows) ? stockRows[0] : stockRows
    return {
      item: mapItemRow(r),
      stock: stockRow ? mapStockLevelRow(stockRow as Record<string, unknown>) : null,
    }
  })
}
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1 | grep "inventory/repository" | head -10
```

Expected: no errors in `repository.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/inventory/repository.ts
git commit -m "feat(inventory): update repository mappers + add findInventoryWithStock"
```

---

## Task 5: Server Action

**Files:**
- Create: `app/inventory/actions.ts`

- [ ] **Step 1: Create `app/inventory/actions.ts`**

```typescript
'use server'

import { requireRole } from '@/lib/auth/currentStaff'
import { findInventoryWithStock } from '@/lib/inventory/repository'
import { computeDisplayStatus } from '@/lib/inventory/status'
import type { InventoryView } from '@/lib/inventory/types'

export async function fetchInventoryAction(): Promise<
  { ok: true; data: InventoryView[] } | { ok: false; error: string }
> {
  try {
    await requireRole('owner', 'manager', 'kitchen')
    const rows = await findInventoryWithStock()

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
        leadTimeDays: item.leadTimeDays,
        location: item.location,
        supplier: item.supplier,
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

    return { ok: true, data: views }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1 | grep "inventory/actions" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/inventory/actions.ts
git commit -m "feat(inventory): add fetchInventoryAction server action"
```

---

## Task 6: Rewrite Inventory Page

**Files:**
- Rewrite: `app/inventory/page.tsx`

- [ ] **Step 1: Replace `app/inventory/page.tsx` with the full rewrite**

```typescript
'use client'

import { useState, useEffect } from 'react'
import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'
import { fetchInventoryAction } from './actions'
import { INVENTORY_CATEGORIES } from '@/lib/inventory/status'
import type { InventoryView } from '@/lib/inventory/types'
import type { DisplayStatus } from '@/lib/inventory/types'

// ── Status badge config ──────────────────────────────────────────────
const STATUS_BADGE: Record<DisplayStatus, { label: string; color: string }> = {
  out:          { label: 'Out of Stock',  color: 'bg-red-100 text-red-600' },
  low:          { label: 'Low Stock',     color: 'bg-orange-100 text-orange-600' },
  need_reorder: { label: 'Need Reorder',  color: 'bg-amber-100 text-amber-700' },
  need_count:   { label: 'Need Count',    color: 'bg-gray-100 text-gray-500' },
  ok:           { label: 'OK',            color: 'bg-green-100 text-green-600' },
}

const ATTENTION_ORDER: DisplayStatus[] = ['out', 'low', 'need_reorder', 'need_count']

const SECTION_LABEL: Record<DisplayStatus, string> = {
  out:          'Out of Stock',
  low:          'Low Stock',
  need_reorder: 'Need Reorder',
  need_count:   'Need Count',
  ok:           '',
}

const SECTION_COLOR: Record<DisplayStatus, string> = {
  out:          'text-red-500',
  low:          'text-orange-500',
  need_reorder: 'text-amber-700',
  need_count:   'text-gray-400',
  ok:           '',
}

// ── Standard card ────────────────────────────────────────────────────
function StandardCard({ item }: { item: InventoryView }) {
  const badge = STATUS_BADGE[item.displayStatus]
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">{item.name}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          Stock: {item.currentQuantity} {item.unit}
        </div>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${badge.color}`}>
        {badge.label}
      </span>
    </div>
  )
}

// ── Sauce card ───────────────────────────────────────────────────────
function SauceCard({ item }: { item: InventoryView }) {
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
          {item.leadTimeDays ? ` · Lead time ${item.leadTimeDays} days` : ''}
        </div>
      )}

      {item.onOrderQuantity > 0 && (
        <div className="text-xs text-blue-600">
          On order: {item.onOrderQuantity} {item.unit}
        </div>
      )}

      {(item.location || item.supplier) && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {item.location && (
            <span className="text-xs text-gray-400">Location: {item.location}</span>
          )}
          {item.supplier && (
            <span className="text-xs text-gray-400">Supplier: {item.supplier}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Card dispatcher ──────────────────────────────────────────────────
function ItemCard({ item }: { item: InventoryView }) {
  return item.category === 'Sauces' ? <SauceCard item={item} /> : <StandardCard item={item} />
}

// ── Page ─────────────────────────────────────────────────────────────
type Tab = 'Attention' | 'All' | typeof INVENTORY_CATEGORIES[number]

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryView[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('Attention')

  useEffect(() => {
    fetchInventoryAction().then(result => {
      if (result.ok) setItems(result.data)
      else setFetchError(result.error)
      setLoading(false)
    })
  }, [])

  // Summary counts
  const outCount       = items.filter(i => i.displayStatus === 'out').length
  const lowCount       = items.filter(i => i.displayStatus === 'low').length
  const reorderCount   = items.filter(i => i.displayStatus === 'need_reorder').length
  const actionCount    = outCount + lowCount + reorderCount

  // Filtered item list for current tab
  const tabItems =
    activeTab === 'Attention' ? items.filter(i => i.displayStatus !== 'ok') :
    activeTab === 'All'       ? items :
    items.filter(i => i.category === activeTab)

  // Attention groups (sections per status, only non-empty)
  const attentionGroups = ATTENTION_ORDER
    .map(status => ({ status, items: tabItems.filter(i => i.displayStatus === status) }))
    .filter(g => g.items.length > 0)

  const tabs: Tab[] = ['Attention', 'All', ...INVENTORY_CATEGORIES]

  return (
    <PageTransition>
    <main className="bg-gray-50 w-full mx-auto min-h-screen pb-32">

      {/* ── Header ── */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-10">
        <BackButton href="/" />
        <span className="font-semibold text-base flex-1">Inventory</span>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ── Summary strip ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-xl font-bold text-gray-900">{items.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">Total</div>
            </div>
            <div>
              <div className="text-xl font-bold text-orange-500">{lowCount}</div>
              <div className="text-xs text-gray-400 mt-0.5">Low Stock</div>
            </div>
            <div>
              <div className="text-xl font-bold text-red-500">{outCount}</div>
              <div className="text-xs text-gray-400 mt-0.5">Out of Stock</div>
            </div>
            <div>
              <div className="text-xl font-bold text-amber-600">{reorderCount}</div>
              <div className="text-xs text-gray-400 mt-0.5">Need Reorder</div>
            </div>
          </div>
        </div>

        {/* ── Tab chips ── */}
        <div
          className="flex gap-2 overflow-x-auto -mx-4 px-4"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' as never }}
        >
          {tabs.map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {tab}
              {tab === 'Attention' && actionCount > 0 && (
                <span className="ml-1">{actionCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="text-center py-16 text-sm text-gray-400">Loading...</div>
        ) : fetchError ? (
          <div className="bg-red-50 rounded-2xl p-4 text-sm text-red-500">{fetchError}</div>
        ) : activeTab === 'Attention' ? (
          attentionGroups.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400">
              All good — no action needed.
            </div>
          ) : (
            <div className="space-y-5 pb-4">
              {attentionGroups.map(group => (
                <div key={group.status}>
                  <div className={`text-xs font-semibold mb-2 px-1 uppercase tracking-wide ${SECTION_COLOR[group.status]}`}>
                    {SECTION_LABEL[group.status]}
                  </div>
                  <div className="space-y-2">
                    {group.items.map(item => <ItemCard key={item.id} item={item} />)}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-2 pb-4">
            {tabItems.length === 0 ? (
              <div className="text-center py-16 text-sm text-gray-400">
                No items in this category.
              </div>
            ) : (
              tabItems.map(item => <ItemCard key={item.id} item={item} />)
            )}
          </div>
        )}

      </div>
    </main>
    </PageTransition>
  )
}
```

- [ ] **Step 2: Type-check the full build**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 3: Run all status tests to confirm no regressions**

```bash
cd /Users/bruce/wenxin-app && npx jest lib/inventory/__tests__/status.test.ts --no-coverage 2>&1 | tail -5
```

Expected: 13 tests passing.

- [ ] **Step 4: Commit**

```bash
git add app/inventory/page.tsx
git commit -m "feat(inventory): rewrite page with Attention tab, sauce cards, and live Supabase data"
```

---

## Task 7: Seed Sample Data (Manual — Owner Only)

This task is manual (no code). After the migration is applied, insert a few inventory items via the Supabase dashboard to verify the UI.

**Minimum viable seed — 3 items to exercise all card types:**

**Sauce item (triggers sauce card + reorder warning):**
```sql
-- Insert item
insert into public.inventory_items (name, category, unit, reorder_level, reorder_point, lead_time_days, location, supplier, status)
values ('金汤酸菜鱼酱', 'Sauces', 'tubs', 2, 6, 45, 'Sauce Shelf A', 'Ah Keong 进口', 'active')
returning id;

-- Insert stock level (use the id returned above, e.g. 1)
insert into public.inventory_stock_levels (item_id, current_quantity, opened_quantity, on_order_quantity)
values (1, 3, 1, 0);
```

**Fresh item (triggers short need_count cycle):**
```sql
insert into public.inventory_items (name, category, unit, reorder_level, status)
values ('Bok Choy', 'Fresh', 'kg', 5, 'active')
returning id;

insert into public.inventory_stock_levels (item_id, current_quantity)
values (2, 3);  -- low stock: qty 3 <= reorder_level 5
```

**Dry Goods item (OK status):**
```sql
insert into public.inventory_items (name, category, unit, reorder_level, status)
values ('White Rice', 'Dry Goods', 'kg', 10, 'active')
returning id;

insert into public.inventory_stock_levels (item_id, current_quantity, last_counted_at)
values (3, 25, now());
```

- [ ] **Step 1:** Run the SQL above in Supabase dashboard SQL editor
- [ ] **Step 2:** Open the Inventory page in the app and verify:
  - Attention tab shows Bok Choy (Low Stock) and 金汤酸菜鱼酱 (Need Reorder)
  - White Rice does NOT appear in Attention (it is OK)
  - Sauces tab shows 金汤酸菜鱼酱 with the reorder warning: "Reorder at 6 tubs · Lead time 45 days"
  - All tab shows all 3 items
  - Summary strip counts are correct

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| DB: `reorder_point`, `lead_time_days`, `location`, `supplier` on `inventory_items` | Task 1 |
| DB: `opened_quantity`, `on_order_quantity`, `last_counted_at` on `inventory_stock_levels` | Task 1 |
| `reorder_level` = min stock threshold (existing col, unchanged) | Confirmed in types (Task 2) |
| `unopened_quantity` derived, not stored | Task 5 action computes it |
| Status: `out > low > need_reorder > need_count > ok` priority | Task 3 `computeDisplayStatus` |
| Need Count thresholds: Fresh 3d, Drinks 7d, Sauces/DG/Pkg/Sup 14d | Task 3 `NEED_COUNT_DAYS` |
| Summary strip: Total, Low Stock, Out of Stock, Need Reorder (no Expiry) | Task 6 page |
| Default tab: Attention | Task 6 `useState<Tab>('Attention')` |
| Attention shows only Out/Low/Need Reorder/Need Count; not OK | Task 6 `filter(i => i.displayStatus !== 'ok')` |
| Category tabs: Fresh, Sauces, Dry Goods, Drinks, Packaging, Supplies, All | Task 6, from `INVENTORY_CATEGORIES` |
| Sauce card: name, total, opened/unopened, reorder warning, lead time, on-order, location, supplier | Task 6 `SauceCard` |
| Standard card: name, stock, status badge | Task 6 `StandardCard` |
| Page is read-only (no edit UI) | No edit handler anywhere |
| No expiry tracking | No expiry field in types, action, or UI |

**Placeholder scan:** None found. All steps contain complete code.

**Type consistency check:**
- `DisplayStatus` defined in `types.ts` (Task 2), used in `status.ts` (Task 3), `actions.ts` (Task 5), `page.tsx` (Task 6) — consistent.
- `InventoryView` defined in `types.ts` (Task 2), built in `actions.ts` (Task 5), consumed in `page.tsx` (Task 6) — consistent.
- `computeDisplayStatus` defined in `status.ts` (Task 3), called in `actions.ts` (Task 5) — parameter shape matches.
- `findInventoryWithStock` defined in `repository.ts` (Task 4), imported in `actions.ts` (Task 5) — consistent.
