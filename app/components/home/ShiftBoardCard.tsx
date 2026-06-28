'use client'

// Owner/manager Home glance into today's attendance. Shows In / Out / Absent
// counts plus the staff currently on duty, and deep-links to the full board at
// Staff → Attendance. Numbers come from the same computeTeamAttendance used by
// the full board, so the glance and the board never disagree.

import { useEffect, useState, useCallback } from 'react'
import NavLink from '../NavLink'
import { supabase } from '@/lib/supabase/client'
import { todayLocalStr } from '@/lib/dateUtils'
import {
  computeTeamAttendance, formatClock,
  type TeamAttendance, type SessionLite, type ShiftLite,
} from '@/lib/attendance/teamToday'

const ATTENDANCE_HREF = '/staff?tab=attendance'

export default function ShiftBoardCard() {
  const [data, setData] = useState<TeamAttendance | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const today = todayLocalStr()
    const [profilesRes, sessionsRes, shiftsRes] = await Promise.all([
      supabase.from('staff_profiles').select('id,display_name,role').eq('active', true).eq('archived', false),
      supabase.from('attendance_sessions').select('staff_user_id,clock_in,clock_out').eq('business_date', today),
      supabase.from('staff_shifts').select('staff_id,shift_type').eq('shift_date', today),
    ])
    const staff = (profilesRes.data ?? []).map(p => ({
      id: p.id as string, name: p.display_name as string, role: p.role as string,
    }))
    const sessions = (sessionsRes.data ?? []) as unknown as SessionLite[]
    const shifts = (shiftsRes.data ?? []) as unknown as ShiftLite[]
    setData(computeTeamAttendance(staff, sessions, shifts))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const onDuty = data?.members.filter(m => m.state === 'in') ?? []

  return (
    <div>
      <NavLink href={ATTENDANCE_HREF} className="flex items-center justify-between mb-2 px-1">
        <span className="text-sm font-semibold text-gray-800">Shift Board</span>
        <span className="text-xs text-gray-400">View all ›</span>
      </NavLink>

      {data && (
        <NavLink href={ATTENDANCE_HREF} className="grid grid-cols-3 gap-2 mb-2 block">
          <Stat n={data.summary.in} label="In" color="text-green-600" bg="bg-green-50" />
          <Stat n={data.summary.out} label="Out" color="text-gray-500" bg="bg-gray-100" />
          <Stat n={data.summary.absent} label="Absent" color="text-red-500" bg="bg-red-50" />
        </NavLink>
      )}

      <div className="space-y-2">
        {loading ? (
          <div className="bg-white rounded-2xl px-4 py-6 text-center text-sm text-gray-400 shadow-sm">
            Loading…
          </div>
        ) : onDuty.length === 0 ? (
          <div className="bg-white rounded-2xl px-4 py-6 text-center text-sm text-gray-400 shadow-sm">
            No one clocked in yet
          </div>
        ) : (
          onDuty.map((entry) => (
            <NavLink key={entry.id} href={ATTENDANCE_HREF} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 block">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900 truncate">{entry.name}</span>
                <span className="block text-xs text-gray-500 truncate mt-0.5 capitalize">
                  {entry.role}{entry.firstIn ? ` · since ${formatClock(entry.firstIn)}` : ''}
                </span>
              </span>
              <span className="flex-shrink-0 text-xs font-medium rounded-full px-2.5 py-1 bg-green-50 text-green-600">
                On Duty
              </span>
            </NavLink>
          ))
        )}
      </div>
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
