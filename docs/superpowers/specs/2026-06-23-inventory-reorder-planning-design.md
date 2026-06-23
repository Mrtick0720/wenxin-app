# Inventory — Reorder Planning Redesign

**Date:** 2026-06-23  
**Scope:** Redesign the Inventory page from a hardcoded stub to a live, action-focused stock management tool with reorder planning for imported Chinese sauces.

---

## Problem

The current Inventory page (`app/inventory/page.tsx`) is a hardcoded stub with no Supabase connection. It uses a flat `food | supplies` tab structure with only three statuses (`ok / low / out`) and no concept of reorder planning, opened/unopened tracking, or sea-freight lead times.

The primary risk for this restaurant is **running out of imported Chinese sauces before the next sea freight shipment arrives** — not expiry. The existing schema has the basic shape but is missing all sauce-specific fields.

---

## Business Rules

### Stock Status (derived, not stored)

Priority (highest wins):

| Status | Condition |
|---|---|
| `out` | `current_quantity = 0` |
| `low` | `0 < current_quantity ≤ reorder_level` |
| `need_reorder` | `reorder_level < current_quantity ≤ reorder_point` |
| `need_count` | `last_counted_at` is null OR older than category threshold |
| `ok` | none of the above |

`reorder_level` = minimum stock (dangerous threshold — existing column, meaning unchanged).  
`reorder_point` = new column, the higher trigger for sea-freight reorder. Only meaningful if `reorder_point > reorder_level`.

### Need Count thresholds by category

| Category | Threshold |
|---|---|
| Fresh | 3 days |
| Drinks | 7 days |
| Sauces | 14 days |
| Dry Goods | 14 days |
| Packaging | 14 days |
| Supplies | 14 days |

Status is computed client-side from `last_counted_at` and category. No manual flag. No expiry tracking.

---

## Database Changes

### New migration: `20260623_inventory_sauce_fields.sql`

**`inventory_items` — add 4 columns (item configuration, rarely changes):**

```sql
alter table public.inventory_items
  add column if not exists reorder_point    numeric(10,2) default null,
  add column if not exists lead_time_days   integer       default null,
  add column if not exists location         text          default null,
  add column if not exists supplier         text          default null;
```

- `reorder_point`: quantity at which to place a new order (higher than `reorder_level` for imported goods)
- `lead_time_days`: sea freight transit days (e.g. 45 for Chinese sauces)
- `location`: shelf/area label (e.g. "Sauce Shelf A")
- `supplier`: supplier or source name (e.g. "Ah Keong 进口")

**`inventory_stock_levels` — add 3 columns (live counts, changes frequently):**

```sql
alter table public.inventory_stock_levels
  add column if not exists opened_quantity   numeric(10,2) not null default 0,
  add column if not exists on_order_quantity numeric(10,2) not null default 0,
  add column if not exists last_counted_at   timestamptz   default null;
```

- `opened_quantity`: subset of `current_quantity` (bottles/tubs already opened)
- `unopened_quantity`: **derived** — `current_quantity − opened_quantity` (not stored)
- `on_order_quantity`: units in transit / on order, not yet received
- `last_counted_at`: timestamp of the last physical stock count; null = never counted

No schema changes to `inventory_movements` or `inventory_adjustments`.

---

## Data Fetch

Single Supabase query joining both tables:

```sql
select
  i.id, i.name, i.category, i.unit, i.notes,
  i.reorder_level, i.reorder_point, i.lead_time_days,
  i.location, i.supplier,
  s.current_quantity, s.opened_quantity, s.on_order_quantity,
  s.last_counted_at, s.last_updated_at
from inventory_items i
left join inventory_stock_levels s on s.item_id = i.id
where i.status = 'active'
order by i.category, i.name
```

Loaded once on mount. No realtime subscription needed for this version.

---

## Status Computation (client-side TypeScript)

```ts
const NEED_COUNT_DAYS: Record<string, number> = {
  Fresh: 3,
  Drinks: 7,
  Sauces: 14,
  'Dry Goods': 14,
  Packaging: 14,
  Supplies: 14,
}

function computeStatus(item: InventoryItem): ItemStatus {
  const qty = item.current_quantity ?? 0
  if (qty === 0) return 'out'
  if (item.reorder_level != null && qty <= item.reorder_level) return 'low'
  if (item.reorder_point != null && qty <= item.reorder_point) return 'need_reorder'
  const threshold = NEED_COUNT_DAYS[item.category] ?? 14
  const cutoff = Date.now() - threshold * 86_400_000
  if (!item.last_counted_at || new Date(item.last_counted_at).getTime() < cutoff) return 'need_count'
  return 'ok'
}
```

---

## UI Structure

### Page layout

```
Fixed header: ← Inventory

Summary strip (4 chips, horizontal):
  Total Items  ·  Low Stock  ·  Out of Stock  ·  Need Reorder

Tab bar (horizontal scroll, sticky below header):
  [Attention ●]  [All]  [Fresh]  [Sauces]  [Dry Goods]  [Drinks]  [Packaging]  [Supplies]

Content area (scrolls):
  <tab content>
```

### Attention tab (default)

Shows action items only, grouped by severity:

1. **Out of Stock** — red section header
2. **Low Stock** — orange section header
3. **Need Reorder** — amber section header
4. **Need Count** — gray section header

`ok` items are never shown in the Attention tab.  
Each section is hidden if it has zero items. If all sections are empty, show an empty state: "All good — no action needed."

### Category tabs (All + 6 categories)

Show **all** items in that category (including OK). Same card components as Attention tab, but no section grouping — sorted by status priority then name.

### Card components

**Standard card** (Fresh, Dry Goods, Drinks, Packaging, Supplies):
```
[Name]                               [Status badge]
Stock: 12 kg
```

**Sauce card** (category = "Sauces"):
```
[Name]                               [Status badge]
Stock: 3 tubs  ·  Opened 1 · Unopened 2
[Reorder warning if stock ≤ reorder_point]:
  "Reorder at 6 tubs · Lead time 45 days"
Location: Sauce Shelf A
Supplier: Ah Keong 进口             (if set)
```

The reorder warning line is shown only when `reorder_point` is set AND `current_quantity ≤ reorder_point`.

### Summary strip values

- **Total Items**: count of all active items
- **Low Stock**: count where `status = 'low'`
- **Out of Stock**: count where `status = 'out'`
- **Need Reorder**: count where `status = 'need_reorder'`

No "Expiring Soon" chip.

---

## File Changes

| File | Change |
|---|---|
| `supabase/migrations/20260623_inventory_sauce_fields.sql` | New migration — ALTER TABLE adds 7 columns |
| `app/inventory/page.tsx` | Full rewrite — live Supabase data, new UI |
| `lib/inventory/types.ts` | New — TypeScript types for inventory items |
| `lib/inventory/status.ts` | New — `computeStatus()`, `NEED_COUNT_DAYS`, category list |

No new components needed. Sauce card vs standard card is an inline conditional inside `page.tsx`. The page is read-only in this version — no stock editing UI.

---

## Out of Scope (this version)

- Stock editing / count sheet UI
- Stock movement history
- On-order receiving flow
- Expiry tracking
- Push notifications for low stock
- Multi-outlet support (single outlet only)
