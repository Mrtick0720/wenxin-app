'use client'

import { useState, useEffect, useCallback } from 'react'
import BackButton from '@/app/components/BackButton'
import PageTransition from '@/app/components/PageTransition'
import { useStaff } from '@/app/components/StaffProvider'
import { supabase } from '@/lib/supabase/client'
import type { CurrentStaff } from '@/lib/auth/types'

type SessionRow = {
  id: number
  clock_in: string
  clock_out: string | null
  clock_method: string
  end_reason: string | null
  business_date: string
}

export default function AttendanceClient({
  staff,
  isManager,
}: {
  staff: CurrentStaff
  isManager: boolean
}) {
  const clientStaff = useStaff()
  const role = clientStaff?.role ?? staff.role
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

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleClockIn() {
    setActionLoading(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('clock_in_attendance', {
      _staff_user_id: staffUserId,
      _business_date: today,
    })
    if (rpcError) {
      setError(rpcError.message)
    } else {
      await loadData()
    }
    setActionLoading(false)
  }

  async function handleClockOut() {
    setActionLoading(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('clock_out_attendance', {
      _staff_user_id: staffUserId,
    })
    if (rpcError) {
      setError(rpcError.message)
    } else {
      await loadData()
    }
    setActionLoading(false)
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-MY', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kuching',
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
    <PageTransition>
      <main className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <BackButton href="/" />
            <span className="font-semibold text-base">Attendance</span>
          </div>
          {isManager && (
            <span className="text-xs text-gray-400">Manager View</span>
          )}
        </div>

        <div className="px-4 py-4 pb-8 space-y-4">
          {/* Clock In/Out Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="text-5xl mb-4">
              {hasOpenSession ? '🟢' : '⏰'}
            </div>

            {error && (
              <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            {hasOpenSession ? (
              <>
                <div className="text-sm font-semibold text-green-600 mb-1">
                  Clocked In
                </div>
                {todaySessions[0] && (
                  <div className="text-xs text-gray-400 mb-4">
                    Since {formatTime(todaySessions[0].clock_in)}
                  </div>
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
                <div className="text-sm font-semibold text-gray-700 mb-1">
                  Not Clocked In
                </div>
                <div className="text-xs text-gray-400 mb-4">
                  Start your shift
                </div>
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
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Today&apos;s Sessions
            </div>

            {loading && (
              <div className="text-center text-gray-400 py-4 text-sm">
                Loading...
              </div>
            )}

            {!loading && todaySessions.length === 0 && (
              <div className="text-center text-gray-400 py-4 text-sm">
                No sessions recorded today
              </div>
            )}

            {!loading && todaySessions.map((session, i) => (
              <div
                key={session.id}
                className={`flex items-center justify-between py-2.5 ${
                  i < todaySessions.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <div>
                  <div className="text-sm font-medium text-gray-800">
                    {formatTime(session.clock_in)}
                    {session.clock_out && ` — ${formatTime(session.clock_out)}`}
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatDuration(session.clock_in, session.clock_out)}
                    {session.end_reason === 'auto_closed' && ' · Auto-closed'}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    session.clock_out
                      ? 'bg-gray-100 text-gray-500'
                      : 'bg-green-100 text-green-600'
                  }`}
                >
                  {session.clock_out ? 'Closed' : 'Active'}
                </span>
              </div>
            ))}
          </div>

          {/* Manager view placeholder */}
          {isManager && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-700 mb-3">
                Team Attendance
              </div>
              <div className="text-center text-gray-400 py-4 text-sm">
                Not yet implemented — attendance board coming in next phase
              </div>
            </div>
          )}

          {/* Session History Placeholder */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Session History
            </div>
            <div className="text-center text-gray-400 py-4 text-sm">
              Not yet implemented — history view coming in next phase
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl p-4">
            <div className="text-xs text-blue-500">
              Attendance module foundation in place. Team board, shift management, and reporting are coming in the next phase.
            </div>
          </div>
        </div>
      </main>
    </PageTransition>
  )
}
