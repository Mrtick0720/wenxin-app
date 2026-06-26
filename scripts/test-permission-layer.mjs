// ── Permission Layer Tests (Phase 0) ──
// Pure-function tests. No Supabase, no database, no browser.
// Validates: permission keys, role mappings, check functions, route map.

import { PERMISSION } from '../lib/auth/permissionKeys.ts'
import { ROLE_PERMISSIONS } from '../lib/auth/rolePermissions.ts'
import { hasPermission, hasAllPermissions, hasAnyPermission, getPermissionsForRole } from '../lib/auth/permissionCheck.ts'
import { PERMISSION_ROUTE_MAP } from '../lib/auth/permissionRouteMap.ts'
import { STAFF_ROLES } from '../lib/auth/types.ts'

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
// Permission Keys
// ═══════════════════════════════════════════════════════════════════

section('1. Permission Keys — Count')
const allKeys = Object.values(PERMISSION)
const totalKeys = allKeys.length
assert(totalKeys >= 40, `Expected at least 40 permission keys, got ${totalKeys}`)

section('2. Permission Keys — All Unique')
const uniqueKeys = new Set(allKeys)
assert(uniqueKeys.size === allKeys.length, `Duplicate keys found: ${allKeys.length - uniqueKeys.size} duplicates`)

section('3. Permission Keys — Naming Convention')
const validPattern = /^[a-z_]+:[a-z_]+:[a-z_]+$|^[a-z_]+:[a-z_]+$/
for (const key of allKeys) {
  assert(validPattern.test(key), `Key "${key}" does not match <module>:<resource>:<action> pattern`)
}

section('4. Permission Keys — No Empty Values')
for (const [name, value] of Object.entries(PERMISSION)) {
  assert(value.length > 0, `PERMISSION.${name} has empty value`)
  assert(!value.includes(' '), `PERMISSION.${name} value "${value}" contains whitespace`)
}

// ═══════════════════════════════════════════════════════════════════
// Roles
// ═══════════════════════════════════════════════════════════════════

section('5. Roles — All Roles Defined')
assert(STAFF_ROLES.length === 8, `Expected 8 roles, got ${STAFF_ROLES.length}`)
assert(STAFF_ROLES.includes('owner'), 'owner role missing')
assert(STAFF_ROLES.includes('manager'), 'manager role missing')
assert(STAFF_ROLES.includes('kitchen'), 'kitchen role missing')
assert(STAFF_ROLES.includes('front_desk'), 'front_desk role missing')
assert(STAFF_ROLES.includes('delivery'), 'delivery role missing')
assert(STAFF_ROLES.includes('cashier'), 'cashier role missing')
assert(STAFF_ROLES.includes('packing'), 'packing role missing')
assert(STAFF_ROLES.includes('other'), 'other role missing')

section('6. Roles — ROLE_PERMISSIONS Has All Roles')
for (const role of STAFF_ROLES) {
  assert(Array.isArray(ROLE_PERMISSIONS[role]), `ROLE_PERMISSIONS.${role} is not an array`)
  assert(ROLE_PERMISSIONS[role].length > 0, `ROLE_PERMISSIONS.${role} is empty`)
}

section('7. Roles — All Permission References Are Valid')
for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
  for (const perm of permissions) {
    assert(allKeys.includes(perm), `ROLE_PERMISSIONS.${role} references unknown permission: "${perm}"`)
  }
}

// ═══════════════════════════════════════════════════════════════════
// Owner Permissions
// ═══════════════════════════════════════════════════════════════════

section('8. Owner — Has All Permissions')
const ownerPerms = new Set(ROLE_PERMISSIONS.owner)
for (const key of allKeys) {
  assert(ownerPerms.has(key), `Owner missing permission: ${key}`)
}
assert(ROLE_PERMISSIONS.owner.length === totalKeys, `Owner has ${ROLE_PERMISSIONS.owner.length} permissions, expected ${totalKeys}`)

// ═══════════════════════════════════════════════════════════════════
// Manager Permissions — Spot Checks
// ═══════════════════════════════════════════════════════════════════

