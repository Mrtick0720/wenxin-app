import { readFileSync } from 'node:fs'

function read(path, optional = false) {
  try {
    return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  } catch (error) {
    if (optional && error?.code === 'ENOENT') return ''
    throw error
  }
}

const actions = read('app/purchase/actions.ts')
const checklist = read('app/purchase/checklist-actions.ts')
const verification = read('app/purchase/verification-actions.ts')
const repository = read('lib/purchaseLedger/repository.ts')
const service = read('lib/purchaseLedger/service.ts')
const pendingUi = read('app/purchase/PendingVerificationSection.tsx')
const migration = read('supabase/migrations/20260623_front_desk_purchase_phase1.sql', true)

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
  actions.includes("const READ_ROLES = ['owner', 'manager', 'kitchen', 'front_desk'] as const") &&
    actions.includes("const RECORD_WRITE_ROLES = ['owner', 'manager', 'kitchen'] as const"),
  'Purchase read/init actions allow front_desk',
)
assert(
  checklist.includes("const ROLES = ['owner', 'manager', 'kitchen', 'front_desk'] as const"),
  'checklist request actions allow front_desk',
)
assert(
  checklist.includes("const PURCHASE_EXECUTION_ROLES = ['owner', 'manager'] as const") &&
    checklist.includes('requireRole(...PURCHASE_EXECUTION_ROLES)'),
  'To Buy to To Verify remains owner/manager-only',
)
assert(
  repository.includes('export function purchaseRecordColumnsForRole(role: StaffRole)') &&
    repository.includes('return canViewPurchaseCosts(role) ? FULL_COLUMNS : STAFF_COLUMNS'),
  'Purchase record columns are selected by role',
)
assert(
  !repository.match(/const STAFF_COLUMNS\\s*=.*supplier/) &&
    !repository.match(/const STAFF_COLUMNS\\s*=.*unit_price/) &&
    !repository.match(/const STAFF_COLUMNS\\s*=.*total_price/),
  'staff-safe Purchase columns omit supplier and costs',
)
assert(
  service.includes('queryPendingVerification(role)'),
  'pending verification reads receive the caller role',
)
assert(
  verification.includes('purchaseRecordColumnsForRole(staff.role)'),
  'verification responses use role-safe columns',
)
assert(
  pendingUi.includes('canCancel: boolean') &&
    pendingUi.includes('{canCancel && ('),
  'cancel UI is controlled separately from verification',
)
assert(
  migration.includes("public.staff_role_is(array['front_desk'])") &&
    migration.includes("status = 'pending_verification'") &&
    migration.includes('date = public.kk_today()::text'),
  'RLS grants front_desk only pending verification and today rows',
)
assert(
  !migration.includes('for insert') && !migration.includes('for delete'),
  'Phase 1 RLS does not grant insert or delete',
)

console.log(`Front desk Purchase Phase 1: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
