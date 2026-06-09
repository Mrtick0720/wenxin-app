// ── Inventory Module Tests (Phase 1) ──
// Pure-function tests for validation and business rules.

import {
  isValidItemName,
  isValidUnit,
  isValidQuantity,
  isValidReorderLevel,
  isValidMovementType,
  isValidItemStatus,
  isValidAdjustmentReason,
  isLowStock,
  isStockInMovement,
  isStockOutMovement,
  VALID_MOVEMENT_TYPES,
} from '../lib/inventory/validation.ts'

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
assert(isValidItemName('Cooking Oil'), 'valid name passes')
assert(!isValidItemName(''), 'empty fails')
assert(!isValidItemName('   '), 'whitespace fails')

section('2. isValidUnit')
assert(isValidUnit('kg'), 'kg is valid')
assert(isValidUnit('bottles'), 'bottles is valid')
assert(!isValidUnit(''), 'empty fails')

section('3. isValidQuantity')
assert(isValidQuantity(10), '10 is valid')
assert(isValidQuantity(0), '0 is valid (out of stock)')
assert(!isValidQuantity(-1), 'negative is invalid')

section('4. isValidReorderLevel')
assert(isValidReorderLevel(5), '5 is valid')
assert(isValidReorderLevel(0), '0 is valid')
assert(!isValidReorderLevel(-1), 'negative is invalid')

section('5. isValidItemStatus')
assert(isValidItemStatus('active'), 'active is valid')
assert(isValidItemStatus('inactive'), 'inactive is valid')
assert(isValidItemStatus('discontinued'), 'discontinued is valid')
assert(!isValidItemStatus('deleted'), 'deleted is invalid')

// ═══════════════════════════════════════════════════════════════════
// Movement Validation
// ═══════════════════════════════════════════════════════════════════

section('6. isValidMovementType')
for (const type of VALID_MOVEMENT_TYPES) {
  assert(isValidMovementType(type), `${type} is valid`)
}
assert(!isValidMovementType('sale'), 'sale is not a movement type')
assert(!isValidMovementType(''), 'empty is invalid')

section('7. VALID_MOVEMENT_TYPES count')
assert(VALID_MOVEMENT_TYPES.length === 7, '7 movement types defined')

section('8. isStockInMovement')
assert(isStockInMovement('purchase_receive'), 'purchase_receive increases stock')
assert(isStockInMovement('transfer_in'), 'transfer_in increases stock')
assert(!isStockInMovement('waste'), 'waste does not increase stock')
assert(!isStockInMovement('usage'), 'usage does not increase stock')

section('9. isStockOutMovement')
assert(isStockOutMovement('waste'), 'waste decreases stock')
assert(isStockOutMovement('usage'), 'usage decreases stock')
assert(isStockOutMovement('transfer_out'), 'transfer_out decreases stock')
assert(!isStockOutMovement('purchase_receive'), 'purchase_receive does not decrease stock')

// ═══════════════════════════════════════════════════════════════════
// Low Stock
// ═══════════════════════════════════════════════════════════════════

section('10. isLowStock')
assert(isLowStock(3, 5), '3 <= 5 is low stock')
assert(isLowStock(5, 5), '5 == 5 is low stock (at threshold)')
assert(!isLowStock(6, 5), '6 > 5 is not low stock')
assert(isLowStock(0, 0), '0 and 0 is low stock')

// ═══════════════════════════════════════════════════════════════════
// Adjustment Validation
// ═══════════════════════════════════════════════════════════════════

section('11. isValidAdjustmentReason')
assert(isValidAdjustmentReason('Physical count mismatch'), 'valid reason passes')
assert(isValidAdjustmentReason('Damaged in storage'), 'detailed reason passes')
assert(!isValidAdjustmentReason(''), 'empty fails')
assert(!isValidAdjustmentReason('   '), 'whitespace fails')
assert(!isValidAdjustmentReason(null), 'null fails')

// ═══════════════════════════════════════════════════════════════════
// Future Integration Readiness
// ═══════════════════════════════════════════════════════════════════

section('12. Purchase receive movement supported')
assert(isValidMovementType('purchase_receive'), 'purchase_receive ready for Purchase integration')

section('13. Stock check movement supported')
assert(isValidMovementType('stock_check'), 'stock_check ready for Checklist Stock Check integration')

// ═══════════════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`)
console.log(`  Passed: ${passed}`)
console.log(`  Failed: ${failed}`)
console.log(`  Total:  ${passed + failed}`)
console.log(`${'═'.repeat(60)}\n`)

if (failed > 0) process.exit(1)
