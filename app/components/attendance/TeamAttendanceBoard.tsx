'use client'

// Owner/manager "Team Attendance" board — shows every active staff member's
// clock state for a business day (In / Out / Absent / Leave / Off) with
// clock-in/out times and worked duration. Rendered inside Staff → Attendance.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { CenteredSpinner } from '@/app/components/Spinner'
import {
  computeTeamAttendance, formatClock, formatDurationMs,
  type TeamAttendance, type TeamAttendanceState,
  type SessionLite, type ShiftLite,
} from '@/lib/attendance/teamToday'

const STATE_BADGE: Record<TeamAttendanceState, { label: string; bg: string; text: string }> = {
  in:     { label: 'In',     bg: 'bg-green-100', text: 'text-green-700' },
  out:    { label: 'Out',    bg: 'bg-gray-100',  text: 'text-gray-500'  },
  absent: { label: 'Absent', bg: 'bg-red-100',   text: 'text-red-600'   },
  leave:  { label: 'Leave',  bg: 'bg-amber-100', text: 'text-amber-700' },
  off:    { label: 'Off',    bg: 'bg-gray-100',  text: 'text-gray-400'  },
}

export default function TeamAttendanceBoard({ businessDate }: { businessDate: string }) {
  const [data, setData] = useState<TeamAttendance | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [profilesRes, sessionsRes, shiftsRes] = await Promise.all([
      supabase.from('staff_profiles').select('id,display_name,role').eq('active', true).eq('archived', false),
      supabase.from('attendance_sessions').select('staff_user_id,clock_in,clock_out').eq('business_date', businessDate),
      supabase.from('staff_shifts').select('staff_id,shift_type').eq('shift_date', businessDate),
    ])
    const staff = (profilesRes.data ?? []).map(p => ({
      id: p.id as string, name: p.display_name as string, role: p.role as string,
    }))
    const sessions = (sessionsRes.data ?? []) as unknown as SessionLite[]
    const shifts = (shiftsRes.data ?? []) as unknown as ShiftLite[]
    setData(computeTeamAttendance(staff, sessions, shifts))
    setLoading(false)
  }, [businessDate])

  useEffect(() => { load() }, [load])

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-gray-700">Team Attendance</div>
        <button
          onClick={() => { setLoading(true); load() }}
          className="text-xs font-medium text-orange-500 active:opacity-70"
        >
          Refresh
        </button>
      </div>

      {loading && <CenteredSpinner />}

      {!loading && data && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat n={data.summary.in} label="In" color="text-green-600" bg="bg-green-50" />
            <Stat n={data.summary.out} label="Out" color="text-gray-500" bg="bg-gray-50" />
            <Stat n={data.summary.absent} label="Absent" color="text-red-500" bg="bg-red-50" />
          </div>

          {data.members.length === 0 ? (
            <div className="text-center text-gray-400 py-4 text-sm">No staff found</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.members.map(m => {
                const badge = STATE_BADGE[m.state]
                let detail = ''
                if (m.state === 'in' && m.firstIn) detail = `Since ${formatClock(m.firstIn)}`
                else if (m.state === 'out') {
                  const range = `${m.firstIn ? formatClock(m.firstIn) : '—'}–${m.lastOut ? formatClock(m.lastOut) : '—'}`
                  detail = `${range} · ${formatDurationMs(m.totalMs)}`
                }
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{m.name}</div>
                      <div className="text-xs text-gray-400 truncate capitalize">
                        {m.role}{detail ? ` · ${detail}` : ''}
                      </div>
                    </div>
                    <span className={`flex-shrink-0 text-xs font-semibold rounded-full px-2.5 py-0.5 ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ n, label, color, bg }: { n: number; label: string; color: string; bg: string }) {
  return (
    <div className={`rounded-xl ${bg} py-2 flex flex-col items-center`}>
      <span className={`text-lg font-bold leading-none ${color}`}>{n}</span>
      <span className="text-[11px] text-gray-500 mt-0.5">{label}</span>
    </div>
  )
}
