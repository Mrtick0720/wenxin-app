'use client'

import { useRouter } from 'next/navigation'

interface BackButtonProps {
  href: string
}

export default function BackButton({ href }: BackButtonProps) {
  const router = useRouter()

  const handleBack = () => {
    // 1. Plain background cover — prevents any flash while destination renders
    const bgEl = document.createElement('div')
    bgEl.style.cssText = 'position:fixed;inset:0;z-index:8;background:#f9fafb;pointer-events:none;'
    document.body.prepend(bgEl)

    // 2. Slide current page out to the right
    const pageEl = document.querySelector('.page-slide-in') as HTMLElement | null
    if (pageEl) {
      pageEl.style.position = 'fixed'
      pageEl.style.inset = '0'
      pageEl.style.width = '100%'
      pageEl.style.zIndex = '10'
      pageEl.style.animation = 'slideOutRight 0.28s ease-in forwards'
    }

    // 3. Navigate — destination renders behind bgEl (hidden)
    router.push(href)

    // 4. Fade bgEl out once destination has painted
    setTimeout(() => {
      bgEl.style.transition = 'opacity 0.2s ease'
      bgEl.style.opacity = '0'
      setTimeout(() => bgEl.remove(), 220)
    }, 320)
  }

  return (
    <button onClick={handleBack} className="flex items-center text-gray-500">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
  )
}
