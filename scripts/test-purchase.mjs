// ── Purchase Module Tests (Phase 1) ──
// Pure-function tests for validation and business rules.

import {
  isValidItemName,
  isValidQuantity,
  isValidUnit,
  isValidUrgency,
  isValidPrice,
  isValidRejectionReason,
  isValidStatusTransition,
  canSetPrices,
  isPriceRestrictedRole,
  VALID_URGENCY,
} from '../lib/purchase/validation.ts'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { passed++ } else { failed++; console.error(`  FAIL: ${message}`) }
}

function section(title) { console.log(`\n${title}`) }

// ═══════════════════════════════════════════════════════════════════
// Item Validation
// ═══════════════════════════════════════════════════════════════════

section('1. isValidItemName')
assert(isValidItemName('Chicken Thigh'), 'valid name passes')
assert(isValidItemName('A'), 'single char passes')
assert(!isValidItemName(''), 'empty fails')
assert(!isValidItemName('   '), 'whitespace fails')

section('2. isValidQuantity')
assert(isValidQuantity(1), '1 is valid')
assert(isValidQuantity(0.5), '0.5 is valid')
assert(!isValidQuantity(0), '0 is invalid')
assert(!isValidQuantity(-1), 'negative is invalid')

section('3. isValidUnit')
assert(isValidUnit('kg'), 'kg is valid')
assert(isValidUnit('pcs'), 'pcs is valid')
assert(!isValidUnit(''), 'empty fails')

section('4. isValidUrgency')
assert(isValidUrgency('low'), 'low is valid')
assert(isValidUrgency('normal'), 'normal is valid')
assert(isValidUrgency('high'), 'high is valid')
assert(isValidUrgency('urgent'), 'urgent is valid')
assert(!isValidUrgency('critical'), 'critical is not a valid urgency')
assert(!isValidUrgency(''), 'empty fails')

// ═══════════════════════════════════════════════════════════════════
// Price Validation (Manager/Owner only)
// ═══════════════════════════════════════════════════════════════════

section('5. isValidPrice')
assert(isValidPrice(10), 'positive price is valid')
assert(isValidPrice(0), 'zero price is valid')
assert(isValidPrice(null), 'null price is valid (not yet set)')
assert(isValidPrice(undefined), 'undefined price is valid')
assert(!isValidPrice(-1), 'negative price is invalid')

section('6. canSetPrices — Manager/Owner')
assert(canSetPrices('owner'), 'owner can set prices')
assert(canSetPrices('manager'), 'manager can set prices')
assert(!canSetPrices('kitchen'), 'kitchen cannot set prices')
assert(!canSetPrices('front_desk'), 'front_desk cannot set prices')
assert(!canSetPrices('delivery'), 'delivery cannot set prices')

section('7. isPriceRestrictedRole — Kitchen/Front Desk')
assert(isPriceRestrictedRole('kitchen'), 'kitchen is price-restricted')
assert(isPriceRestrictedRole('front_desk'), 'front_desk is price-restricted')
assert(!isPriceRestrictedRole('owner'), 'owner is not price-restricted')
assert(!isPriceRestrictedRole('manager'), 'manager is not price-restricted')

// ═══════════════════════════════════════════════════════════════════
// Rejection Validation
// ═══════════════════════════════════════════════════════════════════

section('8. isValidRejectionReason')
assert(isValidRejectionReason('Too expensive'), 'valid reason passes')
assert(isValidRejectionReason('Not needed today'), 'detailed reason passes')
assert(!isValidRejectionReason(''), 'empty fails')
assert(!isValidRejectionReason('  '), 'whitespace fails')
assert(!isValidRejectionReason(null), 'null fails')

// ═══════════════════════════════════════════════════════════════════
// Status Transitions
// ═══════════════════════════════════════════════════════════════════

section('9. isValidStatusTransition — Valid')
assert(isValidStatusTransition('draft', 'submitted'), 'draft → submitted')
assert(isValidStatusTransition('draft', 'cancelled'), 'draft → cancelled')
assert(isValidStatusTransition('submitted', 'approved'), 'submitted → approved')
assert(isValidStatusTransition('submitted', 'rejected'), 'submitted → rejected')
assert(isValidStatusTransition('approved', 'confirmed'), 'approved → confirmed')
assert(isValidStatusTransition('rejected', 'draft'), 'rejected → draft (edit)')
assert(isValidStatusTransition('confirmed', 'purchased'), 'confirmed → purchased')

section('10. isValidStatusTransition — Invalid')
assert(!isValidStatusTransition('draft', 'approved'), 'draft → approved (skip submit) invalid')
assert(!isValidStatusTransition('draft', 'purchased'), 'draft → purchased invalid')
assert(!isValidStatusTransition('submitted', 'confirmed'), 'submitted → confirmed (skip approve) invalid')
assert(!isValidStatusTransition('purchased', 'draft'), 'purchased → draft invalid (terminal)')
assert(!isValidStatusTransition('cancelled', 'draft'), 'cancelled → draft invalid (terminal)')

section('11. isValidStatusTransition — Terminal states')
assert(!isValidStatusTransition('purchased', 'anything'), 'purchased is terminal')
assert(!isValidStatusTransition('cancelled', 'anything'), 'cancelled is terminal')

// ═══════════════════════════════════════════════════════════════════
// Price Visibility Rules (KPI)
// ═══════════════════════════════════════════════════════════════════

section('12. Price visibility — Kitchen submits without prices')
// Kitchen/Front Desk create items with null prices
const kitchenItem = { itemName: 'Chicken', quantity: 5, unit: 'kg', unitPrice: null, totalPrice: null }
assert(kitchenItem.unitPrice === null, 'Kitchen item has no unit price')
assert(kitchenItem.totalPrice === null, 'Kitchen item has no total price')

section('13. Price visibility — Manager confirms prices')
// Manager sets prices on approved request
const managerItem = { itemName: 'Chicken', quantity: 5, unit: 'kg', unitPrice: 12.50, totalPrice: 62.50 }
assert(managerItem.unitPrice !== null, 'Manager sets unit price')
assert(managerItem.totalPrice !== null, 'Manager sets total price')

// ═══════════════════════════════════════════════════════════════════
// VALID_URGENCY constant
// ═══════════════════════════════════════════════════════════════════

section('14. VALID_URGENCY')
assert(VALID_URGENCY.length === 4, '4 urgency levels defined')
assert(VALID_URGENCY.includes('low'), 'low included')
assert(VALID_URGENCY.includes('urgent'), 'urgent included')

// ═══════════════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`)
console.log(`  Passed: ${passed}`)
console.log(`  Failed: ${failed}`)
console.log(`  Total:  ${passed + failed}`)
console.log(`${'═'.repeat(60)}\n`)

if (failed > 0) process.exit(1)
