import NavLink from '../NavLink'
import { canAccessPath } from '@/lib/auth/permissions'
import type { StaffRole } from '@/lib/auth/types'

const ITEMS: { href: string; label: string; always: boolean; icon: React.ReactNode }[] = [
  { href: '/tasks', label: 'Approvals', always: false, icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
  ) },
  { href: '/bento/customers', label: 'Customers', always: false, icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ) },
  { href: '/attendance', label: 'Attendance', always: false, icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
  ) },
  { href: '/inventory', label: 'Inventory', always: false, icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/></svg>
  ) },
  { href: '/kitchen-tasks', label: 'Kitchen Tasks', always: false, icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/><path d="M8 6 6 4"/><path d="m8 12-2-2"/><path d="m8 18-2-2"/></svg>
  ) },
  { href: '/staff', label: 'Staff', always: false, icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  ) },
  { href: '/marketing', label: 'Marketing', always: false, icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
  ) },
  { href: '/finance', label: 'Finance', always: false, icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>
  ) },
  { href: '/reports', label: 'Reports', always: false, icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
  ) },
  { href: '/all', label: 'View All', always: true, icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
  ) },
]

export default function QuickAccessGrid({ role }: { role: StaffRole }) {
  const items = ITEMS.filter(item => item.always || canAccessPath(role, item.href))
  return (
    <div>
      <div className="text-sm font-semibold text-gray-800 mb-2 px-1">Quick Access</div>
      <div className="grid grid-cols-4 gap-2">
        {items.map(({ href, label, icon }) => (
          <NavLink key={href} href={href} className="bg-white rounded-xl py-3 px-1 shadow-sm flex flex-col items-center gap-1.5 overflow-hidden">
            <span className="text-orange-500">{icon}</span>
            <span className="text-[11px] font-medium text-gray-600 truncate max-w-full">{label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  )
}
