# AI Development Rules — Wenxin Operations

> **Read this document before making any change to this codebase.**
> These rules apply to every AI assistant: Claude, GPT, Codex, Gemini, or any other model.
> Violations have caused production bugs, data loss, and schema corruption.

---

## 1. Project Identity

**App:** Wenxin Operations — restaurant management PWA for 文心砂锅 (Wenxin Claypot Restaurant), Kota Kinabalu, Malaysia.

**Stack:** Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth) · Vercel

**Owner:** Bruce Leung

**Primary language:** English (code, comments, schema, documentation).
**Display language:** Chinese (app UI, item names use `name_zh`).

---

## 2. Codebase Location Warning

There are **two copies** of `wenxin-app` on this machine:

- `/Users/bruce/wenxin-app` — usually the live copy
- `/Users/bruce/Library/CloudStorage/.../Obsidian/wenxin-app` — a backup/sync copy

**Which one is live can change.** Before editing any file, confirm which copy the dev server runs from:

```bash
lsof -i :3000 | grep LISTEN        # find the server PID
lsof -a -p <PID> -d cwd -Fn        # get its working directory
```

Always edit the directory the server runs from. Editing the wrong copy produces no visible effect and wastes hours.

---

## 3. Architecture Rules

### Navigation Stack (CRITICAL)

The app uses a custom client-side navigation stack in `app/components/NavigationStack.tsx` that mimics iOS native navigation. It is **not** standard Next.js routing.

- Forward navigation: `push(path, <Component />)` — slides new page in from the right
- Back navigation: `pop()` — slides current page out; previous page is revealed underneath (never re-rendered)
- Edge swipe: left-edge drag triggers `pop()` with follow-finger animation

**Rules:**
- All L2 pages pushed onto the stack MUST be `'use client'` components and lazily imported
- Register every L2 page in `app/lib/stackRoutes.tsx`
- Use `<NavLink href="...">` from the home page, never `<Link>`
- Never remove the `data-stack-layer` attribute from StackLayer — CSS relies on it
- `StackLayer` uses `position: fixed; top:0; left:0; width:100vw; height:100dvh` — **not** `inset:0` (browser quirk)
- Exception: `/tasks` and `/incidents` use server-side auth (`requireRole`) and normal Next.js navigation

### Auth and Roles

```
lib/auth/currentStaff.ts    — requireCurrentStaff(), requireRole(), getCurrentStaff()
lib/auth/permissions.ts     — canAccessPath(), getHomeVisibility()
app/components/StaffProvider.tsx  — useStaff() hook
```

**Staff roles (in order of privilege):**
`owner` → `manager` → `kitchen` → `front_desk` → `cashier` → `packing` → `delivery` → `other`

Layout wrap order: `StaffProvider` → `SessionHeartbeat` → `NavigationProvider` → `{children}`

### Supabase Client Usage

| Context | Import |
|---|---|
| Server components / Server Actions | `createServerSupabaseClient()` from `@/lib/supabase/server` |
| Client components | `supabase` from `@/lib/supabase/client` |

Never use `@/lib/supabase` (old pattern — no longer valid).

---

## 4. Database Rules

### Row Level Security

RLS is enabled on **every table**. Never insert or update data without confirming that:
1. A valid RLS policy exists for the operation and role
2. The correct Supabase client is used (server vs client)

### Migration Rules

Every schema change MUST go in a migration file. No exceptions.

**File location:** `supabase/migrations/`

**Naming convention:** `YYYYMMDD_descriptive_snake_case.sql`

If multiple migrations are needed on the same day, append `_b`, `_c`, etc. or use a disambiguating keyword in the name. Do not use timestamps within the filename unless a legacy migration already does so.

