'use client'

import type { ReactNode } from 'react'
import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'
import NavLink from '../components/NavLink'
import { useStaff } from '../components/StaffProvider'
import { canAccessPath } from '@/lib/auth/permissions'
import type { StaffRole } from '@/lib/auth/types'

// Shared svg wrapper props for consistent line-icon style.
const ic = {
  width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}

type Module = { href: string; label: string; icon: ReactNode }
type Group = { title: string; modules: Module[] }

// All V1 modules, grouped. Visibility is filtered per role via canAccessPath (scalable for future roles).
const GROUPS: Group[] = [
  {
    title: 'Operations',
    modules: [
      { href: '/bento', label: 'Bento', icon: (<svg {...ic}><path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z"/><path d="M7 21h10"/><path d="M19.5 12 22 6"/></svg>) },
      { href: '/reservations', label: 'Bookings', icon: (<svg {...ic}><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M16 2v4"/></svg>) },
      { href: '/dine-in', label: 'Dine-in', icon: (<svg {...ic}><path d="M3 2v7c0 1.1.9 2 2 2a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>) },
      { href: '/bento/customers', label: 'Customers', icon: (<svg {...ic}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>) },
    ],
  },
  {
    title: 'People',
    modules: [
      { href: '/staff/accounts', label: 'Staff', icon: (<svg {...ic}><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>) },
      { href: '/staff', label: 'Schedule', icon: (<svg {...ic}><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/></svg>) },
      { href: '/attendance', label: 'Attendance', icon: (<svg {...ic}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>) },
    ],
  },
  {
    title: 'Operations Control',
    modules: [
      { href: '/complaints', label: 'Quality Issues', icon: (<svg {...ic}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/></svg>) },
      { href: '/incidents', label: 'Incidents', icon: (<svg {...ic}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17"/></svg>) },
      { href: '/tasks', label: 'Tasks', icon: (<svg {...ic}><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>) },
      { href: '/checklist', label: 'Checklist', icon: (<svg {...ic}><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>) },
    ],
  },
  {
    title: 'Inventory & Procurement',
    modules: [
      { href: '/inventory', label: 'Inventory', icon: (<svg {...ic}><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>) },
      { href: '/purchase', label: 'Purchase', icon: (<svg {...ic}><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>) },
      { href: '/suppliers', label: 'Suppliers', icon: (<svg {...ic}><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>) },
    ],
  },
  {
    title: 'Assets & Cash',
    modules: [
      { href: '/assets', label: 'Assets', icon: (<svg {...ic}><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>) },
      { href: '/cashier', label: 'Cashier', icon: (<svg {...ic}><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01"/><path d="M18 12h.01"/></svg>) },
    ],
  },
  {
    title: 'Business',
    modules: [
      { href: '/finance', label: 'Finance', icon: (<svg {...ic}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>) },
      { href: '/reports', label: 'Reports', icon: (<svg {...ic}><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>) },
    ],
  },
]

export default function AllModulesPage() {
  const staff = useStaff()
  const role = (staff?.role ?? 'front_desk') as StaffRole

  // Role-based visibility: keep only modules the role can access; drop empty groups.
  const visibleGroups = GROUPS
    .map(g => ({ ...g, modules: g.modules.filter(m => canAccessPath(role, m.href)) }))
    .filter(g => g.modules.length > 0)

  return (
    <PageTransition>
      <main className="bg-gray-50 w-full mx-auto min-h-screen">
        <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-10">
          <BackButton href="/" />
          <span className="font-semibold text-base">All Modules</span>
        </div>

        <div className="px-4 py-4 pb-8 space-y-5">
          {visibleGroups.map(group => (
            <div key={group.title}>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{group.title}</div>
              <div className="grid grid-cols-3 gap-2">
                {group.modules.map(({ href, label, icon }) => (
                  <NavLink key={href} href={href} className="bg-white rounded-xl py-4 px-1 shadow-sm border border-gray-100 text-center block overflow-hidden">
                    <div className="flex justify-center mb-1.5 text-gray-500">{icon}</div>
                    <div className="text-xs font-semibold text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis">{label}</div>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </PageTransition>
  )
}
