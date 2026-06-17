// ── Purchase Ledger Permissions ──
// Pure functions. No Supabase, no side effects. Reuses the existing permission
// layer (rolePermissions) for cost/delete/export, and encodes the role-based
// history windows the spec requires.

import { hasPermission } from '@/lib/auth/permissionCheck'
import { PERMISSION } from '@/lib/auth/permissionKeys'
import type { StaffRole } from '@/lib/auth/types'

/** Can this role see unit price, total price and supplier? (Owner, Manager) */
export function canViewPurchaseCosts(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.VIEW_PURCHASE_COSTS)
}

/** Can this role add / edit purchase records? (Owner, Manager, Kitchen) */
export function canAddPurchase(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.EDIT_PURCHASE)
}

/** Can this role delete records? (Owner only) */
export function canDeletePurchase(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.DELETE_PURCHASE)
}

/** Can this role export the ledger? (Owner only) */
export function canExportPurchase(role: StaffRole): boolean {
  return hasPermission(role, PERMISSION.EXPORT_PURCHASE)
}

/** Only the Owner sees a month total in the dashboard. */
export function canViewMonthTotal(role: StaffRole): boolean {
  return role === 'owner'
}

/**
 * History window, in number of days visible (inclusive, counting today).
 * Owner: null = all history · Manager: 7 days · Kitchen: today only (1).
 */
export function historyWindowDays(role: StaffRole): number | null {
  if (role === 'owner') return null
  if (role === 'manager') return 7
  return 1
}

/**
 * Whether `role` may edit a specific record.
 * Owner/Manager: any record in their window. Kitchen: only records they
 * created, dated today.
 */
export function canEditRecord(
  role: StaffRole,
  record: { created_by: string | null; date: string },
  staffUserId: string,
  today: string,
): boolean {
  if (role === 'owner' || role === 'manager') return true
  if (role === 'kitchen') {
    return record.created_by === staffUserId && record.date === today
  }
  return false
}

/** Columns whose presence would leak procurement cost to staff. */
const COST_KEYS = [
  'unit_price',
  'total_price',
  'supplier',
  'actual_unit_price',
  'actual_total_price',
] as const

/**
 * Belt-and-suspenders: strip cost keys from a record for roles that may not
 * view costs. The repository already avoids selecting these columns for staff;
 * this guards against accidental leakage if a full row is passed through.
 */
export function sanitizeRecordForRole<T extends Record<string, unknown>>(
  role: StaffRole,
  record: T,
): T {
  if (canViewPurchaseCosts(role)) return record
  const copy = { ...record }
  for (const key of COST_KEYS) delete copy[key]
  return copy
}
