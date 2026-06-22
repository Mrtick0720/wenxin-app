# Purchase Conservative Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cold Home-to-Purchase navigation start content and KPI work concurrently, avoid duplicate pending-verification work, and defer catalog loading until an add-item workflow opens.

**Architecture:** Keep the current `PurchaseClient` and server-action boundaries. Change only the client orchestration: independently handle two concurrently started bootstrap promises, conditionally refresh pending verification when fresh cache skips bootstrap, and expose an idempotent lazy catalog loader used by add-item entry points.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase server actions, Node source-regression tests.

---

### Task 1: Lock the desired request topology with failing tests

**Files:**
- Modify: `scripts/test-purchase-progressive-loading.mjs`
- Test: `scripts/test-purchase-progressive-loading.mjs`

- [ ] **Step 1: Add source assertions for concurrent bootstrap**

Add assertions that require both bootstrap promises to be created before either
is awaited, and reject the current sequential pattern:

```js
const contentStart = source.indexOf(
  'const contentPromise = fetchPurchaseContentAction()',
)
const heroStart = source.indexOf(
  'const heroPromise = fetchPurchaseHeroAction()',
)
const firstBootstrapAwait = source.indexOf('await contentPromise')

assert(
  contentStart >= 0 &&
    heroStart > contentStart &&
    firstBootstrapAwait > heroStart,
  'content and hero bootstrap requests start before either is awaited',
)
assert(
  !source.includes(
    'const contentRes = await fetchPurchaseContentAction()',
  ),
  'content bootstrap is not awaited before starting the hero request',
)
```

- [ ] **Step 2: Add assertions for conditional pending refresh**

Require a named cache-only refresh helper and reject an unconditional
pending-verification mount request:

```js
assert(
  source.includes('async function refreshPendingVerificationFromCache()'),
  'fresh-cache entry has a dedicated pending-verification refresh',
)
assert(
  source.includes('if (isFresh) {') &&
    source.includes('void refreshPendingVerificationFromCache()'),
  'pending verification refresh runs when fresh cache skips bootstrap',
)
assert(
  !source.includes(
    'useEffect(() => {\n    let active = true\n    fetchPendingVerificationAction()',
  ),
  'cold bootstrap has no unconditional duplicate pending-verification effect',
)
```

- [ ] **Step 3: Add assertions for lazy catalog loading**

Require an idempotent loader called by both add-item entry points and reject the
unconditional catalog mount effect:

```js
assert(
  source.includes('const ensureCatalogLoaded = useCallback(async () => {'),
  'catalog has an idempotent lazy loader',
)
assert(
  source.includes('void ensureCatalogLoaded()') &&
    source.includes('function openAdd()'),
  'opening an add-item workflow triggers catalog loading',
)
assert(
  !source.includes(
    'useEffect(() => {\n    fetchCatalogAction()',
  ),
  'catalog is not fetched unconditionally on mount',
)
```

- [ ] **Step 4: Run the focused test and verify RED**

Run:

```bash
npm run test:purchase-loading
```

Expected: FAIL on the new concurrency, conditional pending-refresh, and lazy
catalog assertions because the current production code does not implement them.

### Task 2: Start content and hero bootstrap concurrently

**Files:**
- Modify: `app/purchase/PurchaseClient.tsx:577-671`
- Test: `scripts/test-purchase-progressive-loading.mjs`

- [ ] **Step 1: Start both server actions before awaiting**

At the beginning of `loadStages`, create both promises:

```ts
const contentPromise = fetchPurchaseContentAction()
const heroPromise = fetchPurchaseHeroAction()
```

- [ ] **Step 2: Process content and hero results independently**

Extract local async handlers inside `loadStages`:

```ts
async function loadContent() {
  const contentRes = await contentPromise
  if (!active) return
  // Preserve current content success/error state updates.
}

async function loadHero() {
  const heroRes = await heroPromise
  if (!active) return
  // Preserve current hero success/error state updates.
}

await Promise.all([loadContent(), loadHero()])
```

Each handler must clear only its own loading state. A failed hero request must
not prevent content rendering, and a failed content request must not discard a
successful hero response.

- [ ] **Step 3: Run focused test and type check**

Run:

```bash
npm run test:purchase-loading
npx tsc --noEmit
```

Expected: The concurrency assertions pass. Pending-refresh and catalog assertions
may still fail until their tasks are implemented. TypeScript exits with code 0.

