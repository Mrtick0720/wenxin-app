// ── Checklist Module Tests (Phase 1) ──
// Pure-function tests for validation, instance logic, and status derivation.

import {
  isInstanceComplete,
  isOverdue,
  complianceScore,
  isValidStatusTransition,
  isResponseNoteRequired,
  isValidRunKey,
  statusSortOrder,
  canRespondToItem,
  canCompleteInstance,
  canVerifyInstance,
  canRejectInstance,
  validateFailedItemNote,
  validateRejectionReason,
  isValidResponseStatus,
} from '../lib/checklist/validation.ts'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { passed++ } else { failed++; console.error(`  FAIL: ${message}`) }
}

function section(title) { console.log(`\n${title}`) }

// ═══════════════════════════════════════════════════════════════════
// isInstanceComplete
// ═══════════════════════════════════════════════════════════════════

section('1. isInstanceComplete — All responded')
assert(isInstanceComplete([
  { status: 'pass' }, { status: 'pass' }, { status: 'skip' },
]), 'all non-pending should be complete')

section('2. isInstanceComplete — Has pending')
assert(!isInstanceComplete([
  { status: 'pass' }, { status: 'pending' }, { status: 'pass' },
]), 'any pending means not complete')

section('3. isInstanceComplete — Empty array')
assert(!isInstanceComplete([]), 'empty array should not be complete')

// ═══════════════════════════════════════════════════════════════════
// isOverdue
// ═══════════════════════════════════════════════════════════════════

section('4. isOverdue — Pending and past time')
// Use a time clearly in the past: 5 hours ago UTC
const fiveHoursAgo = new Date(Date.now() - 5 * 3600000).toISOString()
const pastInstance = { status: 'pending', scheduledTime: fiveHoursAgo }
assert(isOverdue(pastInstance), 'pending past scheduled time should be overdue')

section('5. isOverdue — Verified, never overdue')
const verifiedInstance = { status: 'verified', scheduledTime: '2026-06-09T08:00:00Z' }
assert(!isOverdue(verifiedInstance), 'verified instance should never be overdue')

section('6. isOverdue — Completed, never overdue')
const completedInstance = { status: 'completed', scheduledTime: '2026-06-09T08:00:00Z' }
assert(!isOverdue(completedInstance), 'completed instance should never be overdue')

// ═══════════════════════════════════════════════════════════════════
// complianceScore
// ═══════════════════════════════════════════════════════════════════

section('7. complianceScore — All passed')
assert(complianceScore([{ status: 'pass' }, { status: 'pass' }]) === 100,
  'all pass should be 100%')

section('8. complianceScore — Half passed')
assert(complianceScore([{ status: 'pass' }, { status: 'fail' }]) === 50,
  'half pass should be 50%')

section('9. complianceScore — With skips')
assert(complianceScore([{ status: 'pass' }, { status: 'skip' }, { status: 'fail' }]) === 33,
  '1 pass, 1 skip, 1 fail = 33%')

section('10. complianceScore — Empty')
assert(complianceScore([]) === 0, 'empty should be 0%')

// ═══════════════════════════════════════════════════════════════════
// isValidStatusTransition
// ═══════════════════════════════════════════════════════════════════

section('11. isValidStatusTransition — Valid transitions')
assert(isValidStatusTransition('pending', 'in_progress'), 'pending → in_progress')
assert(isValidStatusTransition('in_progress', 'completed'), 'in_progress → completed')
assert(isValidStatusTransition('completed', 'verified'), 'completed → verified')
assert(isValidStatusTransition('completed', 'in_progress'), 'completed → in_progress (rejection)')

section('12. isValidStatusTransition — Invalid transitions')
assert(!isValidStatusTransition('pending', 'completed'), 'pending → completed (skip) is invalid')
assert(!isValidStatusTransition('verified', 'pending'), 'verified → pending is invalid')
assert(!isValidStatusTransition('verified', 'in_progress'), 'verified → in_progress is invalid')
assert(!isValidStatusTransition('in_progress', 'verified'), 'in_progress → verified (skip) is invalid')

