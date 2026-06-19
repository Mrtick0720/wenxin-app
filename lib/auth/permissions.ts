import {
  STAFF_ROLES,
  type NavigationItem,
  type StaffRole,
} from './types.ts'

export const SESSION_HOURS = 12
export const STAFF_EMAIL_DOMAIN = 'staff.wenxin.internal'

type RoleMap = Partial<Record<StaffRole, boolean>>

type RouteRule = {
  prefix: string
  exact?: boolean
  roles: RoleMap
}

const ALL_ROLES: RoleMap = {
  owner: true,
  manager: true,
  kitchen: true,
  front_desk: true,
}

const ROUTE_RULES: RouteRule[] = [
  { prefix: '/staff/accounts', roles: { owner: true } },
  { prefix: '/staff/activity', roles: { owner: true } },
  { prefix: '/bento/production', roles: { owner: true, manager: true, kitchen: true } },
  { prefix: '/bento/customers', roles: { owner: true, manager: true, front_desk: true } },
  { prefix: '/bento/weekly-menu', roles: ALL_ROLES },
  { prefix: '/bento/unpaid', roles: { owner: true, manager: true, front_desk: true } },
  { prefix: '/bento/new', roles: { owner: true, manager: true, front_desk: true } },
  { prefix: '/reservations', roles: { owner: true, manager: true, front_desk: true } },
  { prefix: '/complaints', roles: { owner: true, manager: true, front_desk: true } },
  { prefix: '/inventory', roles: { owner: true, manager: true, kitchen: true } },
  { prefix: '/purchase', roles: { owner: true, manager: true, kitchen: true } },
  // Kitchen removed: the Suppliers page exposes purchase cost totals, which
  // must never reach staff devices (see Purchase ledger cost-hiding policy).
  { prefix: '/suppliers', roles: { owner: true, manager: true } },
  { prefix: '/attendance', roles: ALL_ROLES },
  { prefix: '/checklist', roles: ALL_ROLES },
  { prefix: '/assets', roles: ALL_ROLES },
  { prefix: '/cashier', roles: { owner: true, manager: true, front_desk: true } },
  { prefix: '/dine-in', roles: { owner: true, manager: true, front_desk: true } },
  { prefix: '/incidents', roles: { owner: true, manager: true, front_desk: true } },
  { prefix: '/reports', roles: { owner: true, manager: true } },
  { prefix: '/revenue', roles: { owner: true, manager: true } },
  { prefix: '/marketing', roles: { owner: true, manager: true } },
  { prefix: '/receivables', roles: { owner: true, manager: true, front_desk: true } },
  { prefix: '/payables',    roles: { owner: true, manager: true, front_desk: true } },
  { prefix: '/finance', roles: { owner: true } },
  { prefix: '/staff', roles: { owner: true, manager: true } },
  { prefix: '/bento', roles: ALL_ROLES },
  { prefix: '/tasks', roles: ALL_ROLES },
  { prefix: '/profile', roles: ALL_ROLES },
  { prefix: '/all', roles: ALL_ROLES },
  { prefix: '/', exact: true, roles: ALL_ROLES },
]

const BOTTOM_NAV_ITEMS: Array<NavigationItem & { roles: RoleMap }> = [
  { href: '/', label: 'Home', roles: ALL_ROLES },
  { href: '/tasks', label: 'Approvals', roles: ALL_ROLES },
  { href: '/purchase', label: 'Purchase', roles: { owner: true, manager: true, kitchen: true } },
  { href: '/marketing', label: 'Marketing', roles: { owner: true, manager: true } },
  { href: '/profile', label: 'Me', roles: ALL_ROLES },
]

export type AuthRedirectInput = {
  path: string
  authenticated: boolean
  active?: boolean
  mustChangePassword?: boolean
  role?: StaffRole
  sessionValid?: boolean
}

export function normalizeStaffId(value: string) {
  return value.trim().toLowerCase()
}

export function isValidStaffId(value: string) {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value)
}

export function staffIdToEmail(value: string) {
  return `${normalizeStaffId(value)}@${STAFF_EMAIL_DOMAIN}`
}

export function isStaffRole(value: string): value is StaffRole {
  return STAFF_ROLES.includes(value as StaffRole)
}

export function canAccessPath(role: StaffRole, pathname: string) {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/'
  const rule = ROUTE_RULES.find(candidate =>
    candidate.exact
      ? path === candidate.prefix
      : path === candidate.prefix || path.startsWith(`${candidate.prefix}/`)
  )

  return rule?.roles[role] === true
}

export function getHomeVisibility(role: StaffRole) {
  const seesBusinessTotals = role === 'owner' || role === 'manager'

  return {
    revenue: seesBusinessTotals,
    reports: seesBusinessTotals,
    finance: role === 'owner',
    operationalAlerts: true,
  }
}

export function isSessionExpired(startedAt: string, now = new Date()) {
  const start = new Date(startedAt).getTime()
  if (!Number.isFinite(start)) return true
  return now.getTime() - start >= SESSION_HOURS * 60 * 60 * 1000
}

export function validatePasswordChange(password: string, confirmation: string) {
  if (password.length < 8) {
    return { ok: false as const, error: 'Password must be at least 8 characters.' }
  }
  if (password !== confirmation) {
    return { ok: false as const, error: 'Passwords do not match.' }
  }
  return { ok: true as const }
}

export function validateNewStaff(input: {
  staffId: string
  displayName: string
  role: string
  password: string
}) {
  if (!isValidStaffId(normalizeStaffId(input.staffId))) {
    return { ok: false as const, error: 'Enter a valid Staff ID.' }
  }
  if (!input.displayName.trim()) {
    return { ok: false as const, error: 'Display name is required.' }
  }
  if (!isStaffRole(input.role)) {
    return { ok: false as const, error: 'Select a valid role.' }
  }
  if (input.password.length < 8) {
    return { ok: false as const, error: 'Password must be at least 8 characters.' }
  }
  return { ok: true as const }
}

export function getNavigationItems(role: StaffRole): NavigationItem[] {
  return BOTTOM_NAV_ITEMS
    .filter(item => item.roles[role])
    .map(({ href, label }) => ({ href, label }))
}

export function getAuthRedirect(input: AuthRedirectInput): string | null {
  const { path, authenticated } = input
  const isLogin = path === '/login'
  const isDisabledPage = path === '/account-disabled'
  const isPasswordPage = path === '/change-password'

  if (!authenticated) {
    return isLogin || isDisabledPage ? null : '/login'
  }
  if (input.active === false) {
    return isDisabledPage ? null : '/account-disabled'
  }
  if (input.sessionValid === false) {
    return '/login?reason=session-ended'
  }
  if (input.mustChangePassword) {
    return isPasswordPage ? null : '/change-password'
  }
  if (isLogin || isPasswordPage || isDisabledPage) {
    return '/'
  }
  if (!input.role || !canAccessPath(input.role, path)) {
    return path === '/access-denied' ? null : '/access-denied'
  }
  return null
}
