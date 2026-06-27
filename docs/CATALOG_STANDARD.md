# Purchase Catalog Standard — Wenxin Operations

> This document defines the authoritative rules for the `purchase_catalog` table.
> Read it before adding, updating, merging, or deleting any catalog item.

---

## 1. Purpose

`purchase_catalog` is the **master item reference** for the entire Wenxin Operations system.

It is used by:
- **Purchase flow** — staff search for items when creating purchase requests
- **Inventory module** — items are matched by Chinese name (`name_zh`) to track stock
- **China Import** — incoming stock is identified and registered against catalog items
- **Cost tracking** — unit cost and landed cost are associated with catalog items
- **Reports** — spend and inventory data rolls up by category using catalog classification

The goal is a single source of truth: one catalog entry per real-world item, consistently named, correctly categorized, and fully cross-referenced by every module.

---

## 2. Table Schema

```sql
purchase_catalog (
  id               serial          PRIMARY KEY,
  seq              integer         NOT NULL,          -- display order
  name_zh          text            NOT NULL,          -- Chinese name (primary)
  name_ms          text,                              -- Malay or English display name (secondary)
  category         text            NOT NULL,          -- matches PURCHASE_CATEGORIES
  unit             text            NOT NULL,          -- default purchase unit
  active           boolean         NOT NULL DEFAULT true,
  purchase_source  text            NOT NULL DEFAULT 'local'
                                   CHECK (purchase_source IN ('local', 'china', 'both')),
  track_inventory  boolean         NOT NULL DEFAULT true,
  created_at       timestamptz     NOT NULL DEFAULT now()
)
```

### Field Rules

| Field | Rule |
|---|---|
| `name_zh` | **Required. Never null.** Chinese name is the primary identifier. Must be unique within the catalog. |
| `name_ms` | Malay name for local produce and ingredients. For China-import specialty items with no natural Malay equivalent, use a short English name (e.g., `'Golden Soup Base'`). |
| `category` | Must be a valid value from `PURCHASE_CATEGORIES`. See Section 4. |
| `unit` | Default unit for purchase quantities. See Section 5 for approved values. |
| `active` | Set to `false` to retire an item. Never delete rows — historical records depend on `name_zh` matching. |
| `purchase_source` | `'local'` for KK/Malaysia purchases. `'china'` for items imported from China. `'both'` when the same item can come from either source. |
| `track_inventory` | `true` for food, packaging, and ingredients. `false` for gas, cleaning supplies, and consumables where stock counting adds no operational value. |
| `seq` | Sequential display order. Assign the next available integer. Current maximum: **154**. |

---

## 3. The `name_en` Column — Do Not Use

The original migration created a `name_en` column. It is **not used by the application**:

- Not selected in `fetchCatalogAction()` (`actions.ts`)
- Not in the `CatalogItem` TypeScript type (`lib/purchaseLedger/catalog.ts`)
- Not rendered anywhere in the UI
- Not used for search

**Rule: Never write `name_en` in any new migration or query.** If you need an English display name, put it in `name_ms`.

The column exists in the database but is invisible to the application. Treat it as legacy infrastructure.

---

## 4. Categories

Categories are defined in `lib/purchaseLedger/categories.ts` as `PURCHASE_CATEGORIES`. The database stores them as free text — the TypeScript constant is the authoritative list.

| Category | Color | Typical items |
|---|---|---|
| `Seafood` | `#3b82f6` | Fish, prawns, crab, dried anchovies |
| `Meat` | `#ef4444` | Beef, chicken, lamb |
| `Vegetables` | `#22c55e` | Fresh vegetables, herbs, fruit used as ingredients |
| `Grocery` | `#f59e0b` | Dry goods, tofu, eggs, noodles, spices, condiments |
| `Sauces` | `#f97316` | Pre-made sauce bases, vinegars, specialty pastes sourced from China or locally |
| `Beverage` | `#06b6d4` | Beer, soft drinks, water, tea |
| `Packaging` | `#8b5cf6` | Takeaway containers, bags, straws, POS paper, cutlery sets |
| `Others` | `#9ca3af` | Gas, cleaning supplies, pest control, equipment |

**To add a new category:**
1. Add the string to `PURCHASE_CATEGORIES` array in `lib/purchaseLedger/categories.ts`
2. Add its hex color to `CATEGORY_COLOR` in the same file
3. No database migration required

**Do not invent categories in SQL** that are not in `PURCHASE_CATEGORIES`. They will appear in the purchase flow UI without a color and will sort to the bottom.

