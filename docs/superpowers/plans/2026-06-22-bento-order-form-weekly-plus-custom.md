# Bento Order Form — Weekly Menu + Custom Combos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded Light/Flavorful flavor buttons in both the new-order and edit-order bento forms with (1) dynamic weekly-menu variant steppers for the selected date, and (2) Sydney-style custom combo rows (protein + veg + staple + qty).

**Architecture:** Both forms get the same two-layer Menu section. Layer 1 fetches `bento_weekly_menu_assignments` for the selected delivery date and renders a qty stepper per assigned variant. Layer 2 is a list of custom combo rows (荤+素+主食+qty). `totalQty` is the sum of both layers and drives pricing. No new files, no DB changes.

**Tech Stack:** Next.js App Router, React, Supabase JS client, TypeScript, Tailwind CSS v4

---

## File Map

| File | What changes |
|------|-------------|
| `app/bento/new/page.tsx` | Remove `OrderItem`/`CustomItem` types + handlers; add `VariantQty`/`CustomCombo` types; add weekly-menu fetch; replace Menu UI; update `handleSubmit` |
| `app/bento/orders/[id]/edit/page.tsx` | Add helpers + new types; add proteins/veg/staples fetch; add weekly-menu fetch; replace Menu UI (remove manual qty stepper); update `handleSave` |

---

## Task 1: Update `new/page.tsx` — types, state, and weekly-menu fetch

**Files:**
- Modify: `app/bento/new/page.tsx`

### What to replace / add

- [ ] **Step 1: Replace the old types and add new ones**

Find and delete these three type lines near the top of the file (lines ~23-25):
```ts
type OrderItem = { variant: string; quantity: number }
type Component = { id: number; name: string; description: string | null; is_active: boolean }
type CustomItem = { protein_id: number | null; vegetable_id: number | null; staple_id: number | null; qty: number }
```

Replace with:
```ts
type BentoVariant = { id: number; code: string; name: string }
type Component    = { id: number; name: string; description: string | null; is_active: boolean }
type CustomCombo  = { protein_id: number | null; vegetable_id: number | null; staple_id: number | null; qty: number }
```

- [ ] **Step 2: Add `getWeekStart` helper**

After the existing `dowFromDate` function (around line 48), add:
```ts
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
```

- [ ] **Step 3: Replace old order-item state with new state**

Inside `NewBentoOrder`, find and delete:
```ts
const [orderItems, setOrderItems] = useState<OrderItem[]>([{ variant: '', quantity: 1 }])
const [customItems, setCustomItems] = useState<CustomItem[]>([])
```

Replace with:
```ts
const [allVariants, setAllVariants]             = useState<BentoVariant[]>([])
const [assignedVariantIds, setAssignedVariantIds] = useState<number[] | null>(null)
const [variantQtys, setVariantQtys]             = useState<Record<number, number>>({})
const [customCombos, setCustomCombos]           = useState<CustomCombo[]>([])
```

- [ ] **Step 4: Add fetch for `bento_menu_variants` (once on mount)**

After the existing component-list `useEffect` (the one that fetches proteins/vegetables/staples), add:
```ts
useEffect(() => {
  supabase
    .from('bento_menu_variants')
    .select('id,code,name')
    .eq('is_active', true)
    .order('display_order')
    .then(({ data }) => setAllVariants((data ?? []) as BentoVariant[]))
}, [])
```

- [ ] **Step 5: Add fetch for weekly-menu assignments (re-runs on date change)**

After the variants fetch effect, add:
```ts
useEffect(() => {
  if (!form.delivery_date) return
  setAssignedVariantIds(null)
  const dow       = dowFromDate(form.delivery_date)
  const weekStart = getWeekStart(form.delivery_date)
  supabase
    .from('bento_weekly_menu_assignments')
    .select('variant_id')
    .eq('week_start', weekStart)
    .eq('day_of_week', dow)
    .then(({ data }) => {
      setAssignedVariantIds((data ?? []).map((r: { variant_id: number }) => r.variant_id))
    })
}, [form.delivery_date])
```

