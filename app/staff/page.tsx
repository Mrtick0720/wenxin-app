'use client'

import { lazy, useRef, useState, useEffect, useCallback } from 'react'
import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'
import DatePicker from '../components/DatePicker'
import { FullPageSpinner } from '../components/Spinner'
import { useNavigation } from '../components/NavigationStack'

const StaffAccountsStack = lazy(() => import('./accounts/StaffAccountsStack'))
import ShiftEditorSheet from './ShiftEditorSheet'
import { useStaff } from '../components/StaffProvider'
import { todayLocalStr } from '@/lib/dateUtils'
import { canViewAllAttendance, canViewOwnAttendance } from '@/lib/attendance/permissions'
import AttendanceInline from './activity/AttendanceInline'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { ShiftType } from '@/lib/attendance/types'

type Tab = 'schedule' | 'attendance'

// ─── Role sort order — maps role to numeric priority (lower = first) ────────
const ROLE_ORDER: Record<string, number> = {
  owner:      0,
  manager:    1,
  kitchen:    2,
  front_desk: 3,
  cashier:    3,
  server:     3,
  packing:    4,
  delivery:   4,
  other:      5,
}

function sortByRole(a: { role: string; name: string }, b: { role: string; name: string }): number {
  const aOrder = ROLE_ORDER[a.role] ?? 5
  const bOrder = ROLE_ORDER[b.role] ?? 5
  if (aOrder !== bOrder) return aOrder - bOrder
  return a.name.localeCompare(b.name)
}

// ─── Roster entry — real staff + shift data ─────────────────────────────────
type RosterEntry = {
  id: string
  name: string
  role: string
  avatar: string
  shiftType: ShiftType | null      // from staff_shifts
  shiftLabel: string | null        // custom time label
  clockedIn: boolean               // open attendance session today
}

// Shift display config
const shiftDisplay: Record<ShiftType, { label: string; bg: string; text: string }> = {
  morning:   { label: 'Morning',    bg: 'bg-blue-100',   text: 'text-blue-600'   },
  full_day:  { label: 'Full Day',   bg: 'bg-green-100',  text: 'text-green-600'  },
  afternoon: { label: 'Afternoon',  bg: 'bg-purple-100', text: 'text-purple-600' },
  off:       { label: 'Off',        bg: 'bg-gray-100',   text: 'text-gray-400'   },
  leave:     { label: 'Leave',      bg: 'bg-orange-100', text: 'text-orange-500' },
}

