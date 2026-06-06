import BackButton from '@/app/components/BackButton'
import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import ActivityLogClient, { type AuditRow, type SessionRow } from './ActivityLogClient'

export default async function ActivityLogPage() {
  await requireRole('owner')
  const supabase = await createServerSupabaseClient()
  const [{ data: audits }, { data: sessions }] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('id,actor_staff_id,action,entity_type,entity_id,summary,before_data,after_data,created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('staff_sessions')
      .select('id,staff_id,started_at,last_seen_at,expires_at,ended_at,end_reason,device_summary')
      .order('started_at', { ascending: false })
      .limit(200),
  ])

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-white px-4 py-3">
        <BackButton href="/staff" />
        <div>
          <h1 className="text-base font-semibold text-gray-900">Activity Log</h1>
          <p className="text-xs text-gray-400">Sessions and important changes</p>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-4 pb-12">
        <ActivityLogClient
          audits={(audits || []) as AuditRow[]}
          sessions={(sessions || []) as SessionRow[]}
        />
      </div>
    </main>
  )
}
