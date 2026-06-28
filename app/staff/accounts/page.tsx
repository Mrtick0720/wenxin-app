import BackButton from '@/app/components/BackButton'
import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import StaffAccountsClient, { type StaffAccountRow } from './StaffAccountsClient'

export default async function StaffAccountsPage() {
  const owner = await requireRole('owner')
  const supabase = await createServerSupabaseClient()
  const now = new Date().toISOString()

  const [{ data: profiles }, { data: sessions }] = await Promise.all([
    supabase
      .from('staff_profiles')
      .select('id,staff_id,display_name,role,active,archived,archive_date,archive_reason,last_login_at,created_at,phone,address,notes,fixed_off_weekday')
      .order('display_name'),
    supabase
      .from('staff_sessions')
      .select('staff_user_id,ended_at,expires_at')
      .is('ended_at', null)
      .gt('expires_at', now),
  ])

  const activeUserIds = new Set((sessions || []).map(s => s.staff_user_id))
  const accounts: StaffAccountRow[] = (profiles ?? []).map(profile => ({
    id: profile.id,
    staff_id: profile.staff_id,
    display_name: profile.display_name,
    role: profile.role,
    active: profile.active,
    last_login_at: profile.last_login_at,
    archived: profile.archived ?? false,
    archive_date: profile.archive_date ?? null,
    archive_reason: profile.archive_reason ?? null,
    session_active: activeUserIds.has(profile.id),
    created_at: profile.created_at ?? null,
    phone: profile.phone ?? null,
    address: profile.address ?? null,
    notes: profile.notes ?? null,
    fixed_off_weekday: profile.fixed_off_weekday ?? null,
  }))

  return (
    <main className="page-slide-in min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-white px-4 py-3">
        <BackButton href="/staff" />
        <h1 className="text-base font-semibold text-gray-900">Staff Accounts</h1>
      </header>
      <div
        className="mx-auto max-w-3xl px-4 py-4"
        style={{ paddingBottom: 'calc(112px + env(safe-area-inset-bottom, 0px))' }}
      >
        <StaffAccountsClient accounts={accounts} ownerId={owner.id} />
      </div>
    </main>
  )
}
