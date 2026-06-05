'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { captureSnapshot } from '@/lib/pageCapture'

// Captures the home page DOM on any click (before navigating away)
// so BackButton can use it as a background layer during back transition
export default function LayoutCapture() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname !== '/') return

    const handleClick = () => {
      const el = document.querySelector('[data-page-capture]') as HTMLElement | null
      if (el) captureSnapshot(el)
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [pathname])

  return null
}
