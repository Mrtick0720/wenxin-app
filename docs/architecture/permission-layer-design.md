# Wenxin Permission Layer — Architecture Design

**Date:** 2026-06-08
**Status:** Draft, pending review
**Depends on:** Staff Authentication (approved, implemented), all approved module specs

---

## A. Current State Review

### A.1 How Permissions Work Today

The current system uses **role-based access control (RBAC)** with four hardcoded roles:

```typescript
// lib/auth/types.ts
export const STAFF_ROLES = ['owner', 'manager', 'kitchen', 'front_desk'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]
```

Permission enforcement happens in five layers:

| Layer | Location | Mechanism | Example |
|-------|----------|-----------|---------|
| **1. Proxy** | `proxy.ts` | `getAuthRedirect()` → `canAccessPath()` | Redirects unauthorized routes to `/access-denied` |
| **2. Server Components** | `lib/auth/currentStaff.ts` | `requireRole('owner')` | Throws redirect if role doesn't match |
| **3. Server Actions** | Various `actions.ts` | `requireRole('owner')` | Returns error or throws if role doesn't match |
| **4. Client Rendering** | `app/page.tsx`, etc. | `canAccessPath(role, path)` | Conditionally renders UI elements |
| **5. Database RLS** | Supabase migrations | `staff_role_is(array[...])` | Blocks unauthorized reads/writes at DB level |

### A.2 The Current `ROUTE_RULES` Array

```typescript
const ROUTE_RULES: RouteRule[] = [
  { prefix: '/staff/accounts', roles: { owner: true } },
  { prefix: '/staff/activity', roles: { owner: true } },
  { prefix: '/bento/production', roles: { owner: true, manager: true, kitchen: true } },
  { prefix: '/bento/customers', roles: { owner: true, manager: true, front_desk: true } },
  // ... 20 more rules
]
```

This is a **flat list of URL prefixes mapped to role bitmasks**. The matching algorithm is longest-prefix first. Each new module adds one line to this array.

### A.3 Permission Checks Across the Codebase

```
lib/auth/permissions.ts       — canAccessPath(), getHomeVisibility(), getNavigationItems()
lib/auth/currentStaff.ts      — requireRole(), requireCurrentStaff(), getCurrentStaff()
proxy.ts                      — getAuthRedirect() → canAccessPath()
app/page.tsx                  — 11 calls to canAccessPath(), 1 call to getHomeVisibility()
app/purchase/page.tsx         — requireRole('owner', 'manager', 'kitchen')
app/bento/customers/page.tsx  — requireRole('owner', 'manager', 'front_desk')
app/incidents/page.tsx        — requireRole('owner', 'manager', 'front_desk')
app/tasks/page.tsx            — requireCurrentStaff() (all roles)
app/staff/accounts/actions.ts — requireRole('owner') (6 calls)
app/staff/accounts/page.tsx   — requireRole('owner')
app/staff/activity/page.tsx   — requireRole('owner')
```

### A.4 How "Limited" Access Is Implemented

Kitchen's "limited" Bento access is the only case where a role has partial access to a module. It is implemented through **architectural workarounds**, not through the permission system:

| Mechanism | Purpose |
|-----------|---------|
| `bento_kitchen_orders` view | Strips financial fields (amount, paid) from `bento_orders` |
| `set_bento_order_status()` RPC | Kitchen can only update fulfillment status, not customer/payment data |
| Client-side role checks in `BentoClient.tsx` | `isKitchen` flag hides Unpaid, Customers, New Order links |
| `BentoStack` wrapper in `stackRoutes.tsx` | Passes `role` prop to `BentoClient` |

This is a **workaround pattern**, not a reusable permission primitive. Each new "limited access" scenario would need its own view, RPC, and client-side flags.

### A.5 Identified Limitations

| # | Limitation | Impact |
|---|-----------|--------|
| 1 | **No action-level permissions** | Can't express "Kitchen can VIEW bento customers but not EDIT them" without custom views/RPCs |
| 2 | **No field-level permissions** | Can't express "Front Desk can see customer name but not phone number" |
| 3 | **Role strings are scattered** | `'owner'` appears 37 times across the codebase in hardcoded string literals |
| 4 | **No role hierarchy or inheritance** | Every module must list every role explicitly |
| 5 | **Adding a role requires touching every file** | A new `delivery` role would need updates to `ROUTE_RULES`, `BOTTOM_NAV_ITEMS`, `getHomeVisibility`, every `requireRole()` call, and every RLS policy |
| 6 | **No outlet scoping** | Permissions are global — a Manager can see all outlets, no way to restrict to their assigned outlet |
| 7 | **Client-side checks are purely UI sugar** | `canAccessPath()` on the client only hides links — the real enforcement is in proxy/server/RLS |
| 8 | **`getHomeVisibility` is hardcoded logic** | `role === 'owner' || role === 'manager'` is not a permission — it's an identity check |
| 9 | **No permission audit trail** | You can't answer "who has access to Finance?" without reading code |
| 10 | **No Delivery role exists** | The approved module specs reference a `delivery` role, but the system only supports four roles |

### A.6 Technical Debt Summary

| Debt | Severity | Fix Complexity |
|------|----------|---------------|
| Hardcoded role strings everywhere | Medium | Low — extract constants |
| Flat ROUTE_RULES with no hierarchy | Medium | Medium — permission-to-route mapping |
| Kitchen "limited" access via views/RPCs | High | High — needs field-level permissions |
| No role-permission abstraction layer | High | High — needs new permission model |
| getHomeVisibility role identity checks | Low | Low — convert to permission checks |

---

## B. Permission Layer Architecture

### B.1 Design Principles

1. **Backward compatible.** All existing behavior is preserved. No route breaks. No RLS breaks.
2. **Permission-based, not role-based.** Roles become collections of permissions. Code checks permissions, not roles.
3. **Centralized definition.** All permissions are defined in one file. Roles and their permission assignments are defined in one place.
4. **Layered enforcement.** Permissions are checked at proxy, server, server-action, client-UI, and database levels.
5. **Migrate incrementally.** Three-phase migration. Existing role checks continue to work during transition.
6. **Future-ready.** Supports new roles (delivery), multi-outlet scoping, and module-level permission granularity without redesign.