- [ ] **Step 6: Remove old helper functions that are no longer needed**

Delete these functions (they operated on the old `orderItems`/`customItems` state):
```ts
function addItem() { ... }
function removeItem(idx: number) { ... }
function setItemVariant(idx: number, variant: string) { ... }
function adjustQty(idx: number, delta: number) { ... }
function addCustom() { ... }
function removeCustom(idx: number) { ... }
function setCustomField(idx: number, field: keyof CustomItem, value: number | null) { ... }
function adjustCustomQty(idx: number, delta: number) { ... }
```

- [ ] **Step 7: Update `totalQty` computation**

Find the existing line:
```ts
const totalQty = orderItems.filter(i => i.variant).reduce((s, i) => s + i.quantity, 0) + customItems.reduce((s, c) => s + c.qty, 0)
```

Replace with:
```ts
const activeVariants   = assignedVariantIds === null
  ? []
  : allVariants.filter(v => assignedVariantIds.includes(v.id))
const hasWeeklyMenu    = assignedVariantIds !== null && assignedVariantIds.length > 0
const variantTotal     = activeVariants.reduce((s, v) => s + (variantQtys[v.id] ?? 0), 0)
const customTotal      = customCombos.reduce((s, c) => s + c.qty, 0)
const totalQty         = variantTotal + customTotal
```

- [ ] **Step 8: Type-check**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1 | grep "new/page"
```

Expected: no errors on `new/page.tsx`. (Other files may have unrelated pre-existing errors — ignore those.)

---

## Task 2: Replace Menu UI in `new/page.tsx`

**Files:**
- Modify: `app/bento/new/page.tsx`

- [ ] **Step 1: Remove the old Menu section**

Find and delete the entire block that starts with:
```tsx
{/* ── Meal selection ── */}
<div className="pt-2 border-t border-gray-200">
  <label className="text-sm text-gray-600 mb-2 block font-medium">Menu *</label>
  ...
