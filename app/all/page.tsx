'use client'

import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'
import NavLink from '../components/NavLink'
import { useStaff } from '../components/StaffProvider'
import { canAccessPath } from '@/lib/auth/permissions'
import type { StaffRole } from '@/lib/auth/types'

// Full module directory — opened from Home → Quick Access → "View All".
const MODULES: { href: string; label: string }[] = [
  { href: '/purchase', label: 'Purchase' },
  { href: '/bento', label: 'Bento' },
  { href: '/bento/customers', label: 'Customers' },
  { href: '/staff', label: 'Staff' },
  { href: '/reservations', label: 'Bookings' },
  { href: '/dine-in', label: 'Dine-in' },
  { href: '/complaints', label: 'Complaints' },
  { href: '/incidents', label: 'Incidents' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/finance', label: 'Finance' },
  { href: '/reports', label: 'Reports' },
]

export default function AllModulesPage() {
  const staff = useStaff()
  const role = (staff?.role ?? 'front_desk') as StaffRole
  const items = MODULES.filter(m => canAccessPath(role, m.href))

  return (
    <PageTransition>
      <main className="bg-gray-50 w-full mx-auto min-h-screen">
        <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-10">
          <BackButton href="/" />
          <span className="font-semibold text-base">All Modules</span>
        </div>

        <div className="px-4 py-4 pb-8">
          <div className="grid grid-cols-3 gap-2">
            {items.map(({ href, label }) => (
              <NavLink key={href} href={href} className="bg-white rounded-xl py-4 px-1 shadow-sm border border-gray-100 text-center block overflow-hidden">
                <div className="text-xs font-semibold text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis">{label}</div>
              </NavLink>
            ))}
          </div>
        </div>
      </main>
    </PageTransition>
  )
}