### B.2 Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  PERMISSION LAYER                │
│                                                  │
│  ┌──────────┐    ┌──────────┐    ┌────────────┐ │
│  │  Roles   │───▶│Permission│───▶│  Access     │ │
│  │          │    │  Keys    │    │  Decisions  │ │
│  │ owner    │    │VIEW_BENTO│    │             │ │
│  │ manager  │    │EDIT_BENTO│    │ Proxy       │ │
│  │ kitchen  │    │VIEW_FIN  │    │ Server      │ │
│  │ front_   │    │APPROVE_  │    │ Client UI   │ │
│  │ desk     │    │  PURCHASE│    │ Database    │ │
│  │ delivery │    │ ...      │    │             │ │
│  └──────────┘    └──────────┘    └────────────┘ │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │            ENFORCEMENT LAYERS                │ │
│  │                                              │ │
│  │  Layer 1: proxy.ts — route access            │ │
│  │  Layer 2: requirePermission() — server check  │ │
│  │  Layer 3: hasPermission() — client guard      │ │
│  │  Layer 4: RLS policies — database guard       │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### B.3 Core Data Structures

#### Permission Key (String Enum)

Every grantable ability is a string constant:

```typescript
// lib/auth/permissionKeys.ts

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
  VIEW_STAFF_PII:          'sensitive:staff_pii:view',

  // ── Administrative ──
  MANAGE_RESTAURANT_SETTINGS:'admin:settings:manage',
  MANAGE_ROLES:             'admin:roles:manage',
  EXPORT_DATA:              'admin:export',
} as const

export type PermissionKey = (typeof PERMISSION)[keyof typeof PERMISSION]
```

#### Role Definition (Collection of Permissions)

