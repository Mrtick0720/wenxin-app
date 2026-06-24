'use client'

import { useEffect, useRef } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

let channelSeq = 0

/** Subscribes to purchase_items and purchase_checklist changes. Calls onChanged() on any event. */
export function usePurchaseRealtime(onChanged: () => void) {
  const onChangedRef = useRef(onChanged)

  useEffect(() => {
    onChangedRef.current = onChanged
  }, [onChanged])

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    const name = `purchase_changes_${++channelSeq}`

    const channel = supabase
      .channel(name)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_items' },
        () => { onChangedRef.current() },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_checklist' },
        () => { onChangedRef.current() },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, []) // stable — ref always points to latest callback; no churn on ctx/filter changes
}
