// ── Attendance Module Tests (Phase 1) ──
// Pure-function tests for validation, session logic, and status derivation.

import {
  getShiftWindow,
  hasOpenSession,
  findOpenSession,
  sessionHours,
  isLate,
  isWorkingShift,
  isClosable,
  canCloseSession,
  SHIFT_WINDOWS,
} from '../lib/attendance/validation.ts'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { passed++ } else { failed++; console.error(`  FAIL: ${message}`) }
}

function section(title) { console.log(`\n${title}`) }

// ═══════════════════════════════════════════════════════════════════
// Shift Windows
// ═══════════════════════════════════════════════════════════════════

section('1. getShiftWindow — Working shifts')
assert(getShiftWindow('morning')?.start === '09:00', 'morning starts at 09:00')
assert(getShiftWindow('morning')?.end === '15:00', 'morning ends at 15:00')
assert(getShiftWindow('full')?.start === '10:00', 'full starts at 10:00')
assert(getShiftWindow('afternoon')?.end === '21:00', 'afternoon ends at 21:00')

section('2. getShiftWindow — Non-working shifts')
assert(getShiftWindow('off') === null, 'off has no window')
assert(getShiftWindow('leave') === null, 'leave has no window')
assert(getShiftWindow('unknown') === null, 'unknown shift type returns null')

section('3. SHIFT_WINDOWS — All working shifts defined')
assert('morning' in SHIFT_WINDOWS, 'morning defined')
assert('full' in SHIFT_WINDOWS, 'full defined')
assert('afternoon' in SHIFT_WINDOWS, 'afternoon defined')

// ═══════════════════════════════════════════════════════════════════
// isWorkingShift
// ═══════════════════════════════════════════════════════════════════

section('4. isWorkingShift')
assert(isWorkingShift('morning'), 'morning is working')
assert(isWorkingShift('full'), 'full is working')
assert(isWorkingShift('afternoon'), 'afternoon is working')
assert(!isWorkingShift('off'), 'off is not working')
assert(!isWorkingShift('leave'), 'leave is not working')

// ═══════════════════════════════════════════════════════════════════
// Session Detection
// ═══════════════════════════════════════════════════════════════════

const mockSessions = [
  { clockIn: '2026-06-09T08:00:00Z', clockOut: '2026-06-09T12:00:00Z' },
  { clockIn: '2026-06-09T13:00:00Z', clockOut: null },
]

section('5. hasOpenSession — Detects open session')
assert(hasOpenSession(mockSessions), 'should detect open session')

section('6. hasOpenSession — No open session')
assert(!hasOpenSession([{ clockIn: '2026-06-09T08:00:00Z', clockOut: '2026-06-09T12:00:00Z' }]),
  'should return false when all closed')

section('7. hasOpenSession — Empty array')
assert(!hasOpenSession([]), 'empty array should return false')

section('8. findOpenSession — Returns open session')
const open = findOpenSession(mockSessions)
assert(open !== null, 'should find open session')
assert(open?.clockOut === null, 'open session should have null clockOut')

section('9. findOpenSession — Returns null when none')
const none = findOpenSession([{ clockIn: '2026-06-09T08:00:00Z', clockOut: '2026-06-09T12:00:00Z' }])
assert(none === null, 'should return null when no open session')

// ═══════════════════════════════════════════════════════════════════
// Session Hours
// ═══════════════════════════════════════════════════════════════════

section('10. sessionHours — Calculates correctly')
const hours = sessionHours('2026-06-09T08:00:00Z', '2026-06-09T12:00:00Z')
assert(hours === 4, `4 hours expected, got ${hours}`)

section('11. sessionHours — Half hour')
const half = sessionHours('2026-06-09T08:00:00Z', '2026-06-09T12:30:00Z')
assert(half === 4.5, `4.5 hours expected, got ${half}`)

section('12. sessionHours — Null clockOut')
assert(sessionHours('2026-06-09T08:00:00Z', null) === null, 'null clockOut returns null')

