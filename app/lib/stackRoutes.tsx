// Route metadata registry.
//
// PURE DATA — this module intentionally imports NO page modules. Client
// navigation UIs can consume it freely without pulling Server Components (and
// their `server-only` dependencies, e.g. lib/auth/currentStaff via the
// cashier / attendance / checklist pages) into the client bundle.
//
// Client-side stack rendering for client-safe routes lives in ./stackPages.
// Routes not registered there navigate by URL (standard Next.js App Router).

export type RouteSection =
  | 'operations'
  | 'finance'
  | 'people'
  | 'inventory'
  | 'system'

export interface RouteMeta {
  /** URL path (Next.js App Router route) */
  path: string
  /** Human-readable label for nav menus */
  label: string
  /** Grouping for nav sections */
  section: RouteSection
  /** Stable key for menus / analytics */
  key: string
}

export const routeMeta: RouteMeta[] = [
  { path: '/purchase',     label: 'Purchase',     section: 'inventory',  key: 'purchase' },
  { path: '/bento',        label: 'Bento',        section: 'operations', key: 'bento' },
  { path: '/staff',        label: 'Staff',        section: 'people',     key: 'staff' },
  { path: '/finance',      label: 'Finance',      section: 'finance',    key: 'finance' },
  { path: '/inventory',    label: 'Inventory',    section: 'inventory',  key: 'inventory' },
  { path: '/reports',      label: 'Reports',      section: 'finance',    key: 'reports' },
  { path: '/dine-in',      label: 'Dine-in',      section: 'operations', key: 'dine-in' },
  { path: '/reservations', label: 'Reservations', section: 'operations', key: 'reservations' },
  { path: '/complaints',   label: 'Complaints',   section: 'operations', key: 'complaints' },
  { path: '/incidents',    label: 'Incidents',    section: 'operations', key: 'incidents' },
  { path: '/tasks',        label: 'Tasks',        section: 'operations', key: 'tasks' },
  { path: '/all',          label: 'All Modules',  section: 'system',     key: 'all' },
  { path: '/suppliers',    label: 'Suppliers',    section: 'inventory',  key: 'suppliers' },
  { path: '/attendance',   label: 'Attendance',   section: 'people',     key: 'attendance' },
  { path: '/checklist',    label: 'Checklist',    section: 'operations', key: 'checklist' },
  { path: '/assets',       label: 'Assets',       section: 'inventory',  key: 'assets' },
  { path: '/cashier',      label: 'Cashier',      section: 'finance',    key: 'cashier' },
]

export const routeMetaByPath: Record<string, RouteMeta> = Object.fromEntries(
  routeMeta.map((r) => [r.path, r]),
)
