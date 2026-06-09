// ── Permission Key Constants ──
// Every grantable ability is a string constant with a colon-delimited namespace.
// These are the single source of truth for all permission decisions.
// Phase 0: defined but not yet imported anywhere. Activated in Phase 0.5.

export const PERMISSION = {
  // ── Module: Home ──
  VIEW_HOME:               'home:view',
  VIEW_HOME_REVENUE:        'home:view_revenue',
  VIEW_HOME_ALERTS:         'home:view_alerts',

  // ── Module: Bento ──
  VIEW_BENTO:               'bento:view',
  VIEW_BENTO_ORDERS:        'bento:orders:view',
  EDIT_BENTO_ORDERS:        'bento:orders:edit',
  VIEW_BENTO_CUSTOMERS:     'bento:customers:view',
  EDIT_BENTO_CUSTOMERS:     'bento:customers:edit',
  VIEW_BENTO_PAYMENTS:      'bento:payments:view',
  EDIT_BENTO_PAYMENTS:      'bento:payments:edit',
  VIEW_BENTO_PRODUCTION:    'bento:production:view',
  VIEW_BENTO_WEEKLY_MENU:   'bento:weekly_menu:view',
  EDIT_BENTO_WEEKLY_MENU:   'bento:weekly_menu:edit',

  // ── Module: Purchase ──
  VIEW_PURCHASE:            'purchase:view',
  EDIT_PURCHASE:            'purchase:edit',
  APPROVE_PURCHASE:         'purchase:approve',

  // ── Module: Inventory ──
  VIEW_INVENTORY:           'inventory:view',
  EDIT_INVENTORY:           'inventory:edit',

  // ── Module: Finance ──
  VIEW_FINANCE:             'finance:view',
  EDIT_FINANCE:             'finance:edit',

  // ── Module: Reports ──
  VIEW_REPORTS:             'reports:view',

  // ── Module: Dine-in ──
  VIEW_DINE_IN:             'dine_in:view',
  EDIT_DINE_IN:             'dine_in:edit',

  // ── Module: Reservations ──
  VIEW_RESERVATIONS:        'reservations:view',
  EDIT_RESERVATIONS:        'reservations:edit',

  // ── Module: Complaints ──
  VIEW_COMPLAINTS:          'complaints:view',
  EDIT_COMPLAINTS:          'complaints:edit',

  // ── Module: Incidents ──
  VIEW_INCIDENTS:           'incidents:view',
  EDIT_INCIDENTS:           'incidents:edit',

  // ── Module: Tasks ──
  VIEW_TASKS:               'tasks:view',
  EDIT_TASKS:               'tasks:edit',

  // ── Module: Staff ──
  VIEW_STAFF_SCHEDULE:      'staff:schedule:view',
  EDIT_STAFF_SCHEDULE:      'staff:schedule:edit',
  MANAGE_STAFF_ACCOUNTS:    'staff:accounts:manage',
  VIEW_ACTIVITY_LOG:        'staff:activity:view',

  // ── Module: Attendance ──
  VIEW_ATTENDANCE_SELF:     'attendance:self:view',
  VIEW_ATTENDANCE_ALL:      'attendance:all:view',
  EDIT_ATTENDANCE_SELF:     'attendance:self:edit',
  EDIT_ATTENDANCE_ALL:      'attendance:all:edit',

  // ── Module: Checklist ──
  VIEW_CHECKLIST_SELF:      'checklist:self:view',
  VIEW_CHECKLIST_ALL:       'checklist:all:view',
  EDIT_CHECKLIST_SELF:      'checklist:self:edit',
  VERIFY_CHECKLIST:         'checklist:verify',
  MANAGE_CHECKLIST_TEMPLATES:'checklist:templates:manage',

  // ── Module: Suppliers ──
  VIEW_SUPPLIERS:           'suppliers:view',
  EDIT_SUPPLIERS:           'suppliers:edit',

  // ── Module: Assets ──
  VIEW_ASSETS:              'assets:view',
  EDIT_ASSETS:              'assets:edit',

  // ── Module: Cashier ──
  VIEW_CASHIER:             'cashier:view',
  OPERATE_CASHIER:          'cashier:operate',
  CLOSE_CASHIER_SHIFT:      'cashier:close_shift',

  // ── Module: Profile ──
  VIEW_PROFILE:             'profile:view',
  EDIT_PROFILE:             'profile:edit',

  // ── Sensitive Data ──
  VIEW_CUSTOMER_PII:        'sensitive:customer_pii:view',
  VIEW_FINANCIAL_DATA:      'sensitive:financial_data:view',
  VIEW_STAFF_PII:           'sensitive:staff_pii:view',

  // ── Administrative ──
  MANAGE_RESTAURANT_SETTINGS:'admin:settings:manage',
  MANAGE_ROLES:             'admin:roles:manage',
  EXPORT_DATA:              'admin:export',
} as const

export type PermissionKey = (typeof PERMISSION)[keyof typeof PERMISSION]
