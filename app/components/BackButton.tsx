'use client'

import { useRouter } from 'next/navigation'

interface BackButtonProps {
  href: string
}

export default function BackButton({ href }: BackButtonProps) {
  const router = useRouter()

  const handleBack = async () => {
    const el = document.querySelector('.page-slide-in') as HTMLElement | null
    if (el) {
      el.style.animation = 'slideOutRight 0.25s ease-in forwards'
      await new Promise(r => setTimeout(r, 230))
    }
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
