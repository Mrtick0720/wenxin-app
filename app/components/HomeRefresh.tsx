'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PullToRefresh from './PullToRefresh'
import { refreshHomeData } from '@/app/actions'
import { preloadRoutes } from '@/app/lib/stackPages'

export default function HomeRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  // Preload all secondary page chunks after homepage mounts.
  // This ensures the first navigation shows the full page during slide-in
  // instead of a blank Suspense fallback while the chunk loads.
  useEffect(() => {
    const id = setTimeout(() => preloadRoutes(), 100)
    return () => clearTimeout(id)
  }, [])

  async function handleRefresh() {
    await refreshHomeData()
    router.refresh()
    await new Promise(resolve => setTimeout(resolve, 800))
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      {children}
    </PullToRefresh>
  )
}
