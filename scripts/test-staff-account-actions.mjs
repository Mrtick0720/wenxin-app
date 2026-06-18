import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  getStaffAccountActionKeys,
} from '../lib/staffAccountActions.ts'

assert.deepEqual(
  getStaffAccountActionKeys({
    isOwner: true,
    status: 'active',
    sessionActive: true,
  }),
  [],
  'owner accounts never expose account lifecycle actions'
)

assert.deepEqual(
  getStaffAccountActionKeys({
    isOwner: false,
    status: 'active',
    sessionActive: false,
  }),
  ['reset-password', 'suspend', 'archive'],
  'active staff always expose Archive alongside Reset password and Suspend'
)

assert.deepEqual(
  getStaffAccountActionKeys({
    isOwner: false,
    status: 'active',
    sessionActive: true,
  }),
  ['reset-password', 'force-logout', 'suspend', 'archive'],
  'online active staff keep Archive when Force logout is present'
)

assert.deepEqual(
  getStaffAccountActionKeys({
    isOwner: false,
    status: 'suspended',
    sessionActive: false,
  }),
  ['reactivate', 'archive'],
  'suspended staff expose Archive'
)

assert.deepEqual(
  getStaffAccountActionKeys({
    isOwner: false,
    status: 'archived',
    sessionActive: false,
  }),
  ['restore'],
  'archived staff expose Restore only'
)

const componentSource = await readFile(
  new URL('../app/staff/accounts/StaffAccountsClient.tsx', import.meta.url),
  'utf8'
)

assert.match(
  componentSource,
  /grid grid-cols-2 gap-2/,
  'account action rows use a deterministic two-column grid on narrow Safari viewports'
)
assert.match(
  componentSource,
  /className="min-w-0"/,
  'action forms are allowed to shrink inside Safari grid cells'
)
assert.match(
  componentSource,
  /w-full rounded-md/,
  'action buttons fill their grid cells instead of overflowing horizontally'
)
assert.doesNotMatch(
  componentSource,
  /DEBUG \(dev only\)|DEV debug panel/,
  'temporary development diagnostics are removed'
)

console.log('staff account action tests passed')
