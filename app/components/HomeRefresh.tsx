'use client'

import { useRouter } from 'next/navigation'
import PullToRefresh from './PullToRefresh'

export default function HomeRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  async function handleRefresh() {
    router.refresh()
    await new Promise(resolve => setTimeout(resolve, 800))
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      {children}
    </PullToRefresh>
  )
}
