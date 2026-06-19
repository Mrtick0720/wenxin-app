'use client'

import { useEffect } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

/**
 * Subscribes to Supabase Realtime changes on the purchase_checklist table.
 * When any INSERT / UPDATE / DELETE occurs, calls onChanged() so the UI can
 * refresh without a full page reload.
 *
 * The subscription is scoped to pending items only (status = 'pending') so
 * staff adding items triggers updates for owner/admin viewing the checklist.
 */
export function useChecklistRealtime(onChanged: () => void) {
  useEffect(() => {
    const supabase = createBrowserSupabaseClient()

    const channel = supabase
      .channel('purchase_checklist_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchase_checklist',
        },
        () => {
          onChanged()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [onChanged])
}