</div>
```
This block spans from the `{/* ── Meal selection ── */}` comment through the closing `</div>` that wraps both the "Meal plan" and "Custom" sub-sections (around lines 440–524 in the original).

- [ ] **Step 2: Insert the new two-layer Menu section in its place**

```tsx
{/* ── Menu ── */}
<div className="pt-2 border-t border-gray-200">
  <label className="text-sm text-gray-600 mb-2 block font-medium">Menu *</label>

  {/* Layer 1 — Weekly menu variants */}
  <div className="mb-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs text-gray-400">Weekly menu</span>
    </div>
    {assignedVariantIds === null ? (
      <div className="text-xs text-gray-400 px-1">Loading…</div>
    ) : !hasWeeklyMenu ? (
      <div className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
        No weekly menu set for this day — use custom combos below.
      </div>
    ) : (
      <div className="space-y-2">
        {activeVariants.map(v => {
          const qty = variantQtys[v.id] ?? 0
          return (
            <div key={v.id} className="bg-white rounded-xl px-3 py-2.5 flex items-center justify-between shadow-sm">
              <span className="text-sm font-medium text-gray-800">{v.name}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVariantQtys(prev => ({ ...prev, [v.id]: Math.max(0, (prev[v.id] ?? 0) - 1) }))}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm leading-none active:bg-gray-200"
                >−</button>
                <span className="text-sm font-semibold w-6 text-center tabular-nums">{qty}</span>
                <button
                  type="button"
                  onClick={() => setVariantQtys(prev => ({ ...prev, [v.id]: (prev[v.id] ?? 0) + 1 }))}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm leading-none active:opacity-70"
                  style={{ background: '#f97316' }}
                >+</button>
              </div>
            </div>
          )
        })}
      </div>
    )}
  </div>

  {/* Layer 2 — Custom combos */}
  <div className="flex items-center justify-between mb-2">
    <span className="text-xs text-gray-400">Custom combos</span>
    <button
      type="button"
      onClick={() => setCustomCombos(prev => [...prev, { protein_id: null, vegetable_id: null, staple_id: null, qty: 1 }])}
      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm leading-none active:opacity-70"
      style={{ background: '#9ca3af' }}
      aria-label="Add combo"
    >+</button>
  </div>
  <div className="space-y-2">
    {customCombos.map((c, idx) => (
      <div key={idx} className="bg-white rounded-xl px-3 pt-2 pb-2.5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Combo #{idx + 1}</span>
          <button
            type="button"
            onClick={() => setCustomCombos(prev => prev.filter((_, i) => i !== idx))}
            className="text-gray-300 active:text-red-400 p-0.5 -mr-0.5"
            aria-label="Remove combo"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <ComponentSelect
          label="荤菜"
          items={proteins}
          value={c.protein_id}
          onChange={val => setCustomCombos(prev => prev.map((x, i) => i === idx ? { ...x, protein_id: val } : x))}
        />
        <ComponentSelect
          label="素菜"
          items={vegetables}
          value={c.vegetable_id}
          onChange={val => setCustomCombos(prev => prev.map((x, i) => i === idx ? { ...x, vegetable_id: val } : x))}
        />
        <ComponentSelect
          label="主食"
          items={staples}
          value={c.staple_id}
          onChange={val => setCustomCombos(prev => prev.map((x, i) => i === idx ? { ...x, staple_id: val } : x))}
        />
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[11px] text-gray-400">Qty</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCustomCombos(prev => prev.map((x, i) => i === idx ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}
              className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm leading-none active:bg-gray-200"
            >−</button>
            <span className="text-xs font-semibold w-5 text-center tabular-nums">{c.qty}</span>
            <button
              type="button"
              onClick={() => setCustomCombos(prev => prev.map((x, i) => i === idx ? { ...x, qty: x.qty + 1 } : x))}
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm leading-none active:opacity-70"
              style={{ background: '#f97316' }}
            >+</button>
          </div>
        </div>
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1 | grep "new/page"
```

Expected: no errors on `new/page.tsx`.

---

## Task 3: Update `handleSubmit` in `new/page.tsx`

**Files:**
- Modify: `app/bento/new/page.tsx`

- [ ] **Step 1: Replace the submit validation and items-text logic**

Find the entire `handleSubmit` function body. Replace from `const activeOrderItems` through `const firstStaple = ...` with:

```ts
const activeVariantSubmit = activeVariants.filter(v => (variantQtys[v.id] ?? 0) > 0)
const activeCustomCombos  = customCombos.filter(c => c.protein_id || c.vegetable_id || c.staple_id)
if (activeVariantSubmit.length === 0 && activeCustomCombos.length === 0) {
  setError('Please add at least one menu item.'); return
}

const parts: string[] = []
for (const v of activeVariantSubmit) {
  parts.push(`${v.name} x${variantQtys[v.id]}`)
}
for (const c of activeCustomCombos) {
  const protein = proteins.find(p => p.id === c.protein_id)
  const veg     = vegetables.find(v => v.id === c.vegetable_id)
  const staple  = staples.find(s => s.id === c.staple_id)
  const label   = [
    protein?.description || protein?.name,
    veg?.description     || veg?.name,
    staple?.description  || staple?.name,
  ].filter(Boolean).join(' / ') || 'Custom'
  parts.push(`${label} x${c.qty}`)
}

const itemsText = parts.join(', ')
const menuType  = activeVariantSubmit.length > 0 ? activeVariantSubmit[0].code : 'custom'

const firstCustom  = activeCustomCombos[0]
const firstProtein = firstCustom ? proteins.find(p => p.id === firstCustom.protein_id) : null
const firstVeg     = firstCustom ? vegetables.find(v => v.id === firstCustom.vegetable_id) : null
const firstStaple  = firstCustom ? staples.find(s => s.id === firstCustom.staple_id) : null
```

Keep everything below (`setLoading(true)`, the `supabase.from('bento_orders').insert(...)` call, the member deduction, and `router.push`) exactly as-is.

- [ ] **Step 2: Type-check**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1 | grep "new/page"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/bruce/wenxin-app && git add app/bento/new/page.tsx && git commit -m "feat(bento): replace hardcoded variants with weekly-menu + custom combos in new order form"
```

---

## Task 4: Add helpers, types, and new state + fetches to `edit/page.tsx`

**Files:**
- Modify: `app/bento/orders/[id]/edit/page.tsx`

- [ ] **Step 1: Add new type definitions after the imports**

After the existing `const INPUT = ...` line, add:
```ts
type BentoVariant = { id: number; code: string; name: string }
type Component    = { id: number; name: string; description: string | null; is_active: boolean }
type CustomCombo  = { protein_id: number | null; vegetable_id: number | null; staple_id: number | null; qty: number }

function dowFromDate(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  return (d.getDay() + 6) % 7
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
```

- [ ] **Step 2: Add new state variables inside `EditOrderPage`**

After the existing `const [error, setError] = useState<string | null>(null)` line, add:
```ts
// Proteins / vegetables / staples for custom combos
const [proteins,   setProteins]   = useState<Component[]>([])
const [vegetables, setVegetables] = useState<Component[]>([])
const [staples,    setStaples]    = useState<Component[]>([])

// Weekly menu
const [allVariants,          setAllVariants]          = useState<BentoVariant[]>([])
const [assignedVariantIds,   setAssignedVariantIds]   = useState<number[] | null>(null)
const [variantQtys,          setVariantQtys]          = useState<Record<number, number>>({})
const [customCombos,         setCustomCombos]         = useState<CustomCombo[]>([])
```

- [ ] **Step 3: Remove `quantity` from `form` state**

In the `form` state object, delete:
```ts
quantity: 1,
```
Also delete it from the `applyOrder` call inside the load effect:
```ts
quantity: (o.quantity as number) ?? 1,
```

- [ ] **Step 4: Add fetch for proteins, vegetables, staples, and bento_menu_variants (once on mount)**

Add this `useEffect` after the existing order-load `useEffect`:
```ts
useEffect(() => {
  Promise.all([
    supabase.from('bento_proteins').select('id,name,description,is_active').eq('is_active', true).order('name'),
    supabase.from('bento_vegetables').select('id,name,description,is_active').eq('is_active', true).order('name'),
    supabase.from('bento_staples').select('id,name,description,is_active').eq('is_active', true).order('name'),
    supabase.from('bento_menu_variants').select('id,code,name').eq('is_active', true).order('display_order'),
  ]).then(([p, v, s, mv]) => {
    setProteins((p.data || []) as Component[])
    setVegetables((v.data || []) as Component[])
    setStaples((s.data || []) as Component[])
    setAllVariants((mv.data || []) as BentoVariant[])
  })
}, [])
```

- [ ] **Step 5: Add fetch for weekly-menu assignments (re-runs on date change)**

Add after the previous effect:
```ts
useEffect(() => {
  if (!form.delivery_date) return
  setAssignedVariantIds(null)
  const dow       = dowFromDate(form.delivery_date)
  const weekStart = getWeekStart(form.delivery_date)
  supabase
    .from('bento_weekly_menu_assignments')
    .select('variant_id')
    .eq('week_start', weekStart)
    .eq('day_of_week', dow)
    .then(({ data }) => {
      setAssignedVariantIds((data ?? []).map((r: { variant_id: number }) => r.variant_id))
    })
}, [form.delivery_date])
```

- [ ] **Step 6: Add derived values after existing computed values**

Find the lines:
```ts
const isDelivery = form.fulfillment_type === 'delivery'
const unitPrice = parseFloat(form.unit_price) || 0
const total = unitPrice * form.quantity
```

Replace with:
```ts
const isDelivery     = form.fulfillment_type === 'delivery'
const unitPrice      = parseFloat(form.unit_price) || 0
const activeVariants = assignedVariantIds === null
  ? []
  : allVariants.filter(v => assignedVariantIds.includes(v.id))
const hasWeeklyMenu  = assignedVariantIds !== null && assignedVariantIds.length > 0
const variantTotal   = activeVariants.reduce((s, v) => s + (variantQtys[v.id] ?? 0), 0)
const customTotal    = customCombos.reduce((s, c) => s + c.qty, 0)
const totalQty       = variantTotal + customTotal
const total          = unitPrice * totalQty
```

- [ ] **Step 7: Type-check**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1 | grep "edit/page"
```

Expected: errors about `form.quantity` (we'll fix in the next task). No other new errors.

---

## Task 5: Replace Menu UI and fix quantity display in `edit/page.tsx`

**Files:**
- Modify: `app/bento/orders/[id]/edit/page.tsx`

- [ ] **Step 1: Remove the old Menu Type section**

Find and delete the entire block that starts with `{/* Menu Type */}` through its closing `</div>`:
```tsx
{/* Menu Type */}
<div className="pt-2 border-t border-gray-200">
  <label className="text-sm text-gray-600 mb-2 block font-medium">Menu *</label>
  <div className="grid grid-cols-2 gap-2">
    {[
      { code: 'light', label: 'Light', color: '#3B82F6' },
      { code: 'flavorful', label: 'Flavorful', color: '#F97316' },
    ].map(v => (
      ...
    ))}
  </div>
</div>
```

- [ ] **Step 2: Insert the new two-layer Menu section in its place**

```tsx
{/* ── Menu ── */}
<div className="pt-2 border-t border-gray-200">
  <label className="text-sm text-gray-600 mb-2 block font-medium">Menu *</label>

  {/* Layer 1 — Weekly menu variants */}
  <div className="mb-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs text-gray-400">Weekly menu</span>
    </div>
    {assignedVariantIds === null ? (
      <div className="text-xs text-gray-400 px-1">Loading…</div>
    ) : !hasWeeklyMenu ? (
      <div className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
        No weekly menu set for this day — use custom combos below.
      </div>
    ) : (
      <div className="space-y-2">
        {activeVariants.map(v => {
          const qty = variantQtys[v.id] ?? 0
          return (
            <div key={v.id} className="bg-white rounded-xl px-3 py-2.5 flex items-center justify-between shadow-sm">
              <span className="text-sm font-medium text-gray-800">{v.name}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVariantQtys(prev => ({ ...prev, [v.id]: Math.max(0, (prev[v.id] ?? 0) - 1) }))}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm leading-none active:bg-gray-200"
                >−</button>
                <span className="text-sm font-semibold w-6 text-center tabular-nums">{qty}</span>
                <button
                  type="button"
                  onClick={() => setVariantQtys(prev => ({ ...prev, [v.id]: (prev[v.id] ?? 0) + 1 }))}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm leading-none active:opacity-70"
                  style={{ background: '#f97316' }}
                >+</button>
              </div>
            </div>
          )
        })}
      </div>
    )}
  </div>

  {/* Layer 2 — Custom combos */}
  <div className="flex items-center justify-between mb-2">
    <span className="text-xs text-gray-400">Custom combos</span>
    <button
      type="button"
      onClick={() => setCustomCombos(prev => [...prev, { protein_id: null, vegetable_id: null, staple_id: null, qty: 1 }])}
      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm leading-none active:opacity-70"
      style={{ background: '#9ca3af' }}
      aria-label="Add combo"
    >+</button>
  </div>
  <div className="space-y-2">
    {customCombos.map((c, idx) => (
      <div key={idx} className="bg-white rounded-xl px-3 pt-2 pb-2.5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Combo #{idx + 1}</span>
          <button
            type="button"
            onClick={() => setCustomCombos(prev => prev.filter((_, i) => i !== idx))}
            className="text-gray-300 active:text-red-400 p-0.5 -mr-0.5"
            aria-label="Remove combo"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <ComponentSelect
          label="荤菜"
          items={proteins}
          value={c.protein_id}
          onChange={val => setCustomCombos(prev => prev.map((x, i) => i === idx ? { ...x, protein_id: val } : x))}
        />
        <ComponentSelect
          label="素菜"
          items={vegetables}
          value={c.vegetable_id}
          onChange={val => setCustomCombos(prev => prev.map((x, i) => i === idx ? { ...x, vegetable_id: val } : x))}
        />
        <ComponentSelect
          label="主食"
          items={staples}
          value={c.staple_id}
          onChange={val => setCustomCombos(prev => prev.map((x, i) => i === idx ? { ...x, staple_id: val } : x))}
        />
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[11px] text-gray-400">Qty</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCustomCombos(prev => prev.map((x, i) => i === idx ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}
              className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm leading-none active:bg-gray-200"
            >−</button>
            <span className="text-xs font-semibold w-5 text-center tabular-nums">{c.qty}</span>
            <button
              type="button"
              onClick={() => setCustomCombos(prev => prev.map((x, i) => i === idx ? { ...x, qty: x.qty + 1 } : x))}
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm leading-none active:opacity-70"
              style={{ background: '#f97316' }}
            >+</button>
          </div>
        </div>
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Remove the old manual quantity stepper from the Quantity + Price section**

Find the block:
```tsx
{/* Quantity + Price */}
<div className="pt-2 border-t border-gray-200">
  <div className="grid grid-cols-2 gap-3 mt-3">
    <div>
      <label className="text-sm text-gray-600 mb-1 block">Quantity</label>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setForm(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))} ...>−</button>
        <span ...>{form.quantity}</span>
        <button type="button" onClick={() => setForm(prev => ({ ...prev, quantity: prev.quantity + 1 }))} ...>+</button>
      </div>
    </div>
    <div>
      <label ...>Unit Price (RM)</label>
      <input name="unit_price" ... />
    </div>
  </div>
  ...
</div>
```

Replace with (quantity is now auto-computed, show as read-only like in new/page.tsx):
```tsx
{/* ── Pricing ── */}
<div className="pt-2 border-t border-gray-200">
  <div className="grid grid-cols-2 gap-3 mt-3">
    <div>
      <label className="text-sm text-gray-600 mb-1 block">Unit Price (RM)</label>
      <input name="unit_price" type="number" inputMode="decimal" placeholder="13.00"
        value={form.unit_price} onChange={handleChange} className={INPUT} />
    </div>
    <div>
      <label className="text-sm text-gray-600 mb-1 block">Quantity</label>
      <div className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600">{totalQty}</div>
    </div>
  </div>
  <div className="flex items-center justify-between mt-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
    <span className="text-sm text-gray-500">Total</span>
    <span className="text-lg font-bold text-gray-900">RM {total.toFixed(2)}</span>
  </div>
</div>
```

- [ ] **Step 4: Add `ComponentSelect` helper function at the bottom of the file**

Before the closing `}` of the file (after `EditOrderPage`), add:
```tsx
function ComponentSelect({ label, items, value, onChange }: {
  label: string
  items: Component[]
  value: number | null
  onChange: (id: number | null) => void
}) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-[11px] text-gray-400 w-10 flex-shrink-0">{label}</span>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-orange-400 bg-white text-gray-700"
      >
        <option value="">Select…</option>
        {items.map(c => (
          <option key={c.id} value={c.id}>
            {c.description || c.name}{c.description ? ` — ${c.name}` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 5: Type-check**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1 | grep "edit/page"
```

Expected: no errors.

---

## Task 6: Update `handleSave` in `edit/page.tsx`

**Files:**
- Modify: `app/bento/orders/[id]/edit/page.tsx`

- [ ] **Step 1: Replace the payload-building logic in `handleSave`**

Find the existing `handleSave` function. Replace the body up to `const res = await updateOrderAction(...)` with:

```ts
async function handleSave() {
  if (!form.customer_name.trim()) { setError('Customer name is required.'); return }

  const activeVariantSubmit = activeVariants.filter(v => (variantQtys[v.id] ?? 0) > 0)
  const activeCustomCombos  = customCombos.filter(c => c.protein_id || c.vegetable_id || c.staple_id)
  if (activeVariantSubmit.length === 0 && activeCustomCombos.length === 0) {
    setError('Please add at least one menu item.'); return
  }

  setSaving(true); setError(null)

  const parts: string[] = []
  for (const v of activeVariantSubmit) {
    parts.push(`${v.name} x${variantQtys[v.id]}`)
  }
  for (const c of activeCustomCombos) {
    const protein = proteins.find(p => p.id === c.protein_id)
    const veg     = vegetables.find(v => v.id === c.vegetable_id)
    const staple  = staples.find(s => s.id === c.staple_id)
    const label   = [
      protein?.description || protein?.name,
      veg?.description     || veg?.name,
      staple?.description  || staple?.name,
    ].filter(Boolean).join(' / ') || 'Custom'
    parts.push(`${label} x${c.qty}`)
  }

  const itemsText = parts.join(', ')
  const menuType  = activeVariantSubmit.length > 0 ? activeVariantSubmit[0].code : 'custom'
  const amount    = (parseFloat(form.unit_price) || 0) * totalQty

  const firstCustom  = activeCustomCombos[0]
  const firstProtein = firstCustom ? proteins.find(p => p.id === firstCustom.protein_id) : null
  const firstVeg     = firstCustom ? vegetables.find(v => v.id === firstCustom.vegetable_id) : null
  const firstStaple  = firstCustom ? staples.find(s => s.id === firstCustom.staple_id) : null

  const payload: Record<string, unknown> = {
    customer_name:           form.customer_name.trim(),
    phone:                   form.phone || null,
    fulfillment_type:        form.fulfillment_type,
    date:                    form.delivery_date,
    delivery_or_pickup_time: form.order_time || null,
    area:                    form.fulfillment_type === 'delivery' ? (form.area || null) : null,
    address:                 form.fulfillment_type === 'delivery' ? (form.address || null) : null,
    menu_type:               menuType,
    items:                   itemsText,
    compartment_a:           firstProtein?.description || firstProtein?.name || null,
    compartment_b:           firstVeg?.description     || firstVeg?.name     || null,
    compartment_c:           firstStaple?.description  || firstStaple?.name  || null,
    quantity:                totalQty,
    amount,
    note:                    form.note || null,
    paid:                    form.payment_status === 'paid',
    payment_status:          form.payment_status,
    payment_method:          form.payment_method || null,
    amount_paid:             parseFloat(form.amount_paid) || 0,
    payment_note:            form.payment_note || '',
  }

  const res = await updateOrderAction(orderId, payload)
  setSaving(false)
  if (!res.ok) { setError(res.error); return }
  router.refresh()
  setTimeout(() => { pop() }, 400)
}
```

- [ ] **Step 2: Final type-check (both files)**

```bash
cd /Users/bruce/wenxin-app && npx tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/bruce/wenxin-app && git add "app/bento/orders/[id]/edit/page.tsx" && git commit -m "feat(bento): replace hardcoded variants with weekly-menu + custom combos in edit order form"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Layer 1 (weekly variants, date-driven) ✓ — Layer 2 (custom combos) ✓ — Qty + pricing ✓ — items text + menu_type + compartments ✓ — edit form starts clean ✓ — both files updated ✓
- [x] **No placeholders:** All steps contain complete code blocks
- [x] **Type consistency:** `BentoVariant`, `Component`, `CustomCombo` defined identically in Tasks 1 and 4; `activeVariants`, `hasWeeklyMenu`, `variantQtys`, `customCombos` used consistently across all tasks; `totalQty` replaces `form.quantity` in edit — payload uses `totalQty` in Task 6
