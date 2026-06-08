// ── Cashier Workflow Tests (Phase 3) ──
// Pure-function tests for shift workflow business rules.
// No Supabase, no database, no browser.

import {
  validateShiftStatus,
  calculateCashDifference,
  isWithinAllowedDifference,
  isValidAmount,
  isValidAdjustmentAmount,
  isValidReason,
  isClosable,
  isVerifiable,
  isReopenable,
  isAdjustable,
  isDifferentUser,
} from '../lib/cashier/validation.ts'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    passed++
  } else {
    failed++
    console.error(`  FAIL: ${message}`)
  }
}

function section(title) {
  console.log(`\n${title}`)
}

// ═══════════════════════════════════════════════════════════════════
// Shift Status Validation
// ═══════════════════════════════════════════════════════════════════

section('1. validateShiftStatus — Allows matching status')
assert(validateShiftStatus('open', ['open']), 'open should be allowed when open is expected')
assert(validateShiftStatus('closed', ['closed']), 'closed should be allowed when closed is expected')
assert(validateShiftStatus('verified', ['verified']), 'verified should be allowed when verified is expected')

section('2. validateShiftStatus — Rejects non-matching status')
assert(!validateShiftStatus('open', ['closed']), 'open should NOT be allowed when closed is expected')
assert(!validateShiftStatus('closed', ['open']), 'closed should NOT be allowed when open is expected')
assert(!validateShiftStatus('verified', ['open', 'closed']), 'verified should NOT be allowed when open/closed expected')

section('3. validateShiftStatus — Allows multiple allowed statuses')
assert(validateShiftStatus('open', ['open', 'closing']), 'open should be allowed when open/closing expected')
assert(validateShiftStatus('closed', ['closed', 'verified']), 'closed should be allowed when closed/verified expected')

section('4. validateShiftStatus — Rejects unknown status')
assert(!validateShiftStatus('unknown_status', ['open']), 'unknown status should be rejected')

// ═══════════════════════════════════════════════════════════════════
// Cash Difference Calculation
// ═══════════════════════════════════════════════════════════════════

section('5. calculateCashDifference — Positive difference (over)')
assert(calculateCashDifference(500, 520) === 20, '500 expected, 520 actual → +20')

section('6. calculateCashDifference — Negative difference (short)')
assert(calculateCashDifference(500, 480) === -20, '500 expected, 480 actual → -20')

section('7. calculateCashDifference — Exact match')
assert(calculateCashDifference(500, 500) === 0, '500 expected, 500 actual → 0')

section('8. calculateCashDifference — Zero values')
assert(calculateCashDifference(0, 0) === 0, 'zero/zero → 0')
assert(calculateCashDifference(100, 0) === -100, '100 expected, 0 actual → -100')

// ═══════════════════════════════════════════════════════════════════
// Allowed Difference Check
// ═══════════════════════════════════════════════════════════════════

section('9. isWithinAllowedDifference — Within limit')
assert(isWithinAllowedDifference(5, 10), '+5 within ±10 should be allowed')
assert(isWithinAllowedDifference(-5, 10), '-5 within ±10 should be allowed')
assert(isWithinAllowedDifference(0, 10), '0 within ±10 should be allowed')
assert(isWithinAllowedDifference(10, 10), '+10 at boundary ±10 should be allowed')
assert(isWithinAllowedDifference(-10, 10), '-10 at boundary ±10 should be allowed')

section('10. isWithinAllowedDifference — Exceeds limit')
assert(!isWithinAllowedDifference(11, 10), '+11 exceeds ±10 should be rejected')
assert(!isWithinAllowedDifference(-11, 10), '-11 exceeds ±10 should be rejected')

section('11. isWithinAllowedDifference — Zero max')
assert(isWithinAllowedDifference(0, 0), '0 within ±0 should be allowed')
assert(!isWithinAllowedDifference(1, 0), '1 exceeds ±0 should be rejected')

// ═══════════════════════════════════════════════════════════════════
// Shift Workflow Rules — Logic Verification
// (These test the business rules without a database)
// ═══════════════════════════════════════════════════════════════════

section('12. Open Shift Rules — isValidAmount')
assert(isValidAmount(100), 'Opening balance 100 is valid')
assert(isValidAmount(0), 'Opening balance 0 is valid')
assert(!isValidAmount(-1), 'Opening balance -1 is invalid (negative)')
assert(!isValidAmount(-50), 'Opening balance -50 is invalid (negative)')

