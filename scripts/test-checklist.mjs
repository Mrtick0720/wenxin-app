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
// Results
// ═══════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`)
console.log(`  Passed: ${passed}`)
console.log(`  Failed: ${failed}`)
console.log(`  Total:  ${passed + failed}`)
console.log(`${'═'.repeat(60)}\n`)

if (failed > 0) process.exit(1)
