'use client'

import { useEffect } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

let channelSeq = 0

/** Subscribes to purchase_items changes. Call onChanged() on any INSERT/UPDATE/DELETE. */
export function usePurchaseRealtime(onChanged: () => void) {
  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    const name = `purchase_items_changes_${++channelSeq}`

    const channel = supabase
      .channel(name)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_items' },
        () => onChanged(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [onChanged])
}
