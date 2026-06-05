'use client'

import { useRouter } from 'next/navigation'

interface BackButtonProps {
  href: string
}

export default function BackButton({ href }: BackButtonProps) {
  const router = useRouter()

  const handleBack = () => {
    const html = document.documentElement
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> }
    }

    if (doc.startViewTransition) {
      html.dataset.navBack = ''
      delete html.dataset.navForward
      doc.startViewTransition(() => {
        router.push(href)
      }).finished.finally(() => {
        delete html.dataset.navBack
      })
    } else {
      // Fallback: fix current page on top, navigate immediately
      const el = (document as Document).querySelector('.page-slide-in') as HTMLElement | null
      if (el) {
        el.style.position = 'fixed'
        el.style.inset = '0'
        el.style.width = '100%'
        el.style.zIndex = '50'
        el.style.backgroundColor = 'white'
        el.style.animation = 'slideOutRight 0.25s ease-in forwards'
      }
      router.push(href)
    }
  }

  return (
    <button onClick={handleBack} className="flex items-center text-gray-500">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
  )
}