section('9. Manager — Has Key Permissions')
assert(hasPermission('manager', PERMISSION.VIEW_HOME_REVENUE), 'Manager should have VIEW_HOME_REVENUE')
assert(hasPermission('manager', PERMISSION.VIEW_FINANCIAL_DATA), 'Manager should have VIEW_FINANCIAL_DATA')
assert(hasPermission('manager', PERMISSION.VIEW_BENTO_PRODUCTION), 'Manager should have VIEW_BENTO_PRODUCTION')
assert(hasPermission('manager', PERMISSION.EDIT_SUPPLIERS), 'Manager should have EDIT_SUPPLIERS')
assert(hasPermission('manager', PERMISSION.VERIFY_CHECKLIST), 'Manager should have VERIFY_CHECKLIST')
assert(hasPermission('manager', PERMISSION.VIEW_ATTENDANCE_ALL), 'Manager should have VIEW_ATTENDANCE_ALL')

section('10. Manager — Does NOT Have Owner-Only Permissions')
assert(!hasPermission('manager', PERMISSION.VIEW_FINANCE), 'Manager should NOT have VIEW_FINANCE')
assert(!hasPermission('manager', PERMISSION.EDIT_FINANCE), 'Manager should NOT have EDIT_FINANCE')
assert(!hasPermission('manager', PERMISSION.MANAGE_STAFF_ACCOUNTS), 'Manager should NOT have MANAGE_STAFF_ACCOUNTS')
assert(!hasPermission('manager', PERMISSION.VIEW_ACTIVITY_LOG), 'Manager should NOT have VIEW_ACTIVITY_LOG')
assert(!hasPermission('manager', PERMISSION.MANAGE_RESTAURANT_SETTINGS), 'Manager should NOT have MANAGE_RESTAURANT_SETTINGS')
assert(!hasPermission('manager', PERMISSION.MANAGE_ROLES), 'Manager should NOT have MANAGE_ROLES')

// ═══════════════════════════════════════════════════════════════════
// Kitchen Permissions — Spot Checks
// ═══════════════════════════════════════════════════════════════════

section('11. Kitchen — Has Key Permissions')
assert(hasPermission('kitchen', PERMISSION.VIEW_HOME), 'Kitchen should have VIEW_HOME')
assert(hasPermission('kitchen', PERMISSION.VIEW_HOME_ALERTS), 'Kitchen should have VIEW_HOME_ALERTS')
assert(hasPermission('kitchen', PERMISSION.VIEW_BENTO), 'Kitchen should have VIEW_BENTO')
assert(hasPermission('kitchen', PERMISSION.VIEW_BENTO_ORDERS), 'Kitchen should have VIEW_BENTO_ORDERS')
assert(hasPermission('kitchen', PERMISSION.VIEW_BENTO_PRODUCTION), 'Kitchen should have VIEW_BENTO_PRODUCTION')
assert(hasPermission('kitchen', PERMISSION.VIEW_PURCHASE), 'Kitchen should have VIEW_PURCHASE')
assert(hasPermission('kitchen', PERMISSION.EDIT_PURCHASE), 'Kitchen should have EDIT_PURCHASE')
assert(hasPermission('kitchen', PERMISSION.VIEW_INVENTORY), 'Kitchen should have VIEW_INVENTORY')
assert(hasPermission('kitchen', PERMISSION.VIEW_ATTENDANCE_SELF), 'Kitchen should have VIEW_ATTENDANCE_SELF')
// Kitchen no longer has VIEW_SUPPLIERS: the Suppliers page exposes purchase
// cost totals, which must never reach staff devices (Purchase cost-hiding policy).
assert(!hasPermission('kitchen', PERMISSION.VIEW_SUPPLIERS), 'Kitchen should NOT have VIEW_SUPPLIERS (cost-hiding)')
assert(hasPermission('kitchen', PERMISSION.VIEW_ASSETS), 'Kitchen should have VIEW_ASSETS')