**Every migration must:**
- Open with `BEGIN;` and close with `COMMIT;`
- Be safe to re-run where possible (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- Include a `DO $$ ... $$;` validation block at the end that raises an exception if the change did not apply
- Include a comment at the top explaining what it does and why

**Never:**
- Alter the live schema through the Supabase dashboard SQL editor without writing a corresponding migration file
- Drop columns that might still be referenced by app code
- Remove RLS policies without replacing them

### Outlet ID

The single outlet for Wenxin is always:

```
'00000000-0000-0000-0000-000000000001'
```

Declare it as a constant inside functions; never hardcode the literal string in application logic.

---

## 5. Business Logic Rules

### Purchase Flow vs China Import — Critical Separation

The purchase flow (`purchase_requests` → `purchase_request_items`) is tied to:
- `business_date` (today's date)
- Cash drawer sessions
- Staff approval workflow

**China-imported stock must never enter the purchase flow.**

China imports are goods purchased and paid in China weeks or months before arrival. They must:
- Increase `inventory_stock_levels.current_quantity` directly
- Create `inventory_movements` records with `movement_type = 'purchase_receive'`
- NOT create `purchase_requests` or `purchase_request_items`
- NOT affect any `cash_drawer_sessions`
- NOT appear in today's purchase expense totals

### Cash Drawer Isolation

`cash_drawer_sessions` records daily cash on hand. Never write to this table from:
- Inventory adjustments
- China import stock registration
- Historical backfill operations

### Inventory Movement Types

Valid values for `inventory_movements.movement_type`:

| Value | When to use |
|---|---|
| `purchase_receive` | Stock received (local purchase or China import) |
| `manual_adjustment` | Owner/manager stock correction |
| `stock_check` | Count sheet submission |
| `waste` | Spoilage or disposal |
| `usage` | Deduction for production use |
| `transfer_in` | Stock transferred from another location |
| `transfer_out` | Stock sent to another location |

---

## 6. TypeScript Rules

- Run `npx tsc --noEmit` after every code change. If it fails, fix it before declaring the task complete.
- The `CatalogItem` type in `lib/purchaseLedger/catalog.ts` defines which purchase catalog fields are available to the app. Do not add new columns to the Supabase select query without adding them to this type.
- Do not add comments that describe what the code does. Only add comments when explaining a non-obvious constraint, workaround, or invariant.
- Do not add error handling for scenarios that cannot occur. Trust Supabase RLS, TypeScript types, and internal guarantees.

---

## 7. Category Systems

There are **two separate category systems** in this project. Do not confuse them.

### Purchase Categories (`lib/purchaseLedger/categories.ts`)

Used by the **purchase request flow** and **purchase catalog**.

```
Seafood · Meat · Vegetables · Grocery · Sauces · Beverage · Packaging · Others
```

Defined as a TypeScript `const` array. Adding a new category requires:
1. Adding the string to `PURCHASE_CATEGORIES` in `categories.ts`
2. Adding a hex color to `CATEGORY_COLOR` in the same file
3. No database migration needed (category is stored as free text)

### Inventory Categories (`app/inventory/ItemSheet.tsx`)

Used by the **inventory module** only.

```
Fresh · Sauces · Dry Goods · Drinks · Packaging · Supplies
```

Defined as a local `const` array in `ItemSheet.tsx`. These are independent of purchase categories.

---

## 8. What Not to Do

- **Do not assume column names.** Read the migration files and TypeScript types before writing SQL.
- **Do not create purchase_requests for China imports.** Use `inventory_movements` directly.
- **Do not touch the cash drawer for non-cash operations.**
- **Do not use `name_en` in purchase_catalog queries or mutations.** The column exists in the database schema but is never selected, typed, or rendered by the application. Use `name_ms` for secondary display names.
- **Do not edit both wenxin-app directories.** Confirm the live one first.
- **Do not skip the typecheck** (`npx tsc --noEmit`) before declaring work done.
- **Do not add catalog items without checking for duplicates** against all 142+ existing entries.
- **Do not create purchase_catalog items with `seq` values that already exist.**

---

## 9. Verification Checklist

Before marking any task complete:

- [ ] TypeScript check passes: `npx tsc --noEmit`
- [ ] Migration file exists in `supabase/migrations/` with correct naming
- [ ] Migration opens with `BEGIN;` and closes with `COMMIT;`
- [ ] Migration includes a validation `DO $$ ... $$;` block
- [ ] No `name_en` in any new SQL touching `purchase_catalog`
- [ ] China import operations do not write to `purchase_requests` or `cash_drawer_sessions`
- [ ] RLS policies cover any new table or new operation