```typescript
// lib/auth/rolePermissions.ts

import { PERMISSION, type PermissionKey } from './permissionKeys'
import type { StaffRole } from './types'

type RolePermissions = Record<StaffRole, PermissionKey[]>

export const ROLE_PERMISSIONS: RolePermissions = {
  owner: [
    // Owner has all permissions
    ...Object.values(PERMISSION),
  ],

  manager: [
    // Home
    PERMISSION.VIEW_HOME,
    PERMISSION.VIEW_HOME_REVENUE,
    PERMISSION.VIEW_HOME_ALERTS,

    // Bento — full access
    PERMISSION.VIEW_BENTO,
    PERMISSION.VIEW_BENTO_ORDERS,
    PERMISSION.EDIT_BENTO_ORDERS,
    PERMISSION.VIEW_BENTO_CUSTOMERS,
    PERMISSION.EDIT_BENTO_CUSTOMERS,
    PERMISSION.VIEW_BENTO_PAYMENTS,
    PERMISSION.EDIT_BENTO_PAYMENTS,
    PERMISSION.VIEW_BENTO_PRODUCTION,
    PERMISSION.VIEW_BENTO_WEEKLY_MENU,
    PERMISSION.EDIT_BENTO_WEEKLY_MENU,

    // Purchase
    PERMISSION.VIEW_PURCHASE,
    PERMISSION.EDIT_PURCHASE,
    PERMISSION.APPROVE_PURCHASE,

    // Inventory
    PERMISSION.VIEW_INVENTORY,
    PERMISSION.EDIT_INVENTORY,

    // Reports
    PERMISSION.VIEW_REPORTS,

    // Dine-in
    PERMISSION.VIEW_DINE_IN,
    PERMISSION.EDIT_DINE_IN,

    // Reservations
    PERMISSION.VIEW_RESERVATIONS,
    PERMISSION.EDIT_RESERVATIONS,

    // Complaints
    PERMISSION.VIEW_COMPLAINTS,
    PERMISSION.EDIT_COMPLAINTS,

    // Incidents
    PERMISSION.VIEW_INCIDENTS,
    PERMISSION.EDIT_INCIDENTS,

    // Tasks
    PERMISSION.VIEW_TASKS,
    PERMISSION.EDIT_TASKS,

    // Staff
    PERMISSION.VIEW_STAFF_SCHEDULE,
    PERMISSION.EDIT_STAFF_SCHEDULE,
    // Manager does NOT have MANAGE_STAFF_ACCOUNTS or VIEW_ACTIVITY_LOG

    // Attendance
    PERMISSION.VIEW_ATTENDANCE_SELF,
    PERMISSION.VIEW_ATTENDANCE_ALL,
    PERMISSION.EDIT_ATTENDANCE_SELF,
    PERMISSION.EDIT_ATTENDANCE_ALL,

    // Checklist
    PERMISSION.VIEW_CHECKLIST_SELF,
    PERMISSION.VIEW_CHECKLIST_ALL,
    PERMISSION.EDIT_CHECKLIST_SELF,
    PERMISSION.VERIFY_CHECKLIST,
    PERMISSION.MANAGE_CHECKLIST_TEMPLATES,

    // Suppliers
    PERMISSION.VIEW_SUPPLIERS,
    PERMISSION.EDIT_SUPPLIERS,

    // Assets
    PERMISSION.VIEW_ASSETS,
    PERMISSION.EDIT_ASSETS,

    // Cashier
    PERMISSION.VIEW_CASHIER,
    PERMISSION.OPERATE_CASHIER,
    PERMISSION.CLOSE_CASHIER_SHIFT,

    // Profile
    PERMISSION.VIEW_PROFILE,
    PERMISSION.EDIT_PROFILE,

    // Sensitive
    PERMISSION.VIEW_CUSTOMER_PII,
    PERMISSION.VIEW_FINANCIAL_DATA,
    PERMISSION.VIEW_STAFF_PII,
  ],

  kitchen: [
    // Home (no revenue)
    PERMISSION.VIEW_HOME,
    PERMISSION.VIEW_HOME_ALERTS,

    // Bento — limited
    PERMISSION.VIEW_BENTO,
    PERMISSION.VIEW_BENTO_ORDERS,
    PERMISSION.VIEW_BENTO_PRODUCTION,
    PERMISSION.VIEW_BENTO_WEEKLY_MENU,
    // No EDIT_BENTO_ORDERS (uses set_bento_order_status RPC instead)
    // No VIEW_BENTO_CUSTOMERS, EDIT_BENTO_CUSTOMERS
    // No VIEW_BENTO_PAYMENTS, EDIT_BENTO_PAYMENTS

    // Purchase
    PERMISSION.VIEW_PURCHASE,
    PERMISSION.EDIT_PURCHASE,

    // Inventory
    PERMISSION.VIEW_INVENTORY,
    PERMISSION.EDIT_INVENTORY,

    // Tasks
    PERMISSION.VIEW_TASKS,
    PERMISSION.EDIT_TASKS,

    // Attendance — self only
    PERMISSION.VIEW_ATTENDANCE_SELF,
    PERMISSION.EDIT_ATTENDANCE_SELF,

    // Checklist — self only
    PERMISSION.VIEW_CHECKLIST_SELF,
    PERMISSION.EDIT_CHECKLIST_SELF,

    // Suppliers — view only
    PERMISSION.VIEW_SUPPLIERS,

    // Assets — view only
    PERMISSION.VIEW_ASSETS,

    // Profile
    PERMISSION.VIEW_PROFILE,
    PERMISSION.EDIT_PROFILE,
  ],

  front_desk: [
    // Home (no revenue)
    PERMISSION.VIEW_HOME,
    PERMISSION.VIEW_HOME_ALERTS,

    // Bento — limited
    PERMISSION.VIEW_BENTO,
    PERMISSION.VIEW_BENTO_ORDERS,
    PERMISSION.EDIT_BENTO_ORDERS,
    PERMISSION.VIEW_BENTO_CUSTOMERS,
    PERMISSION.EDIT_BENTO_CUSTOMERS,
    PERMISSION.VIEW_BENTO_PAYMENTS,
    PERMISSION.EDIT_BENTO_PAYMENTS,
    PERMISSION.VIEW_BENTO_WEEKLY_MENU,
    // No VIEW_BENTO_PRODUCTION

    // Dine-in
    PERMISSION.VIEW_DINE_IN,
    PERMISSION.EDIT_DINE_IN,

    // Reservations
    PERMISSION.VIEW_RESERVATIONS,
    PERMISSION.EDIT_RESERVATIONS,

    // Complaints
    PERMISSION.VIEW_COMPLAINTS,
    PERMISSION.EDIT_COMPLAINTS,

    // Incidents
    PERMISSION.VIEW_INCIDENTS,
    PERMISSION.EDIT_INCIDENTS,

    // Tasks
    PERMISSION.VIEW_TASKS,
    PERMISSION.EDIT_TASKS,

    // Attendance — self only
    PERMISSION.VIEW_ATTENDANCE_SELF,
    PERMISSION.EDIT_ATTENDANCE_SELF,

    // Checklist — self only (front desk checklists like Cash Closing)
    PERMISSION.VIEW_CHECKLIST_SELF,
    PERMISSION.EDIT_CHECKLIST_SELF,

    // Assets — view only
    PERMISSION.VIEW_ASSETS,

    // Cashier
    PERMISSION.VIEW_CASHIER,
    PERMISSION.OPERATE_CASHIER,

    // Profile
    PERMISSION.VIEW_PROFILE,
    PERMISSION.EDIT_PROFILE,

    // Sensitive
    PERMISSION.VIEW_CUSTOMER_PII,
  ],

  // Future role — permissions defined but role not yet in STAFF_ROLES
  delivery: [
    PERMISSION.VIEW_HOME,
    PERMISSION.VIEW_HOME_ALERTS,
    PERMISSION.VIEW_BENTO,
    PERMISSION.VIEW_BENTO_ORDERS,
    PERMISSION.VIEW_TASKS,
    PERMISSION.VIEW_ATTENDANCE_SELF,
    PERMISSION.EDIT_ATTENDANCE_SELF,
    PERMISSION.VIEW_PROFILE,
    PERMISSION.EDIT_PROFILE,
  ],
}
```

### B.4 Core Permission Functions

```typescript
// lib/auth/permissionCheck.ts

import type { StaffRole } from './types'
import type { PermissionKey } from './permissionKeys'
import { ROLE_PERMISSIONS } from './rolePermissions'

/**
 * Check if a role has a specific permission.
 * This is the single source of truth for all permission decisions.
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
 * Map a permission key to the route prefixes it grants access to.
 * Used by proxy.ts for route-level enforcement.
 */
export function getRoutesForPermission(permission: PermissionKey): string[] {
  return PERMISSION_ROUTE_MAP[permission] ?? []
}

/**
 * Get all permissions for a role. Useful for debugging and auditing.
 */
export function getPermissionsForRole(role: StaffRole): PermissionKey[] {
  return ROLE_PERMISSIONS[role] ?? []
}
```

### B.5 Permission-to-Route Mapping

Each permission maps to one or more route prefixes. This replaces the flat `ROUTE_RULES` array:

```typescript
// lib/auth/permissionRouteMap.ts

import { PERMISSION, type PermissionKey } from './permissionKeys'

export const PERMISSION_ROUTE_MAP: Partial<Record<PermissionKey, string[]>> = {
  // ── Home ──
  [PERMISSION.VIEW_HOME]:           ['/'],
  [PERMISSION.VIEW_HOME_REVENUE]:   ['/'],  // controls revenue widget visibility
  [PERMISSION.VIEW_HOME_ALERTS]:    ['/'],  // controls alert cards visibility

  // ── Bento ──
  [PERMISSION.VIEW_BENTO]:          ['/bento'],
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
```

**How `canAccessPath` changes:**

