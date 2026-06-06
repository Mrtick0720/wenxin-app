'use client'

import { useRouter } from 'next/navigation'
import { useNavigation } from './NavigationStack'

interface BackButtonProps {
  href: string
}

export default function BackButton({ href }: BackButtonProps) {
  const { pop, canPop } = useNavigation()
  const router = useRouter()

  const handleBack = () => {
    if (canPop) {
      pop()
    } else {
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
