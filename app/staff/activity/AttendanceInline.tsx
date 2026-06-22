'use client'

import { useState, useEffect, useCallback } from 'react'
import { useStaff } from '@/app/components/StaffProvider'
import { supabase } from '@/lib/supabase/client'
import type { CurrentStaff } from '@/lib/auth/types'
import { CenteredSpinner } from '@/app/components/Spinner'

type SessionRow = {
  id: number
  clock_in: string
  clock_out: string | null
  clock_method: string
  end_reason: string | null
  business_date: string
}

export default function AttendanceInline({
  staff,
  isManager,
}: {
  staff: CurrentStaff
  isManager: boolean
}) {
  const clientStaff = useStaff()
  const staffUserId = clientStaff?.id ?? staff.id

  const [hasOpenSession, setHasOpenSession] = useState(false)
  const [todaySessions, setTodaySessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('staff_user_id', staffUserId)
      .eq('business_date', today)
      .order('clock_in', { ascending: false })

    const sessions = (data ?? []) as SessionRow[]
    setTodaySessions(sessions)
    setHasOpenSession(sessions.some(s => !s.clock_out))
    setLoading(false)
  }, [staffUserId, today])

  useEffect(() => { loadData() }, [loadData])

  async function handleClockIn() {
    setActionLoading(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('clock_in_attendance', {
      _staff_user_id: staffUserId,
      _business_date: today,
    })
    if (rpcError) setError(rpcError.message)
    else await loadData()
    setActionLoading(false)
  }

  async function handleClockOut() {
    setActionLoading(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('clock_out_attendance', {
      _staff_user_id: staffUserId,
    })
    if (rpcError) setError(rpcError.message)
    else await loadData()
    setActionLoading(false)
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-MY', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuching',
    })
  }

  function formatDuration(clockIn: string, clockOut: string | null) {
    if (!clockOut) return 'Active'
    const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime()
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.round((ms % 3600000) / 60000)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  return (
    <div className="px-4 pt-4 pb-28 space-y-4">
      {/* Clock In/Out Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
        <div className="text-5xl mb-4">{hasOpenSession ? '🟢' : '⏰'}</div>
        {error && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}
        {hasOpenSession ? (
          <>
            <div className="text-sm font-semibold text-green-600 mb-1">Clocked In</div>
            {todaySessions[0] && (
              <div className="text-xs text-gray-400 mb-4">Since {formatTime(todaySessions[0].clock_in)}</div>
            )}
            <button
              onClick={handleClockOut}
              disabled={actionLoading}
              className="w-full py-3 bg-orange-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {actionLoading ? 'Clocking Out...' : 'Clock Out'}
            </button>
          </>
        ) : (
          <>
            <div className="text-sm font-semibold text-gray-700 mb-1">Not Clocked In</div>
            <div className="text-xs text-gray-400 mb-4">Start your shift</div>
            <button
              onClick={handleClockIn}
              disabled={actionLoading}
              className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {actionLoading ? 'Clocking In...' : 'Clock In'}
            </button>
          </>
        )}
      </div>

      {/* Today's Sessions */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="text-sm font-semibold text-gray-700 mb-3">Today&apos;s Sessions</div>
        {loading && <CenteredSpinner />}
        {!loading && todaySessions.length === 0 && (
          <div className="text-center text-gray-400 py-4 text-sm">No sessions recorded today</div>
        )}
        {!loading && todaySessions.map((session, i) => (
          <div key={session.id} className={`flex items-center justify-between py-2.5 ${i < todaySessions.length - 1 ? 'border-b border-gray-100' : ''}`}>
            <div>
              <div className="text-sm font-medium text-gray-800">
                {formatTime(session.clock_in)}{session.clock_out && ` — ${formatTime(session.clock_out)}`}
              </div>
              <div className="text-xs text-gray-400">
                {formatDuration(session.clock_in, session.clock_out)}
                {session.end_reason === 'auto_closed' && ' · Auto-closed'}
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${session.clock_out ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-600'}`}>
              {session.clock_out ? 'Closed' : 'Active'}
            </span>
          </div>
        ))}
      </div>

      {/* Team Attendance Board (Manager only) */}
      {isManager && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-semibold text-gray-700 mb-3">Team Attendance</div>
          <div className="text-center text-gray-400 py-8 text-sm">
            <div className="text-3xl mb-2">👥</div>
            Team attendance board will load here when connected to the database.<br />
            Staff grouped by status: Present · Late · Pending · Absent · Off · On Leave
          </div>
        </div>
      )}

      {/* Session History */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="text-sm font-semibold text-gray-700 mb-3">Session History</div>
        <div className="text-center text-gray-400 py-4 text-sm">
          <div className="mb-2">View past sessions by date range</div>
          <div className="flex gap-2 justify-center">
            <input type="date" defaultValue={today} disabled className="h-9 rounded-lg border border-gray-200 bg-gray-50 px-2 text-xs text-gray-400" />
            <span className="text-gray-300 self-center">—</span>
            <input type="date" defaultValue={today} disabled className="h-9 rounded-lg border border-gray-200 bg-gray-50 px-2 text-xs text-gray-400" />
          </div>
          <div className="mt-3 text-xs text-gray-400">History view available when connected to the database</div>
        </div>
      </div>

      {/* Corrections (Manager/Owner only) */}
      {isManager && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-semibold text-gray-700 mb-3">Corrections</div>
          <div className="text-center text-gray-400 py-4 text-sm">
            <div className="mb-1">Manual correction of clock-in/out times</div>
            <div className="text-xs">Available for Owner and Manager roles</div>
            <div className="mt-2 space-y-1">
              <button disabled className="w-full py-2 bg-gray-100 text-gray-400 rounded-xl text-xs font-medium cursor-not-allowed">✏️ Correct Session Times</button>
              <button disabled className="w-full py-2 bg-gray-100 text-gray-400 rounded-xl text-xs font-medium cursor-not-allowed">🔒 Close Forgotten Session</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