---

## 5. Approved Units

Use these unit values consistently. Do not invent variants.

| Unit | Use for |
|---|---|
| `kg` | Items sold by weight |
| `g` | Small-quantity weight items |
| `tub` | Sauce/paste in tub packaging (e.g., soup bases, bean paste) |
| `bottle` | Liquids in bottles (e.g., vinegar, soy sauce, cooking oil) |
| `bag` | Items in bags (vegetables, rice, dry goods) |
| `pack` | Items in sealed packs (noodles, cornstarch, spice packs) |
| `pcs` | Individual pieces (eggs counted separately, packaging items) |
| `tray` | Eggs and similar items sold by tray |
| `box` | Items sold by box |
| `carton` | Beverages sold by carton |
| `bundle` | Herbs and leafy items sold in bundles |
| `roll` | Roll-form items (POS paper) |
| `set` | Multi-piece sets (cutlery sets) |
| `pail` | Items sold by pail (dish soap, cooking oil) |
| `pairs` | Items sold in pairs |

---

## 6. Before Adding a New Item

Run this mental checklist:

1. **Search by Chinese name** — is it already in the catalog under a different `name_zh`?
2. **Search by Malay name** — is it already there under a different `name_ms`?
3. **Check for semantic duplicates** — e.g., `菠萝` (seq 40) and `黄梨` (seq 24) are both pineapple; do not add a third.
4. **Is it a variant of an existing item?** If the difference is only brand, size, or specification, consider whether the existing item covers it or whether a new item is truly needed.
5. **Does it belong in core?** The catalog contains items the restaurant actually purchases. Do not add aspirational or hypothetical items.

If a new item is genuinely needed:
- Use the next available `seq` (currently: 150+)
- Write a migration file — never insert directly via the SQL editor without a migration

---

## 7. Updating Existing Items

### Name changes
Update `name_ms` for the secondary/display name. If the Chinese name (`name_zh`) is wrong, update it — but verify no inventory records already reference the old name before changing it.

### Category or unit changes
Write an UPDATE migration. Use the `seq` number AND `name_zh` in the WHERE clause to prevent accidental updates:

```sql
UPDATE public.purchase_catalog
SET category = 'Sauces', unit = 'tub'
WHERE seq = 71 AND name_zh = '柱侯酱';
```

### Retiring an item
Set `active = false`. Do not delete the row.

---

## 8. China Import Classification

When registering China-imported stock, catalog items are identified by their `name_zh`. The workflow is:

1. Match incoming item to a catalog entry by Chinese name
2. If no match exists, create a new catalog item first (via migration)
3. Set `purchase_source = 'china'` or `'both'` on the catalog item
4. Create an `inventory_movements` record with `movement_type = 'purchase_receive'`
5. Update `inventory_stock_levels.current_quantity`

**China imports must never create `purchase_requests` or affect `cash_drawer_sessions`.**

The `purchase_source` field on the catalog item signals to the China Import workflow which items are eligible for import registration.

---

## 9. Current Catalog Summary

As of 2026-06-27:

| Range | Count | Notes |
|---|---|---|
| seq 1–40 | 40 | Vegetables & Fruit |
| seq 41–98 | 58 | Grocery (dry goods, condiments, staples) |
| seq 99–105 | 7 | Seafood |
| seq 106–117 | 12 | Meat |
| seq 118–138 | 21 | Beverage, Packaging, Others |
| seq 139–142 | 4 | Added 2026-06-22 |
| seq 143–149 | 7 | Added 2026-06-26 (Sauces + Packaging) |
| seq 150–154 | 5 | Added 2026-06-27 (Vegetables + Seafood + Sauces) |
| **Total** | **154** | Next available seq: **155** |

Items recently migrated from `Grocery` to `Sauces`:
- seq 71 — 柱侯酱 (Zhuhou Sauce)
- seq 72 — 鸡煲酱 (Chicken Hotpot Sauce)
- seq 74 — 蒸鱼豉油 (Steamed Fish Soy Sauce)
- seq 76 — 黄豆酱 (Soybean Paste)

---

## 10. Known Duplicate to Watch

`黄梨` (seq 24) and `菠萝` (seq 40) are both Pineapple. They exist as separate entries because they may refer to different local varieties (local yellow pineapple vs standard pineapple). Do not add a third pineapple entry. If these are confirmed to be the same item, merge them in a future migration by retiring one (set `active = false`).
