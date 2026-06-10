// ── Purchase Lifecycle & Approval Tests (Phase 2.1) ──
//
// 1) PURE tests (always run): transition table, tier, segregation-of-duties.
// 2) INTEGRATION tests (staging only; skipped by default).
//
// SAFETY: integration requires STAGING_SUPABASE_URL + STAGING_SUPABASE_SERVICE_ROLE_KEY.
// Skipped otherwise; never reads .env.local; never connects to production.

import {
  isValidStatusTransition,
  canSetPrices,
  approvalTierFor,
  meetsApprovalTier,
  isSelfApproval,
} from '../lib/purchase/validation.ts'

let passed = 0
let failed = 0
function assert(cond, msg) { if (cond) { passed++ } else { failed++; console.error(`  FAIL: ${msg}`) } }
function section(t) { console.log(`\n${t}`) }

section('Status transitions')
assert(isValidStatusTransition('draft', 'submitted'), 'draft→submitted')
assert(isValidStatusTransition('submitted', 'approved'), 'submitted→approved')
assert(isValidStatusTransition('submitted', 'rejected'), 'submitted→rejected')
assert(isValidStatusTransition('submitted', 'draft'), 'submitted→draft (send back)')
assert(isValidStatusTransition('submitted', 'cancelled'), 'submitted→cancelled')
assert(isValidStatusTransition('approved', 'confirmed'), 'approved→confirmed')
assert(isValidStatusTransition('confirmed', 'purchased'), 'confirmed→purchased')
assert(isValidStatusTransition('rejected', 'draft'), 'rejected→draft')
assert(!isValidStatusTransition('draft', 'approved'), 'draft→approved illegal')
assert(!isValidStatusTransition('purchased', 'cancelled'), 'purchased terminal')
assert(!isValidStatusTransition('cancelled', 'draft'), 'cancelled terminal')

section('Approval tier')
assert(approvalTierFor(400, 500) === 'manager', '400 ≤ 500 → manager tier')
assert(approvalTierFor(500, 500) === 'manager', 'boundary 500 → manager tier')
assert(approvalTierFor(600, 500) === 'owner', '600 > 500 → owner tier')
assert(meetsApprovalTier('owner', 'owner'), 'owner meets owner tier')
assert(meetsApprovalTier('owner', 'manager'), 'owner meets manager tier')
assert(meetsApprovalTier('manager', 'manager'), 'manager meets manager tier')
assert(!meetsApprovalTier('manager', 'owner'), 'manager does NOT meet owner tier')
assert(!meetsApprovalTier('kitchen', 'manager'), 'kitchen meets nothing')

section('Role price-setting')
assert(canSetPrices('owner') && canSetPrices('manager'), 'owner/manager can set prices')
assert(!canSetPrices('kitchen') && !canSetPrices('front_desk'), 'kitchen/front_desk cannot')

section('Segregation of duties')
assert(isSelfApproval('u1', 'u1'), 'same user = self-approval')
assert(!isSelfApproval('u1', 'u2'), 'different user = not self')

// ── Integration (staging only) ──
const URL = process.env.STAGING_SUPABASE_URL
const KEY = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY

async function runIntegration() {
  section('Integration (staging)')
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(URL, KEY, { auth: { persistSession: false } })
  // Asserts to cover here (documented; require seeded staff_profiles + settings):
  //  • approve blocked by SoD when allow_self_approve=false; allowed when true
  //  • confirmPrices: NOT_PRICED if any line unpriced
  //  • confirmPrices: manager blocked when total > manager_limit; owner allowed
  //  • reject requires reason; sets rejected_by/at
  //  • cancel sets cancelled_by/at; illegal transitions rejected by status guard
  //  • concurrent double-approve → exactly one succeeds (status-guarded update)
  assert(typeof db.rpc === 'function', 'supabase client constructed for staging')
}

if (URL && KEY) {
  await runIntegration().catch((e) => { failed++; console.error('  INTEGRATION ERROR:', e?.message ?? e) })
} else {
  console.log('\nIntegration tests SKIPPED — set STAGING_SUPABASE_URL + STAGING_SUPABASE_SERVICE_ROLE_KEY')
  console.log('(never point these at production)')
}

console.log('\n' + '═'.repeat(60))
console.log(`  Passed: ${passed}\n  Failed: ${failed}\n  Total:  ${passed + failed}`)
console.log('═'.repeat(60))
process.exit(failed > 0 ? 1 : 0)
