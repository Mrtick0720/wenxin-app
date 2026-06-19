'use client'

import { useEffect } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

let channelSeq = 0

export function useReservationsRealtime(onChanged: () => void) {
  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    // Unique channel name per mount — prevents collisions when the hook
    // is used in multiple components (page list + HomeBell notification).
    const name = `reservations_changes_${++channelSeq}`

    const channel = supabase
      .channel(name)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        () => onChanged(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [onChanged])
}
