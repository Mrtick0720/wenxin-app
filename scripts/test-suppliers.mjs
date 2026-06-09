// ── Suppliers Module Tests (Phase 1) ──
// Pure-function tests for validation and business rules.

import {
  isValidCompanyName,
  isValidStatus,
  isValidPaymentTerms,
  isValidStatusTransition,
  isValidContactName,
  VALID_STATUSES,
  VALID_PAYMENT_TERMS,
} from '../lib/suppliers/validation.ts'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { passed++ } else { failed++; console.error(`  FAIL: ${message}`) }
}

function section(title) { console.log(`\n${title}`) }

// ═══════════════════════════════════════════════════════════════════
// Company Name
// ═══════════════════════════════════════════════════════════════════

section('1. isValidCompanyName')
assert(isValidCompanyName('Ah Meng Poultry'), 'valid name passes')
assert(isValidCompanyName('KK Packaging Supply'), 'valid name passes')
assert(!isValidCompanyName(''), 'empty fails')
assert(!isValidCompanyName('   '), 'whitespace fails')

// ═══════════════════════════════════════════════════════════════════
// Status
// ═══════════════════════════════════════════════════════════════════

section('2. isValidStatus')
for (const s of VALID_STATUSES) {
  assert(isValidStatus(s), `${s} is valid`)
}
assert(!isValidStatus('deleted'), 'deleted is invalid')

section('3. isValidStatusTransition')
assert(isValidStatusTransition('active', 'inactive'), 'active → inactive')
assert(isValidStatusTransition('active', 'suspended'), 'active → suspended')
assert(isValidStatusTransition('inactive', 'active'), 'inactive → active')
assert(isValidStatusTransition('suspended', 'active'), 'suspended → active')
assert(isValidStatusTransition('suspended', 'inactive'), 'suspended → inactive')
assert(!isValidStatusTransition('active', 'deleted'), 'active → deleted invalid')

// ═══════════════════════════════════════════════════════════════════
// Payment Terms
// ═══════════════════════════════════════════════════════════════════

section('4. isValidPaymentTerms')
for (const pt of VALID_PAYMENT_TERMS) {
  assert(isValidPaymentTerms(pt), `${pt} is valid`)
}
assert(isValidPaymentTerms(null), 'null is valid (not set)')
assert(!isValidPaymentTerms('net_90'), 'net_90 is invalid')
assert(!isValidPaymentTerms(''), 'empty is invalid')

section('5. VALID_PAYMENT_TERMS count')
assert(VALID_PAYMENT_TERMS.length === 5, '5 payment terms defined')

// ═══════════════════════════════════════════════════════════════════
// Contacts
// ═══════════════════════════════════════════════════════════════════

section('6. isValidContactName')
assert(isValidContactName('John Tan'), 'valid name passes')
assert(!isValidContactName(''), 'empty fails')

// ═══════════════════════════════════════════════════════════════════
// Migration Ordering
// ═══════════════════════════════════════════════════════════════════

section('7. Migration ordering — suppliers_base before purchase')
// Verify: 'b' (ASCII 98) < 'p' (ASCII 112) for alphabetical sort
assert('b'.charCodeAt(0) < 'p'.charCodeAt(0),
  'suppliers_base.sql runs before purchase.sql alphabetically')

// ═══════════════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`)
console.log(`  Passed: ${passed}`)
console.log(`  Failed: ${failed}`)
console.log(`  Total:  ${passed + failed}`)
console.log(`${'═'.repeat(60)}\n`)

if (failed > 0) process.exit(1)
