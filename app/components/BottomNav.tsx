'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useNavigation } from './NavigationStack'
import { getPageElement } from '@/app/lib/stackPages'
import { resolveBottomTabAction } from '@/lib/bottomTabNavigation'
import { useState, useEffect } from 'react'

const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#f97316' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
    <path d="M9 21V12h6v9"/>
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

const BentoIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#f97316' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"/>
    <path d="M6 17h12"/>
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

type BottomTab = {
  href: string
  label: string
  Icon: ({ active }: { active: boolean }) => React.JSX.Element
  badge?: boolean
}

const tabs: BottomTab[] = [
  { href: '/', label: 'Home', Icon: HomeIcon },
  { href: '/bento', label: 'Bento', Icon: BentoIcon },
  { href: '/purchase', label: 'Purchase', Icon: PurchaseIcon },
  { href: '/staff', label: 'Staff', Icon: StaffIcon },
  { href: '/profile', label: 'Me', Icon: ProfileIcon },
]

export default function BottomNav({ pendingCount = 0, purchasePending = false, bentoPending = false }: { pendingCount?: number; purchasePending?: boolean; bentoPending?: boolean }) {
  const { reset, resetTo, popToRoot, canPop, currentPath } = useNavigation()
  const router = useRouter()
  const pathname = usePathname()
  const [forceHomeActive, setForceHomeActive] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  // Clear force highlight once pathname catches up
  useEffect(() => {
    if (pathname === '/') setForceHomeActive(false)
  }, [pathname])

  // Clear pendingHref once navigation context catches up
  const activePath = canPop ? currentPath : pathname
  useEffect(() => {
    if (pendingHref && activePath === pendingHref) setPendingHref(null)
  }, [activePath, pendingHref])

  const handleTap = (e: React.MouseEvent, href: string) => {
    e.preventDefault()
    const action = resolveBottomTabAction({ href, currentPath })
    setForceHomeActive(false)

    if (action === 'home') {
      if (canPop) {
        popToRoot()
        // Home layer is already mounted beneath the stack — no router navigation needed.
        // Calling router.push('/') here would trigger force-dynamic re-render + splash.
      } else {
        router.push('/')
      }
      setForceHomeActive(true)
      setPendingHref('/')
      return
    }

    if (action === 'noop') return

    setPendingHref(href)

    const el = getPageElement(href)
    if (el) {
      resetTo(href, el)
      return
    }

    // Non-stack page — use client-side router.push to avoid loading.tsx splash
    router.push(href)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex py-2 z-[300]">
      {tabs.map(({ href, label, Icon, badge }) => {
        const active = pendingHref
          ? href === pendingHref
          : href === '/'
            ? activePath === '/' || (forceHomeActive && !canPop)
            : activePath === href || activePath.startsWith(`${href}/`)
        return (
          <a key={label} href={href} onClick={e => handleTap(e, href)}
            className="flex-1 flex flex-col items-center justify-center relative py-1">
            <div className="relative inline-flex">
              <Icon active={active} />
              {href === '/purchase' && purchasePending && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
              )}
              {href === '/bento' && bentoPending && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
              )}
              {badge && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-0.5 flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </div>
            <span className={`text-xs mt-0.5 ${active ? 'text-orange-500 font-medium' : 'text-gray-400'}`}>
              {label}
            </span>
          </a>
        )
      })}
    </div>
  )
}