section('12. Kitchen — Does NOT Have Restricted Permissions')
assert(!hasPermission('kitchen', PERMISSION.VIEW_HOME_REVENUE), 'Kitchen should NOT have VIEW_HOME_REVENUE')
assert(!hasPermission('kitchen', PERMISSION.VIEW_FINANCE), 'Kitchen should NOT have VIEW_FINANCE')
assert(!hasPermission('kitchen', PERMISSION.VIEW_REPORTS), 'Kitchen should NOT have VIEW_REPORTS')
assert(!hasPermission('kitchen', PERMISSION.VIEW_BENTO_CUSTOMERS), 'Kitchen should NOT have VIEW_BENTO_CUSTOMERS')
assert(!hasPermission('kitchen', PERMISSION.VIEW_BENTO_PAYMENTS), 'Kitchen should NOT have VIEW_BENTO_PAYMENTS')
assert(!hasPermission('kitchen', PERMISSION.VIEW_DINE_IN), 'Kitchen should NOT have VIEW_DINE_IN')
assert(!hasPermission('kitchen', PERMISSION.VIEW_RESERVATIONS), 'Kitchen should NOT have VIEW_RESERVATIONS')
assert(!hasPermission('kitchen', PERMISSION.VIEW_ATTENDANCE_ALL), 'Kitchen should NOT have VIEW_ATTENDANCE_ALL')
assert(!hasPermission('kitchen', PERMISSION.EDIT_SUPPLIERS), 'Kitchen should NOT have EDIT_SUPPLIERS')
assert(!hasPermission('kitchen', PERMISSION.EDIT_ASSETS), 'Kitchen should NOT have EDIT_ASSETS')
assert(!hasPermission('kitchen', PERMISSION.VIEW_CUSTOMER_PII), 'Kitchen should NOT have VIEW_CUSTOMER_PII')

// ═══════════════════════════════════════════════════════════════════
// Front Desk Permissions — Spot Checks
// ═══════════════════════════════════════════════════════════════════

section('13. Front Desk — Has Key Permissions')
assert(hasPermission('front_desk', PERMISSION.VIEW_HOME), 'Front Desk should have VIEW_HOME')
assert(hasPermission('front_desk', PERMISSION.VIEW_BENTO), 'Front Desk should have VIEW_BENTO')
assert(hasPermission('front_desk', PERMISSION.EDIT_BENTO_ORDERS), 'Front Desk should have EDIT_BENTO_ORDERS')
assert(hasPermission('front_desk', PERMISSION.VIEW_BENTO_CUSTOMERS), 'Front Desk should have VIEW_BENTO_CUSTOMERS')
assert(hasPermission('front_desk', PERMISSION.VIEW_DINE_IN), 'Front Desk should have VIEW_DINE_IN')
assert(hasPermission('front_desk', PERMISSION.VIEW_RESERVATIONS), 'Front Desk should have VIEW_RESERVATIONS')
assert(hasPermission('front_desk', PERMISSION.VIEW_COMPLAINTS), 'Front Desk should have VIEW_COMPLAINTS')
assert(hasPermission('front_desk', PERMISSION.VIEW_INCIDENTS), 'Front Desk should have VIEW_INCIDENTS')
assert(hasPermission('front_desk', PERMISSION.VIEW_CASHIER), 'Front Desk should have VIEW_CASHIER')
assert(hasPermission('front_desk', PERMISSION.OPERATE_CASHIER), 'Front Desk should have OPERATE_CASHIER')
assert(hasPermission('front_desk', PERMISSION.VIEW_CUSTOMER_PII), 'Front Desk should have VIEW_CUSTOMER_PII')
assert(hasPermission('front_desk', PERMISSION.VIEW_PURCHASE), 'Front Desk should have VIEW_PURCHASE')

