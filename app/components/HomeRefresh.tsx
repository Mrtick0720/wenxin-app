'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PullToRefresh from './PullToRefresh'
import { refreshHomeData } from '@/app/actions'
import { preloadRoutes } from '@/app/lib/stackPages'

export default function HomeRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  // Preload the Purchase chunk after homepage mounts so its first tab switch
  // can show the real cached shell without competing with Home's initial load.
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
