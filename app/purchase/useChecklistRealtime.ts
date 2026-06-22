'use client'

import { useEffect, useRef } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

export function useChecklistRealtime(onChanged: () => void) {
  const onChangedRef = useRef(onChanged)
  onChangedRef.current = onChanged

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    const channel = supabase
      .channel('purchase_checklist_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_checklist' },
        () => { onChangedRef.current() },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, []) // stable — ref always points to latest callback
}
