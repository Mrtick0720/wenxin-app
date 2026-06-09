// ── Permission-to-Route Mapping ──
// Maps each permission to the route prefixes it grants access to.
// Used by proxy.ts for route-level enforcement in Phase 0.5+.
// Phase 0: defined but not yet imported anywhere. Activated in Phase 0.5.

import { PERMISSION, type PermissionKey } from './permissionKeys'

export const PERMISSION_ROUTE_MAP: Partial<Record<PermissionKey, string[]>> = {
  // ── Home ──
  [PERMISSION.VIEW_HOME]:           ['/'],
  [PERMISSION.VIEW_HOME_REVENUE]:   ['/'],  // controls revenue widget visibility
  [PERMISSION.VIEW_HOME_ALERTS]:    ['/'],  // controls alert cards visibility

  // ── Bento ──
  [PERMISSION.VIEW_BENTO]:           ['/bento'],
  [PERMISSION.VIEW_BENTO_PRODUCTION]: ['/bento/production'],
  [PERMISSION.VIEW_BENTO_CUSTOMERS]:  ['/bento/customers'],
  [PERMISSION.VIEW_BENTO_WEEKLY_MENU]:['/bento/weekly-menu'],
  [PERMISSION.VIEW_BENTO_PAYMENTS]:   ['/bento/unpaid'],
  [PERMISSION.EDIT_BENTO_ORDERS]:     ['/bento/new'],

  // ── Purchase ──
  [PERMISSION.VIEW_PURCHASE]:       ['/purchase'],
  [PERMISSION.EDIT_PURCHASE]:       ['/purchase'],

  // ── Inventory ──
  [PERMISSION.VIEW_INVENTORY]:      ['/inventory'],

  // ── Finance ──
  [PERMISSION.VIEW_FINANCE]:        ['/finance'],

  // ── Reports ──
  [PERMISSION.VIEW_REPORTS]:        ['/reports'],

  // ── Dine-in ──
  [PERMISSION.VIEW_DINE_IN]:        ['/dine-in'],

  // ── Reservations ──
  [PERMISSION.VIEW_RESERVATIONS]:   ['/reservations'],

  // ── Complaints ──
  [PERMISSION.VIEW_COMPLAINTS]:     ['/complaints'],

  // ── Incidents ──
  [PERMISSION.VIEW_INCIDENTS]:      ['/incidents'],

  // ── Tasks ──
  [PERMISSION.VIEW_TASKS]:          ['/tasks'],

  // ── Staff ──
  [PERMISSION.VIEW_STAFF_SCHEDULE]:   ['/staff'],
  [PERMISSION.MANAGE_STAFF_ACCOUNTS]: ['/staff/accounts'],
  [PERMISSION.VIEW_ACTIVITY_LOG]:     ['/staff/activity'],

  // ── Attendance ──
  [PERMISSION.VIEW_ATTENDANCE_SELF]:  ['/attendance'],
  [PERMISSION.VIEW_ATTENDANCE_ALL]:   ['/attendance'],

  // ── Checklist ──
  [PERMISSION.VIEW_CHECKLIST_SELF]:   ['/checklist'],
  [PERMISSION.VIEW_CHECKLIST_ALL]:    ['/checklist'],
  [PERMISSION.MANAGE_CHECKLIST_TEMPLATES]: ['/checklist/templates'],

  // ── Suppliers ──
  [PERMISSION.VIEW_SUPPLIERS]:      ['/suppliers'],

  // ── Assets ──
  [PERMISSION.VIEW_ASSETS]:         ['/assets'],

  // ── Cashier ──
  [PERMISSION.VIEW_CASHIER]:        ['/cashier'],

  // ── Profile ──
  [PERMISSION.VIEW_PROFILE]:        ['/profile'],
}
