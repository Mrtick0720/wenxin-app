'use client'

import { lazy, useRef, useState, useEffect, useCallback } from 'react'
import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'
import DatePicker from '../components/DatePicker'
import { FullPageSpinner } from '../components/Spinner'
import { useNavigation } from '../components/NavigationStack'

const StaffAccountsStack = lazy(() => import('./accounts/StaffAccountsStack'))
const HolidaysManager = lazy(() => import('./holidays/HolidaysManager'))
import ShiftEditorSheet from './ShiftEditorSheet'
import LeaveRequestSheet from './LeaveRequestSheet'
import LeaveRequestsInbox from './LeaveRequestsInbox'
import HolidayInviteSheet from './HolidayInviteSheet'
import MyLeaveRequests from './MyLeaveRequests'
import TodayTeamOnDuty from './TodayTeamOnDuty'
import { useStaff } from '../components/StaffProvider'
import { todayLocalStr } from '@/lib/dateUtils'
import { canViewAllAttendance, canViewOwnAttendance } from '@/lib/attendance/permissions'
import AttendanceInline from './activity/AttendanceInline'
import type { ShiftType } from '@/lib/attendance/types'
import type { PublicHoliday, ResolvedDay, RosterDay } from '@/lib/schedule/types'
import { statusDisplay, weekdayName, weekdayShort } from '@/lib/schedule/resolveScheduleStatus'
import {
  fetchLeaveRequestsAction,
  fetchMyScheduleAction,
  fetchScheduleForDateAction,
} from './schedule-actions'

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

function sortByRole(a: { role: string; staffName: string }, b: { role: string; staffName: string }): number {
  const aOrder = ROLE_ORDER[a.role] ?? 5
  const bOrder = ROLE_ORDER[b.role] ?? 5
  if (aOrder !== bOrder) return aOrder - bOrder
  return a.staffName.localeCompare(b.staffName)
}

// Status tone — colors the WHOLE roster card by status group.
//   working → green · leave → amber · paid holiday → indigo · off → warm gray
type Tone = { card: string; name: string; role: string; status: string; chevron: string; label: string }

const TONE_GREEN = (label: string): Tone => ({
  card: 'bg-[#C0DD97]', name: 'text-[#173404]', role: 'text-[#3B6D11]', status: 'text-[#27500A]', chevron: '#3B6D11', label,
})
const TONE_AMBER = (label: string): Tone => ({
  card: 'bg-[#FAC775]', name: 'text-[#412402]', role: 'text-[#854F0B]', status: 'text-[#633806]', chevron: '#854F0B', label,
})
const TONE_INDIGO = (label: string): Tone => ({
  card: 'bg-[#C7C2F0]', name: 'text-[#211952]', role: 'text-[#473A99]', status: 'text-[#33287A]', chevron: '#473A99', label,
})
const TONE_GRAY = (label: string): Tone => ({
  card: 'bg-[#D3D1C7]', name: 'text-[#57564F]', role: 'text-[#8A887F]', status: 'text-[#6E6C64]', chevron: '#8A887F', label,
})

function rosterTone(day: RosterDay): Tone {
  const { label, tone } = statusDisplay(day)
  switch (tone) {
    case 'working': return TONE_GREEN(label)
    case 'leave': return TONE_AMBER(label)
    case 'paid_holiday': return TONE_INDIGO(label)
    case 'off':
    default: return TONE_GRAY(label)
  }
}

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function summaryForRoster(entries: RosterDay[]) {
  const working = entries.filter(e => e.status === 'working' || e.status === 'holiday_working').length
  const onLeave = entries.filter(e => e.status === 'leave').length
  const off = entries.filter(e => e.status === 'off' || e.status === 'paid_holiday').length
  return { working, onLeave, off, total: entries.length }
}

