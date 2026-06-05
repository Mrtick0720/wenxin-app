'use client'

import { useRouter } from 'next/navigation'
import { getSnapshot } from '@/lib/pageCapture'

interface BackButtonProps {
  href: string
}

export default function BackButton({ href }: BackButtonProps) {
  const router = useRouter()

  const handleBack = () => {
    // 1. Place the captured home page snapshot as a fixed background layer
    const snapshot = getSnapshot()
    let bgEl: HTMLElement | null = null

    if (snapshot) {
      bgEl = document.createElement('div')
      bgEl.style.cssText =
        'position:fixed;inset:0;z-index:0;overflow:hidden;background:#f9fafb;pointer-events:none;'
      bgEl.appendChild(snapshot)
      document.body.prepend(bgEl)
    }

    // 2. Fix the current page on top and slide it out to the right
    const pageEl = document.querySelector('.page-slide-in') as HTMLElement | null
    if (pageEl) {
      pageEl.style.position = 'fixed'
      pageEl.style.inset = '0'
      pageEl.style.width = '100%'
      pageEl.style.zIndex = '10'
      pageEl.style.background = 'white'
      pageEl.style.animation = 'slideOutRight 0.28s ease-in forwards'
    }

    // 3. Navigate immediately — real parent page renders behind the animation
    router.push(href)

    // 4. Fade snapshot out slowly so the real page has time to fully paint
    //    before the snapshot disappears — prevents white flash on home page return
    setTimeout(() => {
      if (!bgEl) return
      bgEl.style.transition = 'opacity 0.25s ease'
      bgEl.style.opacity = '0'
      setTimeout(() => bgEl?.remove(), 260)
    }, 500)
  }

  return (
    <button onClick={handleBack} className="flex items-center text-gray-500">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
  )
}
