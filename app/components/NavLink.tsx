'use client'

import React from 'react'
import { useNavigation } from './NavigationStack'
import { getPageElement } from '@/app/lib/stackRoutes'

interface NavLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  children: React.ReactNode
}

export default function NavLink({ href, children, className, onClick, ...rest }: NavLinkProps) {
  const { push } = useNavigation()

  const handle = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = getPageElement(href)
    if (el) {
      e.preventDefault()
      onClick?.(e)
      push(href, el)
    }
    // if no matching route, let the browser handle it normally
  }

  return (
    <a href={href} className={className} onClick={handle} {...rest}>
      {children}
    </a>
  )
}