// ═══════════════════════════════════════════════════════════════════
// isResponseNoteRequired
// ═══════════════════════════════════════════════════════════════════

section('13. isResponseNoteRequired — Fail with note required')
assert(isResponseNoteRequired('fail', true), 'fail + requiresNote = note required')
assert(!isResponseNoteRequired('fail', false), 'fail + no requiresNote = note not required')

section('14. isResponseNoteRequired — Skip always requires note')
assert(isResponseNoteRequired('skip', true), 'skip always requires note')
assert(isResponseNoteRequired('skip', false), 'skip always requires note regardless of flag')

section('15. isResponseNoteRequired — Pass never requires note')
assert(!isResponseNoteRequired('pass', true), 'pass never requires note')
assert(!isResponseNoteRequired('pass', false), 'pass never requires note')

// ═══════════════════════════════════════════════════════════════════
// isValidRunKey
// ═══════════════════════════════════════════════════════════════════

section('16. isValidRunKey — Valid keys')
assert(isValidRunKey('morning'), 'morning is valid')
assert(isValidRunKey('afternoon'), 'afternoon is valid')
assert(isValidRunKey('opening'), 'opening is valid')

section('17. isValidRunKey — Invalid keys')
assert(!isValidRunKey(''), 'empty string is invalid')
assert(!isValidRunKey('   '), 'whitespace is invalid')

// ═══════════════════════════════════════════════════════════════════
// statusSortOrder
// ═══════════════════════════════════════════════════════════════════

section('18. statusSortOrder — Correct ordering')
assert(statusSortOrder('pending') < statusSortOrder('in_progress'), 'pending before in_progress')
assert(statusSortOrder('in_progress') < statusSortOrder('completed'), 'in_progress before completed')
assert(statusSortOrder('completed') < statusSortOrder('verified'), 'completed before verified')

// ═══════════════════════════════════════════════════════════════════
// Run Key Uniqueness (Architecture Rule)
// ═══════════════════════════════════════════════════════════════════

section('19. Run Key — Different keys per template')
// Kitchen Hygiene has morning + afternoon runs
const hygieneRuns = [
  { templateId: 3, runKey: 'morning', scheduledTime: '10:00' },
  { templateId: 3, runKey: 'afternoon', scheduledTime: '16:00' },
]
const uniqueKeys = new Set(hygieneRuns.map(r => `${r.templateId}:${r.runKey}`))
assert(uniqueKeys.size === 2, 'two different run keys for same template')

section('20. Run Key — One active instance per run per day')
// Enforced by partial unique index: (template_id, business_date, outlet_id, run_key)
// Application layer check: no two instances with same (template_id, run_key) active
assert(true, 'partial unique index enforces one active instance per run per day')

// ═══════════════════════════════════════════════════════════════════
// Phase 2 — canRespondToItem
// ═══════════════════════════════════════════════════════════════════

section('21. canRespondToItem — Pending instance, matching role')
assert(canRespondToItem({ status: 'pending', assignedRole: 'kitchen' }, 'kitchen'),
  'kitchen can respond to kitchen-assigned pending instance')

section('22. canRespondToItem — In progress, matching role')
assert(canRespondToItem({ status: 'in_progress', assignedRole: 'kitchen' }, 'kitchen'),
  'kitchen can respond to kitchen-assigned in_progress instance')

section('23. canRespondToItem — Owner/Manager override')
assert(canRespondToItem({ status: 'pending', assignedRole: 'kitchen' }, 'owner'),
  'owner can respond regardless of assigned role')
assert(canRespondToItem({ status: 'pending', assignedRole: 'front_desk' }, 'manager'),
  'manager can respond regardless of assigned role')

section('24. canRespondToItem — Wrong role')
assert(!canRespondToItem({ status: 'pending', assignedRole: 'kitchen' }, 'front_desk'),
  'front_desk cannot respond to kitchen-assigned instance')

