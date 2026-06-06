import BackButton from '@/app/components/BackButton'
import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import StaffAccountsClient, { type StaffAccountRow } from './StaffAccountsClient'
import type { StaffRole } from '@/lib/auth/types'

type ProfileRow = {
  id: string
  staff_id: string
  display_name: string
  role: StaffRole
  active: boolean
  last_login_at: string | null
}

export default async function StaffAccountsPage() {
  const owner = await requireRole('owner')
  const supabase = await createServerSupabaseClient()
  const now = new Date().toISOString()
  const [{ data: profiles }, { data: sessions }] = await Promise.all([
    supabase
      .from('staff_profiles')
      .select('id,staff_id,display_name,role,active,last_login_at')
      .order('display_name'),
    supabase
      .from('staff_sessions')
      .select('staff_user_id,ended_at,expires_at')
      .is('ended_at', null)
      .gt('expires_at', now),
  ])

  const activeUserIds = new Set((sessions || []).map(session => session.staff_user_id))
  const accounts: StaffAccountRow[] = ((profiles || []) as ProfileRow[]).map(profile => ({
    ...profile,
    session_active: activeUserIds.has(profile.id),
  }))

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-white px-4 py-3">
        <BackButton href="/staff" />
        <div>
          <h1 className="text-base font-semibold text-gray-900">Staff Accounts</h1>
          <p className="text-xs text-gray-400">{accounts.length} accounts</p>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-4 pb-12">
        <StaffAccountsClient accounts={accounts} ownerId={owner.id} />
      </div>
    </main>
  )
}
