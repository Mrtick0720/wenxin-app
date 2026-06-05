'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#f97316' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
    <path d="M9 21V12h6v9"/>
  </svg>
)

const ApprovalIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#f97316' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>
)

const StaffIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#f97316' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <line x1="8" y1="14" x2="8" y2="14"/>
    <line x1="12" y1="14" x2="12" y2="14"/>
    <line x1="16" y1="14" x2="16" y2="14"/>
    <line x1="8" y1="18" x2="8" y2="18"/>
    <line x1="12" y1="18" x2="12" y2="18"/>
  </svg>
)

const ReportIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#f97316' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)

const ProfileIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#f97316' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)

const tabs = [
  { href: '/', label: 'Home', Icon: HomeIcon },
  { href: '/tasks', label: 'Approvals', Icon: ApprovalIcon, badge: true },
  { href: '/staff', label: 'Schedule', Icon: StaffIcon },
  { href: '/reports', label: 'Reports', Icon: ReportIcon },
  { href: '/profile', label: 'Me', Icon: ProfileIcon },
]

export default function BottomNav({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-2 z-40">
      {tabs.map(({ href, label, Icon, badge }) => {
        const active = pathname === href
        return (
          <Link key={label} href={href} className="flex flex-col items-center relative px-3 py-1">
            <Icon active={active} />
            <span className={`text-xs mt-0.5 ${active ? 'text-orange-500 font-medium' : 'text-gray-400'}`}>
              {label}
            </span>
            {badge && pendingCount > 0 && (
              <span className="absolute top-0 right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
