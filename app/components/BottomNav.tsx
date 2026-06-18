'use client'

import { usePathname } from 'next/navigation'
import { useNavigation } from './NavigationStack'
import { getPageElement } from '@/app/lib/stackPages'

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
    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 00-3-3.87"/>
    <path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
)

const PurchaseIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#f97316' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 01-8 0"/>
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
  { href: '/purchase', label: 'Purchase', Icon: PurchaseIcon },
  { href: '/staff', label: 'Staff', Icon: StaffIcon },
  { href: '/profile', label: 'Me', Icon: ProfileIcon },
]

export default function BottomNav({ pendingCount = 0 }: { pendingCount?: number }) {
  const { push, reset, currentPath } = useNavigation()
  const pathname = usePathname()

  // On a standalone URL route (e.g. /profile, or a directly-loaded page), the
  // in-app stack model doesn't apply — let the anchor navigate by URL so every
  // tab, including Home, actually moves. On the dashboard ('/') we drive the
  // client navigation stack instead, and fall back to URL navigation for tabs
  // with no client-renderable page (mirrors NavLink).
  const handleTap = (e: React.MouseEvent, href: string) => {
    if (pathname !== '/') return
    if (href === '/') {
      e.preventDefault()
      reset()
      return
    }
    const el = getPageElement(href)
    if (el) {
      e.preventDefault()
      push(href, el)
    }
  }

  // Active tab: use the real URL when on a standalone route, otherwise the top
  // of the navigation stack. Detail pages (e.g. /purchase/123) keep their parent
  // tab highlighted.
  const activePath = pathname !== '/' ? pathname : currentPath

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex py-2 z-[300]">
      {tabs.map(({ href, label, Icon, badge }) => {
        const active = href === '/'
          ? activePath === '/'
          : activePath === href || activePath.startsWith(`${href}/`)
        return (
          <a key={label} href={href} onClick={e => handleTap(e, href)}
            className="flex-1 flex flex-col items-center justify-center relative py-1">
            <Icon active={active} />
            <span className={`text-xs mt-0.5 ${active ? 'text-orange-500 font-medium' : 'text-gray-400'}`}>
              {label}
            </span>
            {badge && pendingCount > 0 && (
              <span className="absolute top-0 right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </a>
        )
      })}
    </div>
  )
}