```typescript
// Before (Phase 0):
export function canAccessPath(role: StaffRole, pathname: string) {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/'
  const rule = ROUTE_RULES.find(candidate =>
    candidate.exact
      ? path === candidate.prefix
      : path === candidate.prefix || path.startsWith(`${candidate.prefix}/`)
  )
  return rule?.roles[role] === true
}

// After (Phase 2):
export function canAccessPath(role: StaffRole, pathname: string) {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/'

  // Find which permission is needed for this path
  for (const [permission, routes] of Object.entries(PERMISSION_ROUTE_MAP)) {
    if (!routes) continue
    const matched = routes.some(routePrefix =>
      path === routePrefix || path.startsWith(`${routePrefix}/`)
    )
    if (matched) {
      return hasPermission(role, permission as PermissionKey)
    }
  }

  // If no permission maps to this path, default to deny
  // (public routes like /login are handled before this function is called)
  return false
}
```

### B.6 `requirePermission()` — Server-Side Enforcement

A new server-side function replaces `requireRole()` for permission-based checks:

```typescript
// lib/auth/currentStaff.ts (addition)

import { hasPermission } from './permissionCheck'
import type { PermissionKey } from './permissionKeys'

export async function requirePermission(permission: PermissionKey) {
  const staff = await requireCurrentStaff()
  if (!hasPermission(staff.role, permission)) {
    redirect('/access-denied')
  }
  return staff
}

export async function requireAnyPermission(...permissions: PermissionKey[]) {
  const staff = await requireCurrentStaff()
  const allowed = permissions.some(p => hasPermission(staff.role, p))
  if (!allowed) {
    redirect('/access-denied')
  }
  return staff
}

// requireRole() is preserved as a backward-compatible wrapper:
export async function requireRole(...roles: StaffRole[]) {
  const staff = await requireCurrentStaff()
  if (!roles.includes(staff.role)) {
    redirect('/access-denied')
  }
  return staff
}
```

### B.7 `usePermission()` — Client-Side Hook

```typescript
// app/components/StaffProvider.tsx (addition)

import { hasPermission } from '@/lib/auth/permissionCheck'
import type { PermissionKey } from '@/lib/auth/permissionKeys'

export function usePermission() {
  const staff = useStaff()

  return {
    can: (permission: PermissionKey): boolean => {
      if (!staff) return false
      return hasPermission(staff.role, permission)
    },
    canAll: (...permissions: PermissionKey[]): boolean => {
      if (!staff) return false
      return permissions.every(p => hasPermission(staff.role, p))
    },
    canAny: (...permissions: PermissionKey[]): boolean => {
      if (!staff) return false
      return permissions.some(p => hasPermission(staff.role, p))
    },
  }
}
```

**Usage in client components:**

```typescript
// Before:
{canAccessPath(staff.role, '/finance') && <NavLink href="/finance" ... />}

// After:
const { can } = usePermission()
{can(PERMISSION.VIEW_FINANCE) && <NavLink href="/finance" ... />}
```

### B.8 BottomNav Permission Mapping

```typescript
// Replaces the hardcoded BOTTOM_NAV_ITEMS array
const BOTTOM_NAV_ITEMS: Array<NavigationItem & { permission: PermissionKey }> = [
  { href: '/',         label: 'Home',      permission: PERMISSION.VIEW_HOME },
  { href: '/tasks',    label: 'Approvals',  permission: PERMISSION.VIEW_TASKS },
  { href: '/staff',    label: 'Schedule',   permission: PERMISSION.VIEW_STAFF_SCHEDULE },
  { href: '/purchase', label: 'Purchase',   permission: PERMISSION.VIEW_PURCHASE },
  { href: '/profile',  label: 'Me',         permission: PERMISSION.VIEW_PROFILE },
]

export function getNavigationItems(role: StaffRole): NavigationItem[] {
  return BOTTOM_NAV_ITEMS
    .filter(item => hasPermission(role, item.permission))
    .map(({ href, label }) => ({ href, label }))
}
```

### B.9 Home Dashboard Visibility

```typescript
// Before:
export function getHomeVisibility(role: StaffRole) {
  const seesBusinessTotals = role === 'owner' || role === 'manager'
  return {
    revenue: seesBusinessTotals,
    reports: seesBusinessTotals,
    finance: role === 'owner',
    operationalAlerts: true,
  }
}

// After:
export function getHomeVisibility(role: StaffRole) {
  return {
    revenue: hasPermission(role, PERMISSION.VIEW_HOME_REVENUE),
    reports: hasPermission(role, PERMISSION.VIEW_REPORTS),
    finance: hasPermission(role, PERMISSION.VIEW_FINANCE),
    operationalAlerts: hasPermission(role, PERMISSION.VIEW_HOME_ALERTS),
  }
}
```

---

## C. Permission Naming Standard

### C.1 Convention

```
<ACTION>_<MODULE>[_<SUB_RESOURCE>]

Examples:
  VIEW_BENTO
  EDIT_BENTO_ORDERS
  VIEW_ATTENDANCE_ALL
  MANAGE_STAFF_ACCOUNTS
  VIEW_CUSTOMER_PII
```

### C.2 Action Prefixes

| Prefix | Meaning | Example |
|--------|---------|---------|
| `VIEW_` | Read access to a module or resource | `VIEW_INVENTORY` |
| `EDIT_` | Create, update, or modify a resource | `EDIT_PURCHASE` |
| `DELETE_` | Hard delete a resource | `DELETE_SUPPLIER` |
| `APPROVE_` | Approve a workflow step | `APPROVE_PURCHASE` |
| `VERIFY_` | Verify/validate a completed item | `VERIFY_CHECKLIST` |
| `MANAGE_` | Administrative control over a resource | `MANAGE_STAFF_ACCOUNTS` |
| `OPERATE_` | Perform operational actions | `OPERATE_CASHIER` |
| `CLOSE_` | Finalize or close a workflow | `CLOSE_CASHIER_SHIFT` |
| `EXPORT_` | Export data from the system | `EXPORT_DATA` |

### C.3 Module Namespace

Permissions use a colon-delimited namespace for hierarchy:

