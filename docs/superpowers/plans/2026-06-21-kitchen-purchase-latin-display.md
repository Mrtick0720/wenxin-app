# Kitchen Purchase Latin Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show only large Latin-letter purchase item names in the kitchen employee `Add to Checklist` and `To Verify` flows.

**Architecture:** Add shared display-name helpers to the catalog module and let purchase components read the current role from `StaffProvider`. `CatalogCombobox` switches presentation automatically for kitchen users, while `PendingVerificationSection` loads the catalog when needed and resolves stored Chinese record names to Malay catalog names.

**Tech Stack:** React 19, TypeScript, existing Supabase server actions, Node.js assertion tests

---

### Task 1: Add failing catalog display-name tests

**Files:**
- Create: `scripts/test-purchase-catalog-display.ts`
- Modify: `package.json`

- [ ] **Step 1: Write focused tests**

Test a shared helper with:

```ts
assert.equal(resolveCatalogDisplayName('绍兴花雕酒', catalog, 'latin'), 'Arak Shaoxing Huadiao')
assert.equal(resolveCatalogDisplayName('Arak Shaoxing Huadiao', catalog, 'latin'), 'Arak Shaoxing Huadiao')
assert.equal(resolveCatalogDisplayName('不存在', catalog, 'latin'), 'Unknown item')
assert.equal(resolveCatalogDisplayName('无翻译', untranslatedCatalog, 'latin'), 'Unknown item')
assert.equal(resolveCatalogDisplayName('绍兴花雕酒', catalog, 'default'), '绍兴花雕酒')
```

- [ ] **Step 2: Add the npm test command**

Add:

```json
"test:purchase-catalog-display": "tsx scripts/test-purchase-catalog-display.ts"
```

- [ ] **Step 3: Run the test and confirm it fails**

Run:

```bash
npm run test:purchase-catalog-display
```

Expected: failure because the shared display helper does not exist.

### Task 2: Implement shared display rules

**Files:**
- Modify: `lib/purchaseLedger/catalog.ts`
- Modify: `app/purchase/ChecklistSection.tsx`

- [ ] **Step 1: Add display mode and helper**

Export:

```ts
export type CatalogDisplayMode = 'default' | 'latin'
export function resolveCatalogDisplayName(
  storedName: string,
  catalog: CatalogItem[],
  mode: CatalogDisplayMode,
): string
```

Latin mode returns `name_ms` only and falls back to `Unknown item`. Default mode
returns the stored name.

- [ ] **Step 2: Replace the checklist-local kitchen resolver**

Use the shared helper for kitchen `To Buy` rows and keep the existing loading
placeholder.

- [ ] **Step 3: Run display tests**

Run:

```bash
npm run test:purchase-catalog-display
```

Expected: pass.

### Task 3: Make Add to Checklist Latin-only for kitchen

**Files:**
- Modify: `app/purchase/CatalogCombobox.tsx`

- [ ] **Step 1: Read the current staff role**

Use `useStaff()` and set Latin display mode when the role is `kitchen`.

- [ ] **Step 2: Update the selected value and dropdown rows**

Kitchen mode renders only `name_ms` as the large primary label and never
renders `name_zh`. Missing translations show `Unknown item`.

- [ ] **Step 3: Preserve owner and manager presentation**

Default mode keeps Chinese primary and Malay secondary labels unchanged.

### Task 4: Make To Verify Latin-only for kitchen

**Files:**
- Modify: `app/purchase/PendingVerificationSection.tsx`

- [ ] **Step 1: Load catalog for kitchen verification**

When the current role is `kitchen`, call `fetchCatalogAction()` once on mount
and retain loading/error-safe state.

- [ ] **Step 2: Resolve row and sheet names**

Pass a resolved display name into `PendingRow` and `VerificationSheet`. Kitchen
mode must use the Latin name or `Unknown item`; default mode uses the stored
record name.

- [ ] **Step 3: Keep actions and stored values unchanged**

Accept, reject, cancel, quantities, and record IDs continue using the original
purchase record.

### Task 5: Verify and commit

**Files:**
- Verify all files from Tasks 1–4

- [ ] **Step 1: Run verification**

Run:

```bash
npm run test:purchase-catalog-display
npm run test:purchase-catalog-search
npx tsc --noEmit
npx eslint lib/purchaseLedger/catalog.ts app/purchase/CatalogCombobox.tsx app/purchase/ChecklistSection.tsx app/purchase/PendingVerificationSection.tsx scripts/test-purchase-catalog-display.ts
git diff --check
```

Expected: all commands exit successfully.

- [ ] **Step 2: Commit only feature files**

```bash
git add \
  docs/superpowers/plans/2026-06-21-kitchen-purchase-latin-display.md \
  scripts/test-purchase-catalog-display.ts \
  lib/purchaseLedger/catalog.ts \
  app/purchase/CatalogCombobox.tsx \
  app/purchase/ChecklistSection.tsx \
  app/purchase/PendingVerificationSection.tsx \
  package.json \
  package-lock.json
git commit -m "feat: show Latin purchase names for kitchen"
```
