'use client'

import { useEffect, useState } from 'react'
import NavLink from '../NavLink'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { todayLocalStr } from '@/lib/dateUtils'

type ShiftEntry = {
  id: string
  name: string
  role: string
  clockIn: string | null   // HH:MM from clock_in timestamp
}

export default function ShiftBoardCard() {
  const [staff, setStaff] = useState<ShiftEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const supabase = createBrowserSupabaseClient()
    const today = todayLocalStr()

    async function load() {
      // Fetch staff who have an open attendance session today
      const { data: sessions, error } = await supabase
        .from('attendance_sessions')
        .select('staff_user_id,clock_in')
        .eq('business_date', today)
        .is('clock_out', null)
        .order('clock_in', { ascending: true })

      if (error || !sessions || sessions.length === 0) {
        if (active) setLoading(false)
        return
      }

      const staffIds = [...new Set(sessions.map(s => s.staff_user_id))]

      const { data: profiles } = await supabase
        .from('staff_profiles')
        .select('id,display_name,role')
        .in('id', staffIds)
        .eq('active', true)

      const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
      const earliestByStaff = new Map<string, string>()
      for (const s of sessions) {
        if (!earliestByStaff.has(s.staff_user_id)) {
          const t = new Date(s.clock_in)
          earliestByStaff.set(s.staff_user_id, `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`)
        }
      }

      const entries: ShiftEntry[] = staffIds
        .map(id => {
          const p = profileMap.get(id)
          if (!p) return null
          return { id, name: p.display_name, role: p.role, clockIn: earliestByStaff.get(id) ?? null }
        })
        .filter((e): e is ShiftEntry => e !== null)

      if (active) {
        setStaff(entries)
        setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [])


  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-sm font-semibold text-gray-800">Shift Board</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
        </svg>
      </div>
      <div className="space-y-2">
        {loading ? (
          <div className="bg-white rounded-2xl px-4 py-6 text-center text-sm text-gray-400 shadow-sm">
            Loading…
          </div>
        ) : staff.length === 0 ? (
          <div className="bg-white rounded-2xl px-4 py-6 text-center text-sm text-gray-400 shadow-sm">
            No one clocked in yet
          </div>
        ) : (
          staff.map((entry) => (
            <NavLink key={entry.id} href="/staff" className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 block">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900 truncate">{entry.name}</span>
                <span className="block text-xs text-gray-500 truncate mt-0.5">
                  {entry.role}{entry.clockIn ? ` · since ${entry.clockIn}` : ''}
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