```
module:sub_resource:action

Examples:
  bento:orders:view
  checklist:templates:manage
  staff:accounts:manage
  sensitive:customer_pii:view
  admin:settings:manage
```

The constant name uses underscores; the string value uses colons. This allows future tooling to parse the hierarchy:

```typescript
PERMISSION.VIEW_BENTO_ORDERS    // constant
'bento:orders:view'             // string value
```

### C.4 Sensitive Data Permissions

Permissions controlling access to personally identifiable information (PII) or financial data use the `sensitive:` namespace:

```
sensitive:customer_pii:view     — Customer names, phone numbers, addresses
sensitive:financial_data:view   — Revenue, profit, cost data
sensitive:staff_pii:view        — Staff phone numbers, emails, addresses
```

These are separate from module permissions. A role can have `VIEW_BENTO` without `VIEW_CUSTOMER_PII` — they see orders but not customer contact details.

### C.5 Self vs. All Distinction

Permissions that differ by scope use `self` or `all`:

```
attendance:self:view     — View own attendance records
attendance:all:view      — View all staff attendance records
checklist:self:view      — View checklists assigned to own role
checklist:all:view       — View all checklists regardless of role
```

---

## D. Permission Categories

### D.1 Category Map

| Category | Description | Example Permission Keys |
|----------|-------------|------------------------|
| **View** | Read-only access to a resource | `VIEW_BENTO`, `VIEW_PURCHASE`, `VIEW_REPORTS` |
| **Edit** | Create, update, modify | `EDIT_PURCHASE`, `EDIT_INVENTORY`, `EDIT_BENTO_ORDERS` |
| **Approve** | Workflow approval authority | `APPROVE_PURCHASE`, `VERIFY_CHECKLIST` |
| **Manage** | Administrative control | `MANAGE_STAFF_ACCOUNTS`, `MANAGE_CHECKLIST_TEMPLATES` |
| **Operate** | Operational workflow actions | `OPERATE_CASHIER`, `CLOSE_CASHIER_SHIFT` |
| **Sensitive Data** | PII and financial data access | `VIEW_CUSTOMER_PII`, `VIEW_FINANCIAL_DATA` |
| **Administrative** | System-level administration | `MANAGE_RESTAURANT_SETTINGS`, `MANAGE_ROLES`, `EXPORT_DATA` |

### D.2 Category Usage Guidelines

- **View** and **Edit** are the most common. Every module has at minimum `VIEW_<MODULE>`.
- **Approve** is used when a second person must sign off (e.g., checklist verification, purchase approval).
- **Manage** implies ownership — the ability to configure, not just operate. Template editing, account management.
- **Operate** is for day-to-day actions that are not "editing a record" — clocking in, closing a cashier shift.
- **Sensitive Data** is always additive — granted in addition to View permissions. A role can view orders without seeing customer phone numbers.
- **Administrative** is Owner-only in most cases.

---

## E. Updated Permission Matrix

### E.1 Full Permission Matrix (Current Modules)

| Permission Key | Owner | Manager | Kitchen | Front Desk | Delivery (Future) |
|---|---:|---:|---:|---:|---:|
| **Home** | | | | | |
| `home:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `home:view_revenue` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `home:view_alerts` | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Bento** | | | | | |
| `bento:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `bento:orders:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `bento:orders:edit` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `bento:customers:view` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `bento:customers:edit` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `bento:payments:view` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `bento:payments:edit` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `bento:production:view` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `bento:weekly_menu:view` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `bento:weekly_menu:edit` | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Purchase** | | | | | |
| `purchase:view` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `purchase:edit` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `purchase:approve` | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Inventory** | | | | | |
| `inventory:view` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `inventory:edit` | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Finance** | | | | | |
| `finance:view` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `finance:edit` | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Reports** | | | | | |
| `reports:view` | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Dine-in** | | | | | |
| `dine_in:view` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `dine_in:edit` | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Reservations** | | | | | |
| `reservations:view` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `reservations:edit` | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Complaints** | | | | | |
| `complaints:view` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `complaints:edit` | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Incidents** | | | | | |
| `incidents:view` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `incidents:edit` | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Tasks** | | | | | |
| `tasks:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `tasks:edit` | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Staff** | | | | | |
| `staff:schedule:view` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `staff:schedule:edit` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `staff:accounts:manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `staff:activity:view` | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Attendance** | | | | | |
| `attendance:self:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `attendance:self:edit` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `attendance:all:view` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `attendance:all:edit` | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Checklist** | | | | | |
| `checklist:self:view` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `checklist:self:edit` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `checklist:all:view` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `checklist:verify` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `checklist:templates:manage` | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Suppliers** | | | | | |
| `suppliers:view` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `suppliers:edit` | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Assets** | | | | | |
| `assets:view` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `assets:edit` | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Cashier** | | | | | |
| `cashier:view` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `cashier:operate` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `cashier:close_shift` | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Profile** | | | | | |
| `profile:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `profile:edit` | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Sensitive Data** | | | | | |
| `sensitive:customer_pii:view` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `sensitive:financial_data:view` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `sensitive:staff_pii:view` | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Administrative** | | | | | |
| `admin:settings:manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `admin:roles:manage` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `admin:export` | ✅ | ✅ | ❌ | ❌ | ❌ |

### E.2 Validation Against Existing Behavior

Each existing route permission maps correctly to the new permission keys. No behavior change:

| Existing `ROUTE_RULES` Entry | Maps To Permission Key |
|------------------------------|------------------------|
| `{ prefix: '/finance', roles: { owner: true } }` | `finance:view` — only owner has it |
| `{ prefix: '/bento/production', roles: { owner: true, manager: true, kitchen: true } }` | `bento:production:view` — owner, manager, kitchen have it |
| `{ prefix: '/tasks', roles: ALL_ROLES }` | `tasks:view` — all roles have it |
| `{ prefix: '/staff/accounts', roles: { owner: true } }` | `staff:accounts:manage` — only owner has it |

