# Bento Order Form — Weekly Menu + Custom Combos

**Date:** 2026-06-22  
**Scope:** `app/bento/new/page.tsx` + `app/bento/orders/[id]/edit/page.tsx`

---

## Problem

Both the new-order and edit-order forms hardcode `Light` / `Flavorful` as the only flavor options. There is no way to:
- Select flavors by their actual weekly-menu variant names dynamically
- Build Sydney-style bulk orders: multiple custom combos (protein + veg + staple) each with their own pax count

---

## Design

### Menu section — two layers (same in both forms)

#### Layer 1 — Weekly menu flavors (dynamic)

On mount (and whenever delivery date changes), fetch `bento_weekly_menu_assignments` for the selected date's `week_start` + `day_of_week`. Also fetch `bento_menu_variants` (id, code, name).

- **Has assignments for that day** → show each active variant as a row with a `−/qty/+` stepper, default qty = 0. Variants with no assignment for that day are hidden (not grayed — just absent).
- **No assignments at all for that day** → show a muted banner: *"No weekly menu set for this day — use custom combos below."* Variant rows hidden entirely.

Display order follows `bento_menu_variants.display_order`. Variant names come from `bento_menu_variants.name` (e.g. "Light", "Flavorful", "Vegetarian").

#### Layer 2 — Custom combos (Sydney style)

A list of combo rows, each containing:
- Dropdown: 荤菜 (protein) — from `bento_proteins`
- Dropdown: 素菜 (vegetable) — from `bento_vegetables`
- Dropdown: 主食 (staple) — from `bento_staples`
- `−/qty/+` stepper, min 1

"+ Add combo" button at top-right of section header adds a new empty row.  
Each row has an `×` delete button.  
All three dropdowns optional — a combo is valid as long as at least one is selected.

---

### Quantity + pricing

`totalQty` = sum of all variant steppers + sum of all custom combo qtys  
`total` = `unitPrice × totalQty`  
Displayed as before: unit price input + read-only qty + total row.

---

### items text (written to DB)

Built the same way as today's `new/page.tsx`:
- Variant rows: `"Light x5, Flavorful x3"`
- Custom combos: each rendered as `"[protein desc / veg desc / staple desc] x10"` — using `description` if present, falling back to `name`

`menu_type`: if any variant rows have qty > 0, use the first variant's `code`; else `"custom"`.

`compartment_a/b/c`: from the first custom combo's selections (for kitchen display), same logic as today.

---

### Data fetching

Both forms already fetch proteins/vegetables/staples on mount — no change needed there.

**New fetch needed in both forms:**
```ts
// On mount + whenever delivery_date changes
const dow = dowFromDate(form.delivery_date)          // Mon=0 … Sun=6
const weekStart = getWeekStart(form.delivery_date)
supabase
  .from('bento_weekly_menu_assignments')
  .select('variant_id')
  .eq('week_start', weekStart)
  .eq('day_of_week', dow)
```
Cross-referenced against `bento_menu_variants` (fetched once on mount).

---

### State shape

```ts
// Replaces current orderItems: OrderItem[]
type VariantQty = { variant_id: number; code: string; name: string; qty: number }
// variantRows: one entry per active variant for the selected day (qty=0 default)

// Replaces current customItems: CustomItem[]
type CustomCombo = { protein_id: number|null; vegetable_id: number|null; staple_id: number|null; qty: number }
```

---

### Edit form specifics

Edit currently has no custom combos section and doesn't load existing `items` text back into structured state. Since the DB stores `items` as a plain text string (not structured JSON), on load the edit form will start with:
- variant steppers at 0 (user re-selects if applicable)
- no custom combos (user re-adds if applicable)
- existing `quantity` and `amount` preserved

This is acceptable — editing is already a "re-describe the order" flow.

---

### Files changed

| File | Change |
|------|--------|
| `app/bento/new/page.tsx` | Replace hardcoded variant buttons + existing custom section with new two-layer Menu component |
| `app/bento/orders/[id]/edit/page.tsx` | Replace hardcoded variant buttons with two-layer Menu component; add custom combos section |

No new files, no DB changes, no API changes.