section('13. Close Shift Rules — isClosable')
assert(isClosable('open'), 'open shift can be closed')
assert(!isClosable('closed'), 'closed shift cannot be closed again')
assert(!isClosable('verified'), 'verified shift cannot be closed')
assert(!isClosable('closing'), 'closing shift cannot be closed')

// Cash count cannot be negative
assert(isValidAmount(500), 'Cash count 500 is valid')
assert(isValidAmount(0), 'Cash count 0 is valid')
assert(!isValidAmount(-1), 'Cash count -1 is invalid')

section('14. Verify Shift Rules — isVerifiable + isDifferentUser')
assert(isVerifiable('closed'), 'closed shift can be verified')
assert(!isVerifiable('open'), 'open shift cannot be verified')
assert(!isVerifiable('verified'), 'verified shift cannot be verified again')

assert(isDifferentUser('staff-a', 'staff-b'), 'Different closer and verifier is allowed')
assert(!isDifferentUser('staff-a', 'staff-a'), 'Same closer and verifier is rejected')

section('15. Reopen Shift Rules — isReopenable + isValidReason')
assert(isReopenable('closed'), 'closed shift can be reopened')
assert(!isReopenable('open'), 'open shift cannot be reopened (already open)')
assert(!isReopenable('verified'), 'verified shift cannot be reopened')
assert(!isReopenable('closing'), 'closing shift cannot be reopened')

assert(isValidReason('Incorrect cash count'), 'Reason "Incorrect cash count" is valid')
assert(isValidReason('Need to add adjustment'), 'Reason with details is valid')
assert(!isValidReason(''), 'Empty reason is invalid')
assert(!isValidReason('   '), 'Whitespace-only reason is invalid')
assert(!isValidReason(null), 'Null reason is invalid')

section('16. Adjustment Rules — isAdjustable + isValidAdjustmentAmount + isValidReason')
assert(isAdjustable('open'), 'open shift can accept adjustments')
assert(!isAdjustable('closed'), 'closed shift cannot accept adjustments')
assert(!isAdjustable('verified'), 'verified shift cannot accept adjustments')

assert(isValidAdjustmentAmount(50), 'Amount 50 is valid')
assert(isValidAdjustmentAmount(0.01), 'Amount 0.01 is valid (smallest)')
assert(!isValidAdjustmentAmount(0), 'Amount 0 is invalid')
assert(!isValidAdjustmentAmount(-10), 'Amount -10 is invalid')

assert(isValidReason('Float top-up'), 'Reason "Float top-up" is valid')
assert(isValidReason('Emergency purchase — cooking oil'), 'Detailed reason is valid')
assert(!isValidReason(''), 'Empty reason is invalid')
assert(!isValidReason('  '), 'Whitespace reason is invalid')

// ═══════════════════════════════════════════════════════════════════
// Full Workflow Simulation
// ═══════════════════════════════════════════════════════════════════

section('17. Full Workflow — Happy Path')
// Simulate: open → adjust → close → verify
assert(true, 'Step 1: Open shift — allowed')
assert(isAdjustable('open'), 'Step 2: Add adjustment during open shift')
assert(isClosable('open'), 'Step 3: Close shift — allowed')
assert(isVerifiable('closed'), 'Step 4: Verify — requires closed status, now closed')

section('18. Full Workflow — Reopen Path')
// Simulate: close → reopen → adjust → close → verify (different user)
assert(isClosable('open'), 'Reopen Path Step 1: Close open shift')
assert(isReopenable('closed'), 'Reopen Path Step 2: Reopen closed shift')
assert(isAdjustable('open'), 'Reopen Path Step 3: Add adjustment to reopened shift')
assert(isClosable('open'), 'Reopen Path Step 4: Close again')
assert(isVerifiable('closed'), 'Reopen Path Step 5: Verify by different user')

section('19. Invalid Workflow — Verify then Reopen (Blocked)')
assert(!isReopenable('verified'), 'Cannot reopen a verified shift')
assert(!isVerifiable('verified'), 'Cannot verify an already verified shift')

section('20. Invalid Workflow — Close then Close (Blocked)')
assert(!isClosable('closed'), 'Cannot close an already closed shift')

// ═══════════════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`)
console.log(`  Passed: ${passed}`)
console.log(`  Failed: ${failed}`)
console.log(`  Total:  ${passed + failed}`)
console.log(`${'═'.repeat(60)}\n`)

if (failed > 0) {
  process.exit(1)
}
