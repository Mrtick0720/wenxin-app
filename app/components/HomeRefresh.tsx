'use client'

import { useRouter } from 'next/navigation'
import PullToRefresh from './PullToRefresh'
import { refreshHomeData } from '@/app/actions'

export default function HomeRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()

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
