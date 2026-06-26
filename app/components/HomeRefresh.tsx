'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PullToRefresh from './PullToRefresh'
import { refreshHomeData } from '@/app/actions'
import { loadPurchaseClient, loadBentoClient, loadInventoryPage, loadStaffPage } from '@/app/lib/stackPages'
import { preloadStaggered } from '@/lib/routePreload'

// Preload order — most-used first. Each entry fires 2s after the previous one,
// starting 2s after Home becomes idle. Only the JS chunk is fetched; no component
// mounts and no data queries run until the user actually navigates to the page.
const PRELOAD_LOADERS = [
  loadPurchaseClient, // T+2s
  loadBentoClient,    // T+4s
  loadInventoryPage,  // T+6s
  loadStaffPage,      // T+8s
]

export default function HomeRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    // preloadStaggered returns a cancel fn that clears any pending timers.
    // If the user navigates away before a timer fires the import is still safe
    // (idempotent), but cancelling avoids unnecessary work on fast navigation.
    const cancel = preloadStaggered(PRELOAD_LOADERS, 2000, 2000)
    return cancel
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
