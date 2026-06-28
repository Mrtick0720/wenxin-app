'use client'

import { useEffect, useState } from 'react'
import { useStaff } from '@/app/components/StaffProvider'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import StaffAccountsClient, { type StaffAccountRow } from './StaffAccountsClient'
import BackButton from '@/app/components/BackButton'

export default function StaffAccountsStack() {
  const staff = useStaff()
  const [accounts, setAccounts] = useState<StaffAccountRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!staff || staff.role !== 'owner') return

    const supabase = createBrowserSupabaseClient()
    const now = new Date().toISOString()

    Promise.all([
      supabase
        .from('staff_profiles')
        .select('id,staff_id,display_name,role,active,archived,archive_date,archive_reason,last_login_at,created_at,phone,address,notes,fixed_off_weekday')
        .order('display_name'),
      supabase
        .from('staff_sessions')
        .select('staff_user_id,ended_at,expires_at')
        .is('ended_at', null)
        .gt('expires_at', now),
    ]).then(([{ data: profiles, error: profilesError }, { data: sessions }]) => {
      if (profilesError) { setError('Failed to load accounts.'); return }
      const activeUserIds = new Set((sessions || []).map(s => s.staff_user_id))
      const rows: StaffAccountRow[] = (profiles ?? []).map(p => ({
        id: p.id,
        staff_id: p.staff_id,
        display_name: p.display_name,
        role: p.role,
        active: p.active,
        archived: p.archived ?? false,
        archive_date: p.archive_date ?? null,
        archive_reason: p.archive_reason ?? null,
        last_login_at: p.last_login_at ?? null,
        session_active: activeUserIds.has(p.id),
        created_at: p.created_at ?? null,
        phone: p.phone ?? null,
        address: p.address ?? null,
        notes: p.notes ?? null,
        fixed_off_weekday: p.fixed_off_weekday ?? null,
      }))
      setAccounts(rows)
    })
  }, [staff])

  if (!staff || staff.role !== 'owner') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Access denied.</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-red-500">{error}</p>
      </main>
    )
  }

  return (
    <main className="h-full flex flex-col bg-gray-50">
      <header className="flex-shrink-0 flex items-center gap-3 border-b bg-white px-4 py-3">
        <BackButton href="/staff" />
        <h1 className="text-base font-semibold text-gray-900">Staff Accounts</h1>
      </header>
      <div
        className="flex-1 min-h-0 overflow-y-auto w-full mx-auto max-w-3xl px-4 py-4"
        style={{ paddingBottom: 'calc(112px + env(safe-area-inset-bottom, 0px))' }}
      >
        {accounts === null ? (
          <div className="flex items-center justify-center pt-20">
            <p className="text-sm text-gray-400">Loading…</p>
          </div>
        ) : (
          <StaffAccountsClient accounts={accounts} ownerId={staff.id} />
        )}
      </div>
    </main>
  )
}