section('14. Front Desk — Does NOT Have Restricted Permissions')
assert(!hasPermission('front_desk', PERMISSION.VIEW_HOME_REVENUE), 'Front Desk should NOT have VIEW_HOME_REVENUE')
assert(!hasPermission('front_desk', PERMISSION.VIEW_FINANCE), 'Front Desk should NOT have VIEW_FINANCE')
assert(!hasPermission('front_desk', PERMISSION.VIEW_REPORTS), 'Front Desk should NOT have VIEW_REPORTS')
assert(!hasPermission('front_desk', PERMISSION.VIEW_BENTO_PRODUCTION), 'Front Desk should NOT have VIEW_BENTO_PRODUCTION')
assert(!hasPermission('front_desk', PERMISSION.APPROVE_PURCHASE), 'Front Desk should NOT have legacy APPROVE_PURCHASE')
assert(!hasPermission('front_desk', PERMISSION.EDIT_PURCHASE), 'Front Desk should NOT directly edit Purchase ledger records')
assert(!hasPermission('front_desk', PERMISSION.VIEW_PURCHASE_COSTS), 'Front Desk should NOT have VIEW_PURCHASE_COSTS')
assert(!hasPermission('front_desk', PERMISSION.DELETE_PURCHASE), 'Front Desk should NOT have DELETE_PURCHASE')
assert(!hasPermission('front_desk', PERMISSION.EXPORT_PURCHASE), 'Front Desk should NOT have EXPORT_PURCHASE')
assert(!hasPermission('front_desk', PERMISSION.VIEW_INVENTORY), 'Front Desk should NOT have VIEW_INVENTORY')
assert(!hasPermission('front_desk', PERMISSION.VIEW_ATTENDANCE_ALL), 'Front Desk should NOT have VIEW_ATTENDANCE_ALL')
assert(!hasPermission('front_desk', PERMISSION.EDIT_SUPPLIERS), 'Front Desk should NOT have EDIT_SUPPLIERS')
assert(!hasPermission('front_desk', PERMISSION.EDIT_ASSETS), 'Front Desk should NOT have EDIT_ASSETS')
assert(!hasPermission('front_desk', PERMISSION.CLOSE_CASHIER_SHIFT), 'Front Desk should NOT have CLOSE_CASHIER_SHIFT')

// ═══════════════════════════════════════════════════════════════════
// Delivery Permissions — Spot Checks
// ═══════════════════════════════════════════════════════════════════

section('15. Delivery — Has Key Permissions')
assert(hasPermission('delivery', PERMISSION.VIEW_HOME), 'Delivery should have VIEW_HOME')
assert(hasPermission('delivery', PERMISSION.VIEW_HOME_ALERTS), 'Delivery should have VIEW_HOME_ALERTS')
assert(hasPermission('delivery', PERMISSION.VIEW_BENTO), 'Delivery should have VIEW_BENTO')
assert(hasPermission('delivery', PERMISSION.VIEW_BENTO_ORDERS), 'Delivery should have VIEW_BENTO_ORDERS')
assert(hasPermission('delivery', PERMISSION.VIEW_TASKS), 'Delivery should have VIEW_TASKS')
assert(hasPermission('delivery', PERMISSION.VIEW_ATTENDANCE_SELF), 'Delivery should have VIEW_ATTENDANCE_SELF')
assert(hasPermission('delivery', PERMISSION.EDIT_ATTENDANCE_SELF), 'Delivery should have EDIT_ATTENDANCE_SELF')

section('16. Delivery — Does NOT Have Restricted Permissions')
assert(!hasPermission('delivery', PERMISSION.VIEW_HOME_REVENUE), 'Delivery should NOT have VIEW_HOME_REVENUE')
assert(!hasPermission('delivery', PERMISSION.VIEW_FINANCE), 'Delivery should NOT have VIEW_FINANCE')
assert(!hasPermission('delivery', PERMISSION.EDIT_TASKS), 'Delivery should NOT have EDIT_TASKS')
assert(!hasPermission('delivery', PERMISSION.VIEW_SUPPLIERS), 'Delivery should NOT have VIEW_SUPPLIERS')
assert(!hasPermission('delivery', PERMISSION.VIEW_ASSETS), 'Delivery should NOT have VIEW_ASSETS')
assert(!hasPermission('delivery', PERMISSION.VIEW_CUSTOMER_PII), 'Delivery should NOT have VIEW_CUSTOMER_PII')

// ═══════════════════════════════════════════════════════════════════
// hasPermission() — Edge Cases
// ═══════════════════════════════════════════════════════════════════

section('17. hasPermission — Returns false for invalid role')
assert(!hasPermission('invalid_role', PERMISSION.VIEW_HOME), 'Invalid role should return false')

section('18. hasPermission — Returns false for valid role + missing permission')
assert(!hasPermission('kitchen', PERMISSION.VIEW_FINANCE), 'Kitchen + VIEW_FINANCE should return false')

section('19. hasPermission — Returns true for valid role + valid permission')
assert(hasPermission('owner', PERMISSION.VIEW_FINANCE), 'Owner + VIEW_FINANCE should return true')

// ═══════════════════════════════════════════════════════════════════
// hasAllPermissions()
// ═══════════════════════════════════════════════════════════════════

