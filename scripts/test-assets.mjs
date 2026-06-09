// ── Assets Module Tests (Phase 1) ──
// Pure-function tests for validation and business rules.

import {
  isValidAssetCode,
  isValidAssetName,
  isValidCategory,
  isValidStatus,
  isValidStatusTransition,
  isTerminalStatus,
  isValidDisposalReason,
  getWarrantyStatus,
  VALID_CATEGORIES,
  VALID_STATUSES,
} from '../lib/assets/validation.ts'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { passed++ } else { failed++; console.error(`  FAIL: ${message}`) }
}

function section(title) { console.log(`\n${title}`) }

// ═══════════════════════════════════════════════════════════════════
// Code & Name
// ═══════════════════════════════════════════════════════════════════

section('1. isValidAssetCode')
assert(isValidAssetCode('FRZ-01'), 'FRZ-01 is valid')
assert(isValidAssetCode('POS-02'), 'POS-02 is valid')
assert(!isValidAssetCode(''), 'empty fails')
assert(!isValidAssetCode('   '), 'whitespace fails')

section('2. isValidAssetName')
assert(isValidAssetName('Kitchen Freezer #1'), 'valid name passes')
assert(!isValidAssetName(''), 'empty fails')

section('3. isValidCategory')
for (const cat of VALID_CATEGORIES) {
  assert(isValidCategory(cat), `${cat} is valid`)
}
assert(!isValidCategory('vehicles'), 'vehicles is invalid')
assert(!isValidCategory(''), 'empty is invalid')

// ═══════════════════════════════════════════════════════════════════
// Status
// ═══════════════════════════════════════════════════════════════════

section('4. isValidStatus')
for (const s of VALID_STATUSES) {
  assert(isValidStatus(s), `${s} is valid`)
}
assert(!isValidStatus('deleted'), 'deleted is invalid')
assert(!isValidStatus(''), 'empty is invalid')

section('5. isTerminalStatus')
assert(isTerminalStatus('disposed'), 'disposed is terminal')
assert(!isTerminalStatus('active'), 'active is not terminal')
assert(!isTerminalStatus('under_repair'), 'under_repair is not terminal')
assert(!isTerminalStatus('retired'), 'retired is not terminal')

section('6. isValidStatusTransition — Valid')
assert(isValidStatusTransition('active', 'under_repair'), 'active → under_repair')
assert(isValidStatusTransition('active', 'retired'), 'active → retired')
assert(isValidStatusTransition('active', 'disposed'), 'active → disposed')
assert(isValidStatusTransition('under_repair', 'active'), 'under_repair → active')
assert(isValidStatusTransition('retired', 'active'), 'retired → active')
assert(isValidStatusTransition('retired', 'disposed'), 'retired → disposed')

section('7. isValidStatusTransition — Invalid')
assert(!isValidStatusTransition('disposed', 'active'), 'disposed → active is invalid')
assert(!isValidStatusTransition('disposed', 'under_repair'), 'disposed → anything is invalid')
assert(!isValidStatusTransition('disposed', 'retired'), 'disposed is terminal')
assert(!isValidStatusTransition('active', 'anything_else'), 'active → unknown is invalid')

// ═══════════════════════════════════════════════════════════════════
// Disposal
// ═══════════════════════════════════════════════════════════════════

section('8. isValidDisposalReason')
assert(isValidDisposalReason('Beyond repair'), 'valid reason passes')
assert(isValidDisposalReason('Replaced with new model'), 'detailed reason passes')
assert(!isValidDisposalReason(''), 'empty fails')
assert(!isValidDisposalReason('  '), 'whitespace fails')
assert(!isValidDisposalReason(null), 'null fails')

// ═══════════════════════════════════════════════════════════════════
// Warranty (Derived, Not Stored)
// ═══════════════════════════════════════════════════════════════════

section('9. getWarrantyStatus — No warranty')
assert(getWarrantyStatus(null) === null, 'null expiry returns null')

section('10. getWarrantyStatus — Active')
const farFuture = new Date()
farFuture.setFullYear(farFuture.getFullYear() + 2)
assert(getWarrantyStatus(farFuture.toISOString().split('T')[0]) === 'active',
  'warranty far in future is active')

section('11. getWarrantyStatus — Expiring soon')
const soonDate = new Date()
soonDate.setDate(soonDate.getDate() + 15)
assert(getWarrantyStatus(soonDate.toISOString().split('T')[0]) === 'expiring_soon',
  'warranty in 15 days is expiring soon')

section('12. getWarrantyStatus — Expired')
const pastDate = new Date()
pastDate.setFullYear(pastDate.getFullYear() - 1)
assert(getWarrantyStatus(pastDate.toISOString().split('T')[0]) === 'expired',
  'warranty in past is expired')

// ═══════════════════════════════════════════════════════════════════
// Categories count
// ═══════════════════════════════════════════════════════════════════

section('13. VALID_CATEGORIES')
assert(VALID_CATEGORIES.length === 7, '7 categories defined')
assert(VALID_CATEGORIES.includes('pos'), 'pos included')
assert(VALID_CATEGORIES.includes('kitchen_equipment'), 'kitchen_equipment included')

// ═══════════════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`)
console.log(`  Passed: ${passed}`)
console.log(`  Failed: ${failed}`)
console.log(`  Total:  ${passed + failed}`)
console.log(`${'═'.repeat(60)}\n`)

if (failed > 0) process.exit(1)
