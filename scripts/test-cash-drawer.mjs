// scripts/test-cash-drawer.mjs
// Verifies cash_drawer_sessions and cash_adjustments tables exist with correct columns.
// Run: node scripts/test-cash-drawer.mjs

import { createClient } from '@supabase/supabase-js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

let passed = 0
let failed = 0

function ok(label) {
  console.log(`  ✓ ${label}`)
  passed++
}

function fail(label, detail) {
  console.error(`  ✗ ${label}: ${detail}`)
  failed++
}

async function run() {
  console.log('\nCash Drawer — DB Smoke Tests\n')

  // 1. cash_drawer_sessions table exists and is queryable
  {
    const { error } = await supabase
      .from('cash_drawer_sessions')
      .select('id, business_date, counter, outlet_id, source')
      .limit(1)
    if (error) fail('cash_drawer_sessions queryable', error.message)
    else ok('cash_drawer_sessions table exists')
  }

  // 2. cash_adjustments table exists and is queryable
  {
    const { error } = await supabase
      .from('cash_adjustments')
      .select('id, business_date, adjustment_type, amount, deleted_at')
      .limit(1)
    if (error) fail('cash_adjustments queryable', error.message)
    else ok('cash_adjustments table exists')
  }

  // 3. Duplicate constraint on cash_drawer_sessions
  {
    const OUTLET = '00000000-0000-0000-0000-000000000001'
    const TEST_DATE = '2000-01-01'
    const TEST_COUNTER = '__test_counter__'

    // Pre-clean any residue from a prior aborted run
    await supabase.from('cash_drawer_sessions')
      .delete()
      .eq('business_date', TEST_DATE)
      .eq('counter', TEST_COUNTER)
      .eq('outlet_id', OUTLET)

    const { data: first, error: e1 } = await supabase
      .from('cash_drawer_sessions')
      .insert({ business_date: TEST_DATE, counter: TEST_COUNTER, outlet_id: OUTLET, source: 'manual_import' })
      .select('id')
      .single()

    if (e1) {
      fail('unique constraint test: insert first row', e1.message)
    } else {
      try {
        const { error: e2 } = await supabase
          .from('cash_drawer_sessions')
          .insert({ business_date: TEST_DATE, counter: TEST_COUNTER, outlet_id: OUTLET, source: 'manual_import' })
          .select('id')
          .single()

        if (e2?.code === '23505') ok('unique (business_date, counter, outlet_id) constraint enforced')
        else fail('unique constraint', `expected 23505 but got ${e2?.code ?? 'no error'}`)
      } finally {
        await supabase.from('cash_drawer_sessions').delete().eq('id', first.id)
      }
    }
  }

  // 4. cash_adjustments soft-delete: deleted_at filter
  {
    const { data, error } = await supabase
      .from('cash_adjustments')
      .select('id, deleted_at')
      .is('deleted_at', null)
      .limit(1)
    if (error) fail('soft-delete filter works', error.message)
    else ok('soft-delete filter (deleted_at column and IS NULL filter work)')
  }

  console.log(`\n${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exit(1)
}

run().catch(e => { console.error(e); process.exit(1) })
