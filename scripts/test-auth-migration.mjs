import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(
  new URL('../supabase/migrations/202606061200_staff_authentication.sql', import.meta.url),
  'utf8',
)

const addTimeSlot = migration.indexOf(
  'alter table public.bento_orders add column if not exists time_slot text;',
)
const createKitchenView = migration.indexOf(
  'create or replace view public.bento_kitchen_orders',
)

assert.notEqual(
  addTimeSlot,
  -1,
  'staff auth migration must add the bento_orders.time_slot column when missing',
)
assert.ok(
  addTimeSlot < createKitchenView,
  'bento_orders.time_slot must exist before the kitchen order view is created',
)
assert.match(
  migration,
  /s\.created_at \+ interval '12 hours' > now\(\)/,
  'staff sessions must remain limited to twelve hours',
)
assert.match(
  migration,
  /delete from auth\.sessions\s+where user_id = target_user;/,
  'owner session invalidation must continue revoking Supabase auth sessions',
)

console.log('staff auth migration schema tests passed')