All module spec matrices (Attendance §4, Checklist §4.1, Suppliers §4.1, Assets §4.1) are correctly reflected in the permission assignments.

---

## F. Migration Strategy

### F.1 Guiding Principle

**Every existing behavior is preserved at every phase.** No route breaks. No RLS breaks. No access regression.

### F.2 Module Classification

Modules are classified into two groups for migration:

| Group | Modules | Permission System |
|-------|---------|-------------------|
| **New Modules** (not yet in production use) | Cashier, Attendance, Checklist, Suppliers, Assets | Permission-based (new system) |
| **Mature Modules** (operational, in active use) | Bento, Purchase, Inventory, Finance, Reports, Dine-in, Reservations, Complaints, Incidents, Tasks, Staff, Home Dashboard, BottomNav, Profile | Role-based (legacy system) |

**Rationale:** New modules are not yet heavily used and are safer for validating the permission architecture in production. Existing operational modules remain on the legacy route-based access model until the new system is proven.

### F.3 Phase 0 — Extract Constants (Immediate, No Behavior Change)

**Goal:** Stop scattering hardcoded role strings. Create a single source of truth for role definitions.

**Actions:**

1. Create `lib/auth/permissionKeys.ts` with all `PERMISSION` constants.
2. Create `lib/auth/rolePermissions.ts` with `ROLE_PERMISSIONS` mapping.
3. Create `lib/auth/permissionCheck.ts` with `hasPermission()` function.
4. Create `lib/auth/permissionRouteMap.ts` with `PERMISSION_ROUTE_MAP`.
5. Do NOT change any existing code to use these yet. They exist but are unused.
6. Add `delivery` to `STAFF_ROLES` as a future role (no users have this role yet).
7. Create the `ROLE_PERMISSIONS` mapping for delivery with a minimal permission set.

**Verification:**
- All existing tests pass.
- TypeScript compiles.
- `hasPermission('owner', PERMISSION.VIEW_FINANCE)` returns `true`.
- `hasPermission('manager', PERMISSION.VIEW_FINANCE)` returns `false`.
- `delivery` role exists in types but has no users.

**Commit message:** `feat: define permission keys and role-permission mappings`

### F.4 Phase 0.5 — Apply Permission Layer to New Modules (Validated Rollout)

**Goal:** The five new modules (Cashier, Attendance, Checklist, Suppliers, Assets) use `hasPermission()` / `requirePermission()` / `usePermission()` exclusively. Mature modules continue using the legacy role-based system unchanged. This validates the permission architecture in production with low-risk modules before touching operational code.

**Scope — Modules Migrated to Permission-Based Access:**

| Module | Route | Server Auth | Client Guards | RLS |
|--------|-------|-------------|---------------|-----|
| Attendance | `/attendance` | `requirePermission(PERMISSION.VIEW_ATTENDANCE_SELF)` | `usePermission()` | Role-based (unchanged) |
| Checklist | `/checklist` | `requirePermission(PERMISSION.VIEW_CHECKLIST_SELF)` | `usePermission()` | Role-based (unchanged) |
| Suppliers | `/suppliers` | `requirePermission(PERMISSION.VIEW_SUPPLIERS)` | `usePermission()` | Role-based (unchanged) |
| Assets | `/assets` | `requirePermission(PERMISSION.VIEW_ASSETS)` | `usePermission()` | Role-based (unchanged) |
| Cashier | `/cashier` | `requirePermission(PERMISSION.VIEW_CASHIER)` | `usePermission()` | Role-based (unchanged) |

**Scope — Modules Remaining on Legacy Role-Based Access:**

| Module | Route | Access Control |
|--------|-------|---------------|
| Bento (all sub-routes) | `/bento`, `/bento/*` | `ROUTE_RULES` + `requireRole()` |
| Purchase | `/purchase`, `/purchase/*` | `ROUTE_RULES` + `requireRole()` |
| Inventory | `/inventory` | `ROUTE_RULES` + `requireRole()` |
| Finance | `/finance` | `ROUTE_RULES` + `requireRole()` |
| Reports | `/reports` | `ROUTE_RULES` + `requireRole()` |
| Dine-in | `/dine-in` | `ROUTE_RULES` + `requireRole()` |
| Reservations | `/reservations` | `ROUTE_RULES` + `requireRole()` |
| Complaints | `/complaints` | `ROUTE_RULES` + `requireRole()` |
| Incidents | `/incidents` | `ROUTE_RULES` + `requireRole()` |
| Tasks | `/tasks` | `ROUTE_RULES` + `requireRole()` |
| Staff (schedule, accounts, activity) | `/staff`, `/staff/*` | `ROUTE_RULES` + `requireRole()` |
| Home Dashboard | `/` | `ROUTE_RULES` + `canAccessPath()` |
| BottomNav | (navigation) | `BOTTOM_NAV_ITEMS` role map |
| Profile | `/profile` | `requireCurrentStaff()` (no role check) |

**Actions:**

1. New module routes are added to `PERMISSION_ROUTE_MAP` — they are NOT added to the legacy `ROUTE_RULES` array.
2. New module server components use `requirePermission()` instead of `requireRole()`.
3. New module client components use `usePermission()` instead of `canAccessPath(role, path)`.
4. New module server actions use `requirePermission(PERMISSION.EDIT_SUPPLIERS)` instead of `requireRole('owner', 'manager')`.
5. `canAccessPath()` is updated to check both `ROUTE_RULES` (for mature modules) AND `PERMISSION_ROUTE_MAP` (for new modules):
   - If the path matches a `PERMISSION_ROUTE_MAP` entry → use `hasPermission(role, permission)`.
   - If the path matches a `ROUTE_RULES` entry → use the legacy role bitmask.
   - If no match → deny.
6. Home dashboard Quick Access cards for new modules use `usePermission()` for visibility.
7. Mature module code continues to use `canAccessPath()`, `requireRole()`, and `ROUTE_RULES` unchanged.

