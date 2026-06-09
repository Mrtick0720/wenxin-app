// ── Permission Check Functions ──
// Pure functions for permission checking. No side effects, no database calls.
// This is the single source of truth for all permission decisions.
// Phase 0: defined but not yet imported anywhere. Activated in Phase 0.5.

import type { StaffRole } from './types'
import type { PermissionKey } from './permissionKeys'
import { ROLE_PERMISSIONS } from './rolePermissions'

/**
 * Check if a role has a specific permission.
 * Returns false for unknown roles or unknown permissions.
 */
export function hasPermission(role: StaffRole, permission: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

/**
 * Check if a role has ALL of the specified permissions.
 */
export function hasAllPermissions(role: StaffRole, permissions: PermissionKey[]): boolean {
  return permissions.every(p => hasPermission(role, p))
}

/**
 * Check if a role has ANY of the specified permissions.
 */
export function hasAnyPermission(role: StaffRole, permissions: PermissionKey[]): boolean {
  return permissions.some(p => hasPermission(role, p))
}

/**
 * Get all permissions for a role. Useful for debugging and auditing.
 * Returns an empty array for unknown roles.
 */
export function getPermissionsForRole(role: StaffRole): PermissionKey[] {
  return ROLE_PERMISSIONS[role] ?? []
}
