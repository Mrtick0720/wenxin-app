'use client'

import { useRouter } from 'next/navigation'

interface BackButtonProps {
  href: string
}

export default function BackButton({ href }: BackButtonProps) {
  const router = useRouter()

  const handleBack = () => {
    const el = document.querySelector('.page-slide-in') as HTMLElement | null
    if (el) {
      // Fix current page on top so parent page renders underneath during slide-out
      el.style.position = 'fixed'
      el.style.inset = '0'
      el.style.width = '100%'
      el.style.zIndex = '50'
      el.style.backgroundColor = 'white'
      el.style.animation = 'slideOutRight 0.25s ease-in forwards'
    }
    // Navigate immediately — parent page renders beneath the sliding overlay
    router.push(href)
  }

  return (
    <button onClick={handleBack} className="flex items-center text-gray-500">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
  )
}
