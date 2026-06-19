'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

/**
 * Subscribes to reservations table changes and refreshes the Home page
 * so the Reservations KPI card count stays in sync across devices.
 */
export default function HomeReservationsRealtime() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()

    // Unique name in case multiple instances mount (e.g. page + bell)
    const channel = supabase
      .channel(`home_reservations_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        () => router.refresh(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  return null
}
