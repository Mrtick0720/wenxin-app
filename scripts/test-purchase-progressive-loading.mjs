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

console.log(`Purchase progressive loading: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
