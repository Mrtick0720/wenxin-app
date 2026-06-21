'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { useNavigation } from './NavigationStack'

/**
 * Subscribes to purchase_items table changes and refreshes the Home page
 * so the Payables card and Purchase Checklist badge stay in sync.
 * Also refreshes when navigating back to home (stack clears).
 */
export default function HomePurchaseRealtime() {
  const router = useRouter()
  const { canPop } = useNavigation()
  const prevCanPop = useRef(canPop)

  // Refresh when the navigation stack clears (user returns to home)
  useEffect(() => {
    if (prevCanPop.current && !canPop) {
      router.refresh()
    }
    prevCanPop.current = canPop
  }, [canPop, router])

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()

    const channel = supabase
      .channel(`home_purchase_items_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_items' },
        () => router.refresh(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  return null
}