### Task 3: Remove duplicate cold pending-verification request

**Files:**
- Modify: `app/purchase/PurchaseClient.tsx:721-736`
- Test: `scripts/test-purchase-progressive-loading.mjs`

- [ ] **Step 1: Replace the unconditional mount effect with a cache helper**

Create a guarded helper near the bootstrap effect:

```ts
async function refreshPendingVerificationFromCache() {
  const res = await fetchPendingVerificationAction()
  if (!res.ok) return
  const pending = res.data as LedgerRecord[]
  setPendingVerification(pending)
  if (purchaseCache) {
    purchaseCache = { ...purchaseCache, pendingVerification: pending }
  }
  setPendingVerificationLoaded(true)
}
```

Remove the unconditional `useEffect` that calls
`fetchPendingVerificationAction()` on every mount.

- [ ] **Step 2: Call the helper only when fresh cache skips bootstrap**

In the fresh-cache branch:

```ts
if (isFresh) {
  void refreshPendingVerificationFromCache()
} else {
  setRefreshing(true)
  loadStages().finally(() => {
    if (active) setRefreshing(false)
  })
}
```

Keep pending records from the combined content response on cold/stale bootstrap.
Do not add another request to `loadStages`.

- [ ] **Step 3: Run focused test and type check**

Run:

```bash
npm run test:purchase-loading
npx tsc --noEmit
```

Expected: concurrency and pending-verification assertions pass. Catalog
assertions may still fail. TypeScript exits with code 0.

### Task 4: Load catalog only when an add-item workflow opens

**Files:**
- Modify: `app/purchase/PurchaseClient.tsx:738-749`
- Modify: `app/purchase/PurchaseClient.tsx:978-986`
- Modify: `app/purchase/PurchaseClient.tsx:1828-1855`
- Test: `scripts/test-purchase-progressive-loading.mjs`

- [ ] **Step 1: Replace the catalog mount effect with an idempotent loader**

Add a ref to prevent duplicate in-flight or completed requests:

```ts
const catalogLoadStarted = useRef(false)

const ensureCatalogLoaded = useCallback(async () => {
  if (catalogLoadStarted.current) return
  catalogLoadStarted.current = true
  setCatalogLoading(true)
  setCatalogError(null)
  try {
    const res = await fetchCatalogAction()
    if (res.ok) setCatalog(res.data)
    else setCatalogError(res.error)
  } catch (error) {
    setCatalogError(
      error instanceof Error ? error.message : 'Failed to load catalog',
    )
  } finally {
    setCatalogLoading(false)
  }
}, [])
```

Remove the unconditional catalog `useEffect`. Keep `catalogLoading` initially
`false`, since no request is active before the first add action.

- [ ] **Step 2: Trigger loading from the Purchase add entry point**

At the beginning of `openAdd()`:

```ts
void ensureCatalogLoaded()
```

- [ ] **Step 3: Trigger loading from the checklist add entry point**

Before invoking `triggerAddChecklistRef.current` in the checklist FAB:

```ts
onClick={() => {
  void ensureCatalogLoaded()
  triggerAddChecklistRef.current?.()
}}
```

The sheet opens immediately and uses its existing loading/error props while the
catalog request completes.

- [ ] **Step 4: Run focused test and type check**

Run:

```bash
npm run test:purchase-loading
npx tsc --noEmit
```

Expected: all focused loading assertions pass and TypeScript exits with code 0.

### Task 5: Run regression verification

**Files:**
- Verify: `app/purchase/PurchaseClient.tsx`
- Verify: `scripts/test-purchase-progressive-loading.mjs`

- [ ] **Step 1: Run Purchase-focused tests**

Run:

```bash
npm run test:purchase-loading
npm run test:purchase-ledger
npm run test:purchase
```

Expected: all commands exit with code 0 and report zero failures.

- [ ] **Step 2: Run static verification**

Run:

```bash
npx tsc --noEmit
git diff --check
```

Expected: both commands exit with code 0.

- [ ] **Step 3: Inspect the final diff**

Run:

```bash
git diff -- app/purchase/PurchaseClient.tsx scripts/test-purchase-progressive-loading.mjs
git status --short
```

Confirm that the diff contains only the agreed request-orchestration and test
changes plus the user's pre-existing uncommitted Purchase work. Do not stage or
commit the user's existing modifications unless explicitly requested.