**Verification:**
- All mature module routes still work exactly as before (ROUTE_RULES unchanged).
- New Attendance route works with `requirePermission(PERMISSION.VIEW_ATTENDANCE_SELF)`.
- New Checklist route works with `requirePermission(PERMISSION.VIEW_CHECKLIST_SELF)`.
- New Suppliers route works with `requirePermission(PERMISSION.VIEW_SUPPLIERS)` — Kitchen can view, Front Desk cannot.
- New Assets route works with `requirePermission(PERMISSION.VIEW_ASSETS)` — all roles can view.
- New Cashier route works with `requirePermission(PERMISSION.VIEW_CASHIER)`.
- `canAccessPath` correctly resolves both legacy ROUTE_RULES and new PERMISSION_ROUTE_MAP entries.
- Adding `delivery` role: no mature module behavior changes. Delivery gets new module access per the permission matrix.
- TypeScript compiles.

**Commit message:** `feat: apply permission-based access to new modules (Cashier, Attendance, Checklist, Suppliers, Assets)`

### F.5 Phase 1 — Production Validation Period (No Code Changes)

**Goal:** Run the new modules on the permission-based system in production for a validation period. Observe behavior. Confirm stability before migrating mature modules.

**Duration:** Minimum 2 weeks of production use, or until all five new modules have been actively used by at least two different roles.

**Actions:**
- No code changes.
- Monitor: access-denied errors, support requests about missing features, RLS rejection logs.
- Collect feedback: are there any permission gaps in the new modules?

**Exit criteria:**
- Zero unexpected access-denied errors from new modules.
- No support requests related to permissions on new modules.
- All role-permission mappings for new modules confirmed correct by Owner testing.

**If issues are found:** Fix the `ROLE_PERMISSIONS` mapping or the permission key assignment. The new system is self-contained — fixes to new modules do not affect mature modules.

### F.6 Phase 2 — Migrate Mature Modules (Full Conversion, One Module at a Time)

**Goal:** All permission checks use the new system. `ROUTE_RULES` and `requireRole()` are deprecated. This phase begins only after Phase 1 exit criteria are met.

**Actions (per module, independent PRs):**

For each mature module, in order of least risk:

| Order | Module | Risk | Migration |
|-------|--------|------|-----------|
| 1 | Finance | Low — owner only, simple | Replace `requireRole('owner')` → `requirePermission(PERMISSION.VIEW_FINANCE)` |
| 2 | Reports | Low — owner/manager | Replace `requireRole(...)` → `requirePermission(...)` |
| 3 | Incidents | Low | Replace role checks with permission checks |
| 4 | Complaints | Low | Same |
| 5 | Reservations | Low | Same |
| 6 | Dine-in | Low | Same |
| 7 | Tasks | Low | Replace `requireCurrentStaff()` → `requirePermission(PERMISSION.VIEW_TASKS)` |
| 8 | Inventory | Low | Same pattern |
| 9 | Staff Accounts | Low | Same pattern |
| 10 | Purchase | Medium — client component | Replace role checks + supplier dropdown permissions |
| 11 | Bento | High — Kitchen "limited access" | Replace `isKitchen` flags with `hasPermission()` checks. Keep `bento_kitchen_orders` view and `set_bento_order_status` RPC — they are data-layer enforcement, not being replaced. |
| 12 | Home Dashboard | Medium — many canAccessPath calls | Replace `canAccessPath(role, path)` → `hasPermission(role, PERMISSION.X)`. Replace `getHomeVisibility` role checks → permission checks. |
| 13 | BottomNav | Low | Replace `BOTTOM_NAV_ITEMS` role map → permission map |
| 14 | proxy.ts | Medium | `getAuthRedirect` delegates to `canAccessPath` which already handles both systems. |

After all modules are migrated:
- `ROUTE_RULES` array is removed from `permissions.ts`.
- `requireRole()` is deprecated (kept as a wrapper for backward compatibility).
- All role-based identity checks (`role === 'owner'`) are replaced with permission checks.

**Verification after each module:**
- Module's existing tests pass.
- Manual QA: each role still sees the same pages, same data, same UI elements.
- TypeScript compiles.

### F.7 What Does NOT Change

These are intentionally preserved at every phase:

| Component | Why Preserved |
|-----------|--------------|
| `staff_role_is()` RLS function | Database-layer enforcement. Works with role arrays. No change needed. |
| `bento_kitchen_orders` view | Database-layer data filtering. Works correctly. |
| `set_bento_order_status()` RPC | Database-layer action gating. Works correctly. |
| `getAuthRedirect()` in proxy.ts | Function signature unchanged. Internally delegates to `canAccessPath` which handles both systems. |
| `requireCurrentStaff()` | Auth check only, no role logic. Unchanged. |
| `STAFF_ROLES` constant | Role definitions. Gains `delivery` but is otherwise unchanged. |

### F.8 Delivery Role Activation

The `delivery` role has permissions defined from Phase 0. It is added to `STAFF_ROLES` in Phase 0.5 when the permission system goes live for new modules. Activation steps:

1. Add `'delivery'` to `STAFF_ROLES` in `lib/auth/types.ts` (Phase 0).
2. Add `delivery` to the `role` check constraint in the `staff_profiles` migration (Phase 0).
3. Assign `ROLE_PERMISSIONS.delivery` as defined (Phase 0).
4. When Phase 0.5 is deployed, the delivery role can access new modules per the permission matrix.
5. Delivery does NOT gain access to any mature module routes (those are still on ROUTE_RULES which does not include delivery).
6. Create a Delivery staff account for testing.
7. Verify: can access Home, view Bento orders, view Tasks (all via legacy ROUTE_RULES — delivery must be added to those entries), clock in/out. Cannot access Finance, Purchase, Staff accounts.

No existing behavior changes because no existing users have the `delivery` role.

### F.9 Migration Phase Summary

| Phase | New Modules | Mature Modules | Risk | Timeline |
|-------|------------|---------------|------|----------|
| **0** | Constants defined, not called | Unchanged | Zero | Immediate |
| **0.5** | Permission-based access live | Legacy role-based access | Low | After Phase 0 verified |
| **1** | Production validation | Legacy role-based access | None (observation) | 2+ weeks |
| **2** | Already migrated in Phase 0.5 | Migrated one module at a time | Medium per module | After Phase 1 exit criteria met |

