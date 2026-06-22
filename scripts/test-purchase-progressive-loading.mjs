import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../app/purchase/PurchaseClient.tsx', import.meta.url),
  'utf8',
)

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${message}`)
  }
}

assert(
  source.includes('fetchPurchaseHeroAction'),
  'client fetches the hero stage independently',
)
assert(
  source.includes('fetchChecklistAction'),
  'client fetches the checklist stage independently',
)
assert(
  source.includes('fetchPurchaseRecordsAction'),
  'client fetches the records stage independently',
)
assert(
  !source.includes('Promise.all([fetchPurchaseContextAction(), fetchChecklistAction()])'),
  'initial navigation no longer gates all content behind one Promise.all',
)
assert(
  source.includes('recordsLoading'),
  'records have an independent loading state',
)
assert(
  source.includes('recordsLoaded: boolean') &&
    source.includes('checklistLoaded: boolean'),
  'partial cache entries cannot masquerade as a fully loaded page',
)

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
assert(
  source.includes('const ensureCatalogLoaded = useCallback(async () => {'),
  'catalog has an idempotent lazy loader',
)
assert(
  source.includes('function openAdd()') &&
    source.includes('void ensureCatalogLoaded()'),
  'opening an add-item workflow triggers catalog loading',
)
assert(
  !source.includes(
    'useEffect(() => {\n    fetchCatalogAction()',
  ),
  'catalog is not fetched unconditionally on mount',
)

console.log(`Purchase progressive loading: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