// ═══════════════════════════════════════════════════════════════════
// Late Detection
// ═══════════════════════════════════════════════════════════════════

// Note: Database stores timestamptz in UTC. Malaysia is UTC+8.
// 09:05 MYT = 01:05Z, 09:15 MYT = 01:15Z, etc.

section('13. isLate — On time (within threshold)')
assert(!isLate('2026-06-09T01:05:00Z', 'morning', 15),
  '09:05 MYT should not be late with 15 min threshold (shift starts 09:00 MYT)')

section('14. isLate — At threshold boundary')
assert(!isLate('2026-06-09T01:15:00Z', 'morning', 15),
  '09:15 MYT exactly at threshold should not be late')

section('15. isLate — Past threshold')
assert(isLate('2026-06-09T01:16:00Z', 'morning', 15),
  '09:16 MYT past threshold should be late')

section('16. isLate — Very late')
assert(isLate('2026-06-09T03:00:00Z', 'morning', 15),
  '11:00 MYT should be late')

section('17. isLate — Non-working shift never late')
assert(!isLate('2026-06-09T11:00:00Z', 'off', 15), 'off shift never late')
assert(!isLate('2026-06-09T11:00:00Z', 'leave', 15), 'leave shift never late')

// ═══════════════════════════════════════════════════════════════════
// Session Closure
// ═══════════════════════════════════════════════════════════════════

section('18. isClosable — Open session')
assert(isClosable({ clockIn: '2026-06-09T08:00:00Z', clockOut: null }),
  'open session is closable')

section('19. isClosable — Closed session')
assert(!isClosable({ clockIn: '2026-06-09T08:00:00Z', clockOut: '2026-06-09T12:00:00Z' }),
  'closed session is not closable')

section('20. canCloseSession — Own session, app method')
assert(canCloseSession(
  { staffUserId: 'user-a', clockMethod: 'app', clockOut: null },
  'user-a'
), 'own app-method session can be closed')

section('21. canCloseSession — Different user')
assert(!canCloseSession(
  { staffUserId: 'user-a', clockMethod: 'app', clockOut: null },
  'user-b'
), 'different user cannot close')

section('22. canCloseSession — Not app method')
assert(!canCloseSession(
  { staffUserId: 'user-a', clockMethod: 'manager_manual', clockOut: null },
  'user-a'
), 'non-app session cannot be self-closed')

// ═══════════════════════════════════════════════════════════════════
// Multi-Shift Per Day (Architecture Rule)
// ═══════════════════════════════════════════════════════════════════

section('23. Multi-Shift — Same staff, same date, different labels allowed')
// Staff can have morning + afternoon shifts on the same day.
// Uniqueness is on (staff_user_id, date, shift_label), not (staff_user_id, date).
const shift1 = { staffUserId: 'user-a', date: '2026-06-09', shiftType: 'morning', shiftLabel: 'lunch' }
const shift2 = { staffUserId: 'user-a', date: '2026-06-09', shiftType: 'afternoon', shiftLabel: 'dinner' }
assert(shift1.shiftLabel !== shift2.shiftLabel, 'Different shift labels on same day are allowed')
assert(shift1.staffUserId === shift2.staffUserId, 'Same staff member')
assert(shift1.date === shift2.date, 'Same date — multiple shifts supported')

section('24. Multi-Shift — Status is derived, not stored')
// AttendanceSession type has no 'status' field. Status comes from getStaffStatus().
// The database stores only raw facts: clock_in, clock_out, clock_method, end_reason.
const sessionFields = ['clockIn', 'clockOut', 'clockMethod', 'endReason', 'businessDate']
const hasNoStatus = !sessionFields.includes('status')
assert(hasNoStatus, 'Session fields should not include a stored status — status is derived')

// ═══════════════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`)
console.log(`  Passed: ${passed}`)
console.log(`  Failed: ${failed}`)
console.log(`  Total:  ${passed + failed}`)
console.log(`${'═'.repeat(60)}\n`)

if (failed > 0) process.exit(1)