---

## G. Risks and Recommendations

### G.1 Risks

| # | Risk | Likelihood | Mitigation |
|---|------|-----------|------------|
| 1 | **Permission key drift** — permissions defined but not enforced | Medium | `hasPermission()` is the single source of truth. All enforcement layers call it. |
| 2 | **Kitchen Bento regression** — replacing `isKitchen` flags breaks limited access | Medium | Phase 2 Bento migration is last. Keep views and RPCs. Test exhaustively. |
| 3 | **RLS/permission mismatch** — RLS checks `staff_role_is()` while app checks `hasPermission()` | Low | RLS policies are role-based and correct. The app layer adds granularity on top. The two layers don't need to match exactly — app can be more permissive than RLS, but RLS is the final guard. |
| 4 | **Delivery role has no users but consumes permissions** | Low | Permissions are cheap. Having delivery defined in the permission map costs nothing and makes activation trivial. |
| 5 | **Permission explosion** — too many granular permissions | Medium | Start with module-level permissions. Add sub-resource permissions only when needed (Bento needs them; most modules don't). |
| 6 | **Phase 0.5 hybrid system confusion** — developers don't know which system to use for which module | Medium | Clear module classification table (§F.2). New modules → permission-based. Mature modules → legacy. See `PERMISSION_ROUTE_MAP` for new, `ROUTE_RULES` for legacy. |

### G.2 Recommendations

1. **Start Phase 0 immediately.** It is zero-risk — just defining constants and functions that are not yet called. This unblocks all future work.

2. **Implement new modules with permissions from day one (Phase 0.5).** Cashier, Attendance, Checklist, Suppliers, and Assets use `requirePermission()` and `usePermission()`. They do not add entries to the legacy `ROUTE_RULES` array — only to `PERMISSION_ROUTE_MAP`. This validates the permission architecture on low-risk modules before touching operational code.

3. **Add the Delivery role in Phase 0.** Define its permissions. Add it to `STAFF_ROLES`. Don't create delivery users yet. This costs nothing and prevents a future migration when delivery is needed.

4. **Keep Sensitive Data permissions coarse in v1.** `VIEW_CUSTOMER_PII` is either granted or not. Don't create per-field permissions (`VIEW_CUSTOMER_PHONE`, `VIEW_CUSTOMER_ADDRESS`) until there is a concrete use case.

5. **Audit the permission matrix quarterly.** As new modules are added and roles evolve, the matrix should be reviewed. A script that outputs "who can do what" from `ROLE_PERMISSIONS` makes this trivial.

6. **Future multi-outlet scoping.** When multi-outlet is implemented, add `outlet_id` to permission checks. The simplest approach: a `staff_outlets` junction table. `hasPermission()` gains an optional `outletId` parameter. Roles that are outlet-scoped (future: outlet-level Manager) would have their permission set filtered by outlet.

7. **Future POS integration.** POS permissions should use the same `PERMISSION` namespace: `pos:view`, `pos:operate`, `pos:void_transaction`. No new permission system is needed for POS.

8. **Future Payroll module.** Payroll permissions: `payroll:view`, `payroll:edit`, `payroll:approve`. Added to `ROLE_PERMISSIONS.owner`. No structural changes needed.

### G.3 What Should NOT Be Done

- **Do not remove `staff_role_is()` or existing RLS policies.** They are the database-layer enforcement and work correctly.
- **Do not remove `requireRole()` until all existing code is migrated.** It is the backward-compatible wrapper.
- **Do not create per-field permissions unless there is a concrete UX requirement.** Start with module-level and sub-resource-level. Field-level is expensive to maintain.
- **Do not change the four-role model.** Adding a `delivery` role is additive. Existing roles keep their permissions.
- **Do not add `outlet_id` to permission checks until multi-outlet is implemented.** The architecture supports it but the implementation should wait.

---

## Appendix A: File Map (New and Modified)

### New Files (Phase 0)

| File | Purpose |
|------|---------|
| `lib/auth/permissionKeys.ts` | All `PERMISSION` constant definitions |
| `lib/auth/rolePermissions.ts` | `ROLE_PERMISSIONS` mapping of roles → permission arrays |
| `lib/auth/permissionCheck.ts` | `hasPermission()`, `hasAllPermissions()`, `hasAnyPermission()` |
| `lib/auth/permissionRouteMap.ts` | `PERMISSION_ROUTE_MAP` mapping of permissions → route prefixes |

### Modified Files

| File | Phase | Change |
|------|-------|--------|
| `lib/auth/types.ts` | Phase 0 | Add `'delivery'` to `STAFF_ROLES` |
| `lib/auth/permissions.ts` | Phase 0.5 | `canAccessPath()` delegates to both systems. `getHomeVisibility()` uses `hasPermission()`. `getNavigationItems()` uses `hasPermission()`. |
| `lib/auth/currentStaff.ts` | Phase 0.5 | Add `requirePermission()`, `requireAnyPermission()` |
| `app/components/StaffProvider.tsx` | Phase 0.5 | Add `usePermission()` hook |
| `proxy.ts` | Phase 0.5 | No signature change (delegates to updated `canAccessPath`) |
| `app/page.tsx` | Phase 0.5 | Add Quick Access cards for new modules using `usePermission()`. Mature module cards remain on `canAccessPath()`. |
| **New module pages** | Phase 0.5 | Cashier, Attendance, Checklist, Suppliers, Assets use `requirePermission()` / `usePermission()` |
| `app/staff/accounts/actions.ts` | Phase 2 | Replace `requireRole('owner')` → `requirePermission(PERMISSION.MANAGE_STAFF_ACCOUNTS)` |
| All mature module pages | Phase 2 | Replace `requireRole()` / `canAccessPath()` with `requirePermission()` / `usePermission()` |
