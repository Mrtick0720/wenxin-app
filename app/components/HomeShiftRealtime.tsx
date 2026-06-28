'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { useStaff } from './StaffProvider'

/**
 * Subscribes to staff_shifts changes for the CURRENT user and refreshes the
 * Home page so the "My Today's Shift" card stays in sync when an owner/manager
 * edits this person's schedule from another session.
 *
 * NOTE: requires the `staff_shifts` table to be in the `supabase_realtime`
 * publication. If it isn't, the subscription is harmless but silently inert,
 * and the card only updates on pull-to-refresh.
 */
export default function HomeShiftRealtime() {
  const router = useRouter()
  const staff = useStaff()
  const staffId = staff?.id

  useEffect(() => {
    if (!staffId) return
    const supabase = createBrowserSupabaseClient()

    const channel = supabase
      .channel(`home_staff_shifts_${staffId}_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff_shifts', filter: `staff_id=eq.${staffId}` },
        () => router.refresh(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router, staffId])

  return null
}