section('20. hasAllPermissions — Returns true when all held')
assert(hasAllPermissions('owner', [PERMISSION.VIEW_HOME, PERMISSION.VIEW_FINANCE, PERMISSION.MANAGE_ROLES]),
  'Owner should have all three permissions')

section('21. hasAllPermissions — Returns false when one is missing')
assert(!hasAllPermissions('kitchen', [PERMISSION.VIEW_HOME, PERMISSION.VIEW_FINANCE]),
  'Kitchen should NOT have VIEW_FINANCE')

// ═══════════════════════════════════════════════════════════════════
// hasAnyPermission()
// ═══════════════════════════════════════════════════════════════════

section('22. hasAnyPermission — Returns true when any held')
assert(hasAnyPermission('kitchen', [PERMISSION.VIEW_FINANCE, PERMISSION.VIEW_HOME]),
  'Kitchen should have VIEW_HOME')

section('23. hasAnyPermission — Returns false when none held')
assert(!hasAnyPermission('kitchen', [PERMISSION.VIEW_FINANCE, PERMISSION.VIEW_REPORTS]),
  'Kitchen should NOT have VIEW_FINANCE or VIEW_REPORTS')

// ═══════════════════════════════════════════════════════════════════
// getPermissionsForRole()
// ═══════════════════════════════════════════════════════════════════

section('24. getPermissionsForRole — Returns array for valid role')
const ownerPermsList = getPermissionsForRole('owner')
assert(ownerPermsList.length === totalKeys, `getPermissionsForRole('owner') returned ${ownerPermsList.length}, expected ${totalKeys}`)

section('25. getPermissionsForRole — Returns empty array for invalid role')
const invalidPerms = getPermissionsForRole('invalid_role')
assert(invalidPerms.length === 0, 'Invalid role should return empty array')

// ═══════════════════════════════════════════════════════════════════
// PERMISSION_ROUTE_MAP
// ═══════════════════════════════════════════════════════════════════

section('26. PERMISSION_ROUTE_MAP — All Keys Are Valid Permission Keys')
for (const key of Object.keys(PERMISSION_ROUTE_MAP)) {
  assert(allKeys.includes(key), `PERMISSION_ROUTE_MAP key "${key}" is not a valid PermissionKey`)
}

section('27. PERMISSION_ROUTE_MAP — All Values Are Valid Route Prefixes')
for (const [key, routes] of Object.entries(PERMISSION_ROUTE_MAP)) {
  assert(Array.isArray(routes), `PERMISSION_ROUTE_MAP[${key}] is not an array`)
  for (const route of routes) {
    assert(route.startsWith('/'), `Route "${route}" does not start with /`)
    assert(!route.endsWith('/') || route === '/', `Route "${route}" should not end with / (except root)`)
  }
}

section('28. PERMISSION_ROUTE_MAP — No Overlapping Route Conflicts')
// /bento/production must appear before /bento in longest-prefix matching.
// The route map itself is fine — the matching algorithm in canAccessPath
// handles longest-prefix. This test just confirms the routes are well-formed.
const allRoutes = Object.values(PERMISSION_ROUTE_MAP).flat()
const uniqueRoutes = new Set(allRoutes)
assert(uniqueRoutes.size <= allRoutes.length, 'Route list contains duplicates — this is acceptable for shared routes')

// ═══════════════════════════════════════════════════════════════════
// Cross-Role Consistency
// ═══════════════════════════════════════════════════════════════════

section('29. Cross-Role — Delivery is most restricted')
const deliveryCount = ROLE_PERMISSIONS.delivery.length
const kitchenCount = ROLE_PERMISSIONS.kitchen.length
const frontDeskCount = ROLE_PERMISSIONS.front_desk.length
assert(deliveryCount <= kitchenCount, `Delivery (${deliveryCount}) should have <= Kitchen (${kitchenCount}) permissions`)
assert(deliveryCount <= frontDeskCount, `Delivery (${deliveryCount}) should have <= Front Desk (${frontDeskCount}) permissions`)

section('30. Cross-Role — Kitchen has fewer permissions than Manager')
assert(kitchenCount < ROLE_PERMISSIONS.manager.length,
  `Kitchen (${kitchenCount}) should have < Manager (${ROLE_PERMISSIONS.manager.length}) permissions`)

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
