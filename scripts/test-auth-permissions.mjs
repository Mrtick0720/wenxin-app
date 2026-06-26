import assert from 'node:assert/strict'
import {
  canAccessPath,
  getAuthRedirect,
  getHomeVisibility,
  getNavigationItems,
  isSessionExpired,
  isValidStaffId,
  normalizeStaffId,
  staffIdToEmail,
  validateNewStaff,
  validatePasswordChange,
} from '../lib/auth/permissions.ts'

assert.equal(normalizeStaffId('  Kitchen-01 '), 'kitchen-01')
assert.equal(isValidStaffId('lina_02'), true)
assert.equal(isValidStaffId('Lina 02'), false)
assert.equal(staffIdToEmail('Lina'), 'lina@staff.wenxin.internal')

assert.equal(canAccessPath('owner', '/finance'), true)
assert.equal(canAccessPath('manager', '/finance'), false)
assert.equal(canAccessPath('kitchen', '/bento/production'), true)
assert.equal(canAccessPath('kitchen', '/bento/customers'), false)
assert.equal(canAccessPath('front_desk', '/bento/customers/12/edit'), true)
assert.equal(canAccessPath('front_desk', '/bento/production'), false)
assert.equal(canAccessPath('front_desk', '/purchase'), true)

assert.deepEqual(getHomeVisibility('kitchen'), {
  revenue: false,
  reports: false,
  finance: false,
  operationalAlerts: true,
})

assert.equal(
  isSessionExpired('2026-06-06T00:00:00Z', new Date('2026-06-06T11:59:59Z')),
  false
)
assert.equal(
  isSessionExpired('2026-06-06T00:00:00Z', new Date('2026-06-06T12:00:00Z')),
  true
)

assert.deepEqual(validatePasswordChange('abcdefgh', 'abcdefgh'), { ok: true })
assert.equal(validatePasswordChange('short', 'short').ok, false)
assert.equal(validatePasswordChange('abcdefgh', 'abcdefgi').ok, false)

assert.equal(
  validateNewStaff({
    staffId: 'lina',
    displayName: 'Lina',
    role: 'front_desk',
    password: 'initial-strong-pass',
  }).ok,
  true
)
assert.equal(
  validateNewStaff({
    staffId: 'Lina 1',
    displayName: '',
    role: 'owner',
    password: 'short',
  }).ok,
  false
)

assert.equal(
  getAuthRedirect({ path: '/bento', authenticated: false }),
  '/login'
)
assert.equal(
  getAuthRedirect({
    path: '/login',
    authenticated: true,
    active: true,
    mustChangePassword: false,
    role: 'owner',
    sessionValid: true,
  }),
  '/'
)
assert.equal(
  getAuthRedirect({
    path: '/',
    authenticated: true,
    active: true,
    mustChangePassword: true,
    role: 'owner',
    sessionValid: true,
  }),
  '/change-password'
)
assert.equal(
  getAuthRedirect({
    path: '/finance',
    authenticated: true,
    active: true,
    mustChangePassword: false,
    role: 'manager',
    sessionValid: true,
  }),
  '/access-denied'
)
assert.equal(
  getAuthRedirect({
    path: '/',
    authenticated: true,
    active: false,
    mustChangePassword: false,
    role: 'front_desk',
    sessionValid: true,
  }),
  '/account-disabled'
)
assert.equal(
  getAuthRedirect({
    path: '/',
    authenticated: true,
    active: true,
    mustChangePassword: false,
    role: 'owner',
    sessionValid: false,
  }),
  '/login?reason=session-ended'
)

assert.deepEqual(
  getNavigationItems('kitchen').map(item => item.href),
  ['/', '/tasks', '/purchase', '/profile']
)
assert.deepEqual(
  getNavigationItems('front_desk').map(item => item.href),
  ['/', '/tasks', '/purchase', '/profile']
)

console.log('staff authorization tests passed')