// Text colour for the staff "My Schedule" status line.
function myStatusColor(day: ResolvedDay): string {
  const { tone } = statusDisplay(day)
  switch (tone) {
    case 'working': return '#16a34a'
    case 'leave': return '#ea580c'
    case 'paid_holiday': return '#6366f1'
    default: return '#64748b'
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function StaffPage({ initialTab }: { initialTab?: Tab } = {}) {
  const staff = useStaff()
  const { push } = useNavigation()
  const isOwnerOrManager = staff?.role === 'owner' || staff?.role === 'manager'
  const canAttendance = staff ? canViewOwnAttendance(staff.role) : false
  const isManager = staff ? canViewAllAttendance(staff.role) : false

  const today = todayLocalStr()
  const [tab, setTab] = useState<Tab>(initialTab ?? 'schedule')
  const [selectedDate, setSelectedDate] = useState(today)
  const datepickerAreaRef = useRef<HTMLDivElement>(null)

  // ── Owner/manager: full resolved roster for the selected date ──
  const [roster, setRoster] = useState<RosterDay[]>([])
  const [holiday, setHoliday] = useState<PublicHoliday | null>(null)
  const [rosterLoading, setRosterLoading] = useState(true)
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0)

  // ── Staff: own resolved day ──
  const [myDay, setMyDay] = useState<ResolvedDay | null>(null)
  const [myFixedOff, setMyFixedOff] = useState<number | null>(null)
  const [myLoading, setMyLoading] = useState(true)
  const [myError, setMyError] = useState<string | null>(null)
  const [myHasProfile, setMyHasProfile] = useState(true)

  // ── Sheets / refresh keys ──
  const [editingEntry, setEditingEntry] = useState<RosterDay | null>(null)
  const [showLeaveSheet, setShowLeaveSheet] = useState(false)
  const [showInbox, setShowInbox] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [leaveRefreshKey, setLeaveRefreshKey] = useState(0)

  const loadRoster = useCallback(async (date: string) => {
    const res = await fetchScheduleForDateAction(date)
    if (res.ok) {
      setRoster([...res.data.roster].sort(sortByRole))
      setHoliday(res.data.holiday)
    }
  }, [])

  const loadPendingCount = useCallback(async () => {
    const res = await fetchLeaveRequestsAction('pending')
    if (res.ok) setPendingLeaveCount(res.data.length)
  }, [])

  // Owner/manager roster (inline fetch to satisfy set-state-in-effect rule).
  useEffect(() => {
    if (!staff || !isOwnerOrManager) return
    let active = true
    fetchScheduleForDateAction(selectedDate).then((res) => {
      if (!active) return
      if (res.ok) {
        setRoster([...res.data.roster].sort(sortByRole))
        setHoliday(res.data.holiday)
      }
      setRosterLoading(false)
    })
    return () => { active = false }
  }, [staff, isOwnerOrManager, selectedDate])

  // Pending-leave badge for owner/manager.
  useEffect(() => {
    if (!staff || !isOwnerOrManager) return
    let active = true
    fetchLeaveRequestsAction('pending').then((res) => {
      if (active && res.ok) setPendingLeaveCount(res.data.length)
    })
    return () => { active = false }
  }, [staff, isOwnerOrManager])

  // Staff own resolved day. Always resolves the loading state — on success,
  // failure (RLS / missing migration), or a rejected promise — so the card
  // can never hang on "Loading…".
  useEffect(() => {
    if (!staff || isOwnerOrManager) return
    let active = true
    fetchMyScheduleAction(selectedDate)
      .then((res) => {
        if (!active) return
        if (res.ok) {
          setMyDay(res.data.day)
          setMyFixedOff(res.data.fixedOffWeekday)
          setMyHasProfile(res.data.hasProfile)
          setHoliday(res.data.holiday)
          setMyError(null)
        } else {
          setMyError(res.error)
        }
      })
      .catch((err) => {
        if (active) setMyError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (active) setMyLoading(false)
      })
    return () => { active = false }
  }, [staff, isOwnerOrManager, selectedDate])

  const selectedDateObj = new Date(selectedDate + 'T00:00:00')
  const selectedLabel = `${weekdays[selectedDateObj.getDay()]}, ${months[selectedDateObj.getMonth()]} ${selectedDateObj.getDate()}`
  const isSelectedToday = selectedDate === today

  const { working, onLeave, off, total } = summaryForRoster(roster)

  function openAccounts() {
    push('/staff/accounts', <StaffAccountsStack />)
  }
  function openHolidays() {
    push('/staff/holidays', <HolidaysManager />)
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

            {/* Metric cards — owner/manager only (team-wide counts) */}
            {isOwnerOrManager && (
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
            )}
            {!isOwnerOrManager && <div className="pb-3" />}
          </>
        )}

        {tab === 'attendance' && <div className="pb-2" />}
        <div className="border-b border-gray-100" />
      </div>

      {/* ── SCHEDULE TAB ── */}
      {tab === 'schedule' && (
        <div className="pb-28 space-y-4 px-4 pt-4">

          {/* Public holiday banner */}
          {holiday && (
            <div className="rounded-2xl px-4 py-3 bg-[#EEF0FF] border border-[#C7C2F0]">
              <div className="text-sm font-semibold text-[#33287A]">Public Holiday · {holiday.name}</div>
              <div className="text-xs text-[#473A99] mt-0.5">Everyone is on Paid Holiday by default.</div>
              {isOwnerOrManager && (
                <button
                  type="button"
                  onClick={() => setShowInvite(true)}
                  className="mt-2 text-xs font-semibold text-white bg-[#473A99] rounded-lg px-3 py-1.5 active:opacity-90"
                >
                  Invite staff to work
                </button>
              )}
            </div>
          )}

          {isOwnerOrManager ? (
            <>
              {/* Owner/manager management actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowInbox(true)}
                  className="relative bg-white rounded-2xl shadow-sm px-4 py-3 text-left active:opacity-80"
                >
                  <div className="text-sm font-semibold text-gray-900">Leave Requests</div>
                  <div className="text-xs text-gray-400 mt-0.5">Review & approve</div>
                  {pendingLeaveCount > 0 && (
                    <span className="absolute top-2 right-2 min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-[11px] font-bold flex items-center justify-center">
                      {pendingLeaveCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={openHolidays}
                  className="bg-white rounded-2xl shadow-sm px-4 py-3 text-left active:opacity-80"
                >
                  <div className="text-sm font-semibold text-gray-900">Public Holidays</div>
                  <div className="text-xs text-gray-400 mt-0.5">Manage holidays</div>
                </button>
              </div>

              {/* Roster */}
              <div>
                <div className="px-1 mb-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {isSelectedToday ? "Today's Schedule" : `${selectedLabel}'s Schedule`}
                  </span>
                </div>
                {rosterLoading ? (
                  <FullPageSpinner />
                ) : roster.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-sm px-4 py-8 text-center text-sm text-gray-400">No staff accounts found.</div>
                ) : (
                  <div className="space-y-2">
                    {roster.map((entry) => {
                      const tone = rosterTone(entry)
                      const offDay = weekdayShort(entry.fixedOffWeekday)
                      return (
                        <div
                          key={entry.staffId}
                          onClick={() => setEditingEntry(entry)}
                          className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-sm ${tone.card} active:opacity-80 cursor-pointer`}
                          role="button"
                        >
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-semibold ${tone.name}`}>{entry.staffName}</div>
                            <div className={`text-xs ${tone.role}`}>
                              {entry.role}{offDay ? ` · Off: ${offDay}` : ''}
                            </div>
                          </div>
                          <span className={`text-base font-bold whitespace-nowrap ${tone.status}`}>
                            {tone.label}
                          </span>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tone.chevron} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Staff: my schedule */}
              <div>
                <div className="px-1 mb-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {isSelectedToday ? 'My Schedule · Today' : `My Schedule · ${selectedLabel}`}
                  </span>
                </div>
                {myLoading ? (
                  <div className="bg-white rounded-2xl shadow-sm px-4 py-6 text-center text-sm text-gray-400">Loading…</div>
                ) : myError ? (
                  <div className="bg-white rounded-2xl shadow-sm px-4 py-5 text-center">
                    <div className="text-sm font-medium text-red-500">Couldn&apos;t load your schedule</div>
                    <div className="text-xs text-gray-400 mt-1 break-words">{myError}</div>
                  </div>
                ) : !myHasProfile ? (
                  <div className="bg-white rounded-2xl shadow-sm px-4 py-6 text-center text-sm text-gray-400">
                    No staff profile found.
                  </div>
                ) : myDay ? (
                  <div className="bg-white rounded-2xl shadow-sm px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-500">{selectedLabel}</span>
                      <span className="text-lg font-bold" style={{ color: myStatusColor(myDay) }}>
                        {statusDisplay(myDay).label}
                      </span>
                    </div>
                    {myDay.holidayName && (
                      <div className="text-xs text-[#473A99] mt-2">Public Holiday · {myDay.holidayName}</div>
                    )}
                    {weekdayName(myFixedOff) && (
                      <div className="mt-2 inline-block text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-3 py-1">
                        Fixed Off Day: {weekdayName(myFixedOff)}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Request leave */}
              <button
                type="button"
                onClick={() => setShowLeaveSheet(true)}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-white active:opacity-90"
                style={{ background: '#f97316' }}
              >
                Request Leave
              </button>

              {/* My leave requests */}
              <div>
                <div className="px-1 mb-2">
                  <span className="text-sm font-semibold text-gray-900">My Leave Requests</span>
                </div>
                <MyLeaveRequests refreshKey={leaveRefreshKey} />
              </div>

              {/* Today's team on duty */}
              <div>
                <div className="px-1 mb-2">
                  <span className="text-sm font-semibold text-gray-900">Today&apos;s Team On Duty</span>
                </div>
                <TodayTeamOnDuty date={today} />
              </div>
            </>
          )}

        </div>
      )}

      {/* ── ATTENDANCE TAB ── */}
      {tab === 'attendance' && staff && canAttendance && (
        <AttendanceInline staff={staff} isManager={isManager} />
      )}

      {/* ── Shift editor sheet (owner/manager manual override) ── */}
      {editingEntry && (
        <ShiftEditorSheet
          staffUserId={editingEntry.staffId}
          staffName={editingEntry.staffName}
          date={selectedDate}
          dateLabel={selectedLabel}
          currentShiftType={editingEntry.shiftType}
          currentShiftLabel={editingEntry.shiftLabel}
          onClose={() => setEditingEntry(null)}
          onOptimistic={(shiftType: ShiftType, shiftLabel) => {
            const id = editingEntry.staffId
            setRoster(prev => prev.map(e =>
              e.staffId === id ? { ...e, shiftType, shiftLabel } : e,
            ))
          }}
          onSaved={() => { loadRoster(selectedDate) }}
        />
      )}

      {/* ── Leave request form (staff) ── */}
      {showLeaveSheet && (
        <LeaveRequestSheet
          onClose={() => setShowLeaveSheet(false)}
          onSubmitted={() => setLeaveRefreshKey(k => k + 1)}
        />
      )}

      {/* ── Leave requests inbox (owner/manager) ── */}
      {showInbox && (
        <LeaveRequestsInbox
          onClose={() => setShowInbox(false)}
          onReviewed={() => { loadRoster(selectedDate); loadPendingCount() }}
        />
      )}

      {/* ── Holiday work invitations (owner/manager) ── */}
      {showInvite && holiday && (
        <HolidayInviteSheet
          date={selectedDate}
          holidayName={holiday.name}
          staff={roster.map(r => ({ id: r.staffId, name: r.staffName, role: r.role }))}
          onClose={() => setShowInvite(false)}
          onChanged={() => loadRoster(selectedDate)}
        />
      )}

    </main>
    </PageTransition>
  )
}
