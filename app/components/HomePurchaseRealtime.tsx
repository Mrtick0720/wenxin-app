'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

/**
 * Subscribes to purchase_items table changes and refreshes the Home page
 * so the Payables card and Purchase Checklist badge stay in sync.
 */
export default function HomePurchaseRealtime() {
  const router = useRouter()

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