function shiftPill(entry: RosterEntry) {
  if (entry.shiftType) {
    const cfg = shiftDisplay[entry.shiftType]
    const label = entry.shiftLabel || cfg.label
    return { label, bg: cfg.bg, text: cfg.text }
  }
  // No shift assigned — fall back to attendance status
  if (entry.clockedIn) {
    return { label: 'Clocked In', bg: 'bg-green-100', text: 'text-green-600' }
  }
  return { label: 'Not Clocked In', bg: 'bg-gray-100', text: 'text-gray-400' }
}

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function summaryForRoster(entries: RosterEntry[]) {
  const working = entries.filter(e => e.shiftType && e.shiftType !== 'off' && e.shiftType !== 'leave').length
  const onLeave = entries.filter(e => e.shiftType === 'leave').length
  const off = entries.filter(e => !e.shiftType || e.shiftType === 'off').length
  return { working, onLeave, off, total: entries.length }
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const staff = useStaff()
  const { push } = useNavigation()
  const isOwnerOrManager = staff?.role === 'owner' || staff?.role === 'manager'
  const canAttendance = staff ? canViewOwnAttendance(staff.role) : false
  const isManager = staff ? canViewAllAttendance(staff.role) : false

  const today = todayLocalStr()
  const [tab, setTab] = useState<Tab>('schedule')
  const [selectedDate, setSelectedDate] = useState(today)
  const datepickerAreaRef = useRef<HTMLDivElement>(null)

  // ── Real staff roster from staff_profiles + staff_shifts + attendance ──
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [rosterLoading, setRosterLoading] = useState(true)

  const loadRoster = useCallback(async (date: string) => {
    const supabase = createBrowserSupabaseClient()

    const [profilesRes, shiftsRes, sessionsRes] = await Promise.all([
      supabase.from('staff_profiles')
        .select('id,display_name,role')
        .eq('active', true)
        .eq('archived', false),
      supabase.from('staff_shifts')
        .select('staff_id,shift_type,time_label')
        .eq('shift_date', date),
      supabase.from('attendance_sessions')
        .select('staff_user_id')
        .eq('business_date', date)
        .is('clock_out', null),
    ])

    const profiles = profilesRes.data ?? []
    const shiftMap = new Map<string, { shiftType: ShiftType; shiftLabel: string }>(
      (shiftsRes.data ?? []).map((s: Record<string, unknown>) => [
        s.staff_id as string,
        { shiftType: s.shift_type as ShiftType, shiftLabel: (s.time_label as string) || '' },
      ]),
    )
    const clockedInIds = new Set((sessionsRes.data ?? []).map((s: Record<string, unknown>) => s.staff_user_id as string))

    const entries: RosterEntry[] = profiles.map((p: Record<string, unknown>) => {
      const id = p.id as string
      const shift = shiftMap.get(id)
      return {
        id,
        name: p.display_name as string,
        role: p.role as string,
        avatar: ((p.display_name as string) ?? '?').charAt(0).toUpperCase(),
        shiftType: shift?.shiftType ?? null,
        shiftLabel: shift?.shiftLabel || null,
        clockedIn: clockedInIds.has(id),
      }
    })

    entries.sort(sortByRole)
    return entries
  }, [])

  useEffect(() => {
    let active = true
    async function refresh() {
      if (active) setRosterLoading(true)
      const entries = await loadRoster(selectedDate)
      if (active) { setRoster(entries); setRosterLoading(false) }
    }
    refresh()
    return () => { active = false }
  }, [selectedDate, loadRoster])

  // ── Shift editor state ──────────────────────────────────────────────────
  const [editingEntry, setEditingEntry] = useState<RosterEntry | null>(null)

  const selectedDateObj = new Date(selectedDate + 'T00:00:00')
  const selectedLabel = `${weekdays[selectedDateObj.getDay()]}, ${months[selectedDateObj.getMonth()]} ${selectedDateObj.getDate()}`
  const isSelectedToday = selectedDate === today

  const { working, onLeave, off, total } = summaryForRoster(roster)

  function openAccounts() {
    push('/staff/accounts', <StaffAccountsStack />)
  }

  return (
    <PageTransition>
    <main className="bg-gray-50 w-full mx-auto min-h-screen">

      {/* ── Header ── */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <BackButton href="/" />
          <span className="font-semibold text-base">Staff</span>
        </div>
        {isOwnerOrManager && (
          <button
            onClick={openAccounts}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:bg-gray-200"
            aria-label="Staff accounts"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </button>
        )}
      </div>

      {/* ── Segmented control + date picker + metrics ── */}
      <div className="bg-white sticky top-[49px] z-10 px-4 pt-2">
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setTab('schedule')}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              tab === 'schedule' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'
            }`}
          >
            Schedule
          </button>
          {canAttendance && (
            <button
              onClick={() => setTab('attendance')}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                tab === 'attendance' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'
              }`}
            >
              Attendance
            </button>
          )}
        </div>

        {tab === 'schedule' && (
          <>
            <div ref={datepickerAreaRef} className="pt-3">
              <DatePicker selectedDate={selectedDate} onDateChange={setSelectedDate} />
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-4 gap-2 pt-3 pb-3">
              <div className="rounded-2xl flex flex-col items-center justify-center py-3 gap-0.5" style={{ backgroundColor: '#f0fdf4' }}>
                <span className="text-xl font-bold leading-none" style={{ color: '#16a34a' }}>{working}</span>
                <span className="text-[11px] font-medium leading-none" style={{ color: '#16a34a' }}>Working</span>
              </div>
              <div className="rounded-2xl flex flex-col items-center justify-center py-3 gap-0.5" style={{ backgroundColor: '#fff7ed' }}>
                <span className="text-xl font-bold leading-none" style={{ color: '#ea580c' }}>{onLeave}</span>
                <span className="text-[11px] font-medium leading-none" style={{ color: '#ea580c' }}>Leave</span>
              </div>
              <div className="rounded-2xl flex flex-col items-center justify-center py-3 gap-0.5" style={{ backgroundColor: '#f8fafc' }}>
                <span className="text-xl font-bold leading-none" style={{ color: '#64748b' }}>{off}</span>
                <span className="text-[11px] font-medium leading-none" style={{ color: '#64748b' }}>Off</span>
              </div>
              <div className="rounded-2xl flex flex-col items-center justify-center py-3 gap-0.5" style={{ backgroundColor: '#faf5ff' }}>
                <span className="text-xl font-bold leading-none" style={{ color: '#9333ea' }}>{total}</span>
                <span className="text-[11px] font-medium leading-none" style={{ color: '#9333ea' }}>Total</span>
              </div>
            </div>
          </>
        )}

        {tab === 'attendance' && <div className="pb-2" />}
        <div className="border-b border-gray-100" />
      </div>

      {/* ── SCHEDULE TAB ── */}
      {tab === 'schedule' && (
        <div className="pb-28 space-y-4 px-4 pt-4">

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <span className="text-sm font-semibold text-gray-900">
                {isSelectedToday ? "Today's Schedule" : `${selectedLabel}'s Schedule`}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {rosterLoading ? (
                <FullPageSpinner />
              ) : roster.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">No staff accounts found.</div>
              ) : (
                roster.map((entry) => {
                  const pill = shiftPill(entry)
                  const canEdit = isOwnerOrManager
                  return (
                    <div
                      key={entry.id}
                      onClick={() => canEdit && setEditingEntry(entry)}
                      className={`flex items-center gap-3 px-4 py-3 ${canEdit ? 'active:bg-gray-50 cursor-pointer' : ''}`}
                      role={canEdit ? 'button' : undefined}
                    >
                      <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-bold flex-shrink-0">
                        {entry.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900">{entry.name}</div>
                        <div className="text-xs text-gray-400">{entry.role}</div>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${pill.bg} ${pill.text}`}>
                        {pill.label}
                      </span>
                      {canEdit && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── ATTENDANCE TAB ── */}
      {tab === 'attendance' && staff && canAttendance && (
        <AttendanceInline staff={staff} isManager={isManager} />
      )}

      {/* ── Shift editor sheet ── */}
      {editingEntry && (
        <ShiftEditorSheet
          staffUserId={editingEntry.id}
          staffName={editingEntry.name}
          date={selectedDate}
          dateLabel={selectedLabel}
          currentShiftType={editingEntry.shiftType}
          currentShiftLabel={editingEntry.shiftLabel}
          onClose={() => setEditingEntry(null)}
          onSaved={() => {
            // Refresh roster after saving a shift
            loadRoster(selectedDate).then(setRoster)
          }}
        />
      )}

    </main>
    </PageTransition>
  )
}