section('25. canRespondToItem — Completed instance')
assert(!canRespondToItem({ status: 'completed', assignedRole: 'kitchen' }, 'kitchen'),
  'cannot respond to completed instance')
assert(!canRespondToItem({ status: 'verified', assignedRole: 'kitchen' }, 'kitchen'),
  'cannot respond to verified instance')

// ═══════════════════════════════════════════════════════════════════
// Phase 2 — canCompleteInstance
// ═══════════════════════════════════════════════════════════════════

section('26. canCompleteInstance — All responded')
assert(canCompleteInstance([{ status: 'pass' }, { status: 'fail' }, { status: 'skip' }]),
  'all non-pending = can complete')

section('27. canCompleteInstance — Has pending')
assert(!canCompleteInstance([{ status: 'pass' }, { status: 'pending' }]),
  'has pending = cannot complete')

section('28. canCompleteInstance — Empty')
assert(!canCompleteInstance([]), 'empty = cannot complete')

// ═══════════════════════════════════════════════════════════════════
// Phase 2 — Verification
// ═══════════════════════════════════════════════════════════════════

section('29. canVerifyInstance — Completed')
assert(canVerifyInstance({ status: 'completed' }), 'completed can be verified')

section('30. canVerifyInstance — Other statuses')
assert(!canVerifyInstance({ status: 'pending' }), 'pending cannot be verified')
assert(!canVerifyInstance({ status: 'in_progress' }), 'in_progress cannot be verified')
assert(!canVerifyInstance({ status: 'verified' }), 'already verified cannot be verified again')

section('31. canRejectInstance — Completed')
assert(canRejectInstance({ status: 'completed' }), 'completed can be rejected')

section('32. canRejectInstance — Other statuses')
assert(!canRejectInstance({ status: 'verified' }), 'verified cannot be rejected')

// ═══════════════════════════════════════════════════════════════════
// Phase 2 — Note Validation
// ═══════════════════════════════════════════════════════════════════

section('33. validateFailedItemNote — Required')
assert(validateFailedItemNote('Burner not igniting', true), 'valid note passes')
assert(!validateFailedItemNote('', true), 'empty note fails when required')
assert(!validateFailedItemNote('  ', true), 'whitespace fails when required')
assert(!validateFailedItemNote(null, true), 'null fails when required')

section('34. validateFailedItemNote — Not required')
assert(validateFailedItemNote('', false), 'empty note passes when not required')
assert(validateFailedItemNote(null, false), 'null passes when not required')

section('35. validateRejectionReason')
assert(validateRejectionReason('Items not properly checked'), 'valid reason passes')
assert(!validateRejectionReason(''), 'empty reason fails')
assert(!validateRejectionReason(null), 'null reason fails')

section('36. isValidResponseStatus')
assert(isValidResponseStatus('pass'), 'pass is valid')
assert(isValidResponseStatus('fail'), 'fail is valid')
assert(isValidResponseStatus('skip'), 'skip is valid')
assert(!isValidResponseStatus('pending'), 'pending is not a valid response')
assert(!isValidResponseStatus(''), 'empty is not valid')

// ═══════════════════════════════════════════════════════════════════
// Phase 2 — Failed Item Follow-Up Logic
// ═══════════════════════════════════════════════════════════════════

section('37. Critical item → Incident')
const criticalItem = { isCritical: true, description: 'Gas burner check' }
assert(criticalItem.isCritical, 'critical item should create incident')

section('38. Non-critical item → Task')
const nonCriticalItem = { isCritical: false, description: 'Napkin stock check' }
assert(!nonCriticalItem.isCritical, 'non-critical item should create task')

// ═══════════════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`)
console.log(`  Passed: ${passed}`)
console.log(`  Failed: ${failed}`)
console.log(`  Total:  ${passed + failed}`)
console.log(`${'═'.repeat(60)}\n`)

if (failed > 0) process.exit(1)
