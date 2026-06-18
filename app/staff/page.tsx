'use client'

import { lazy, useRef, useState } from 'react'
import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'
import DatePicker from '../components/DatePicker'
import { useNavigation } from '../components/NavigationStack'

const StaffAccountsStack = lazy(() => import('./accounts/StaffAccountsStack'))
import { useStaff } from '../components/StaffProvider'
import { todayLocalStr } from '@/lib/dateUtils'
import { canViewAllAttendance, canViewOwnAttendance } from '@/lib/attendance/permissions'
import AttendanceInline from './activity/AttendanceInline'

type Tab = 'schedule' | 'attendance'

// ─── Schedule data ────────────────────────────────────────────────────────────

type ShiftType = 'morning' | 'full' | 'afternoon' | 'off' | 'leave'

type StaffMember = {
  id: number
  name: string
  role: string
  avatar: string
  shifts: Record<string, ShiftType>
}

const shiftConfig: Record<ShiftType, { label: string; bg: string; text: string }> = {
  morning:   { label: '09:00–15:00', bg: 'bg-blue-100',   text: 'text-blue-600'   },
  full:      { label: '10:00–20:00', bg: 'bg-green-100',  text: 'text-green-600'  },
  afternoon: { label: '14:00–21:00', bg: 'bg-purple-100', text: 'text-purple-600' },
  off:       { label: 'Off',         bg: 'bg-gray-100',   text: 'text-gray-400'   },
  leave:     { label: 'Leave',       bg: 'bg-orange-100', text: 'text-orange-500' },
}

const staffList: StaffMember[] = [
  {
    id: 1, name: 'Ah Ming', role: 'Chef', avatar: 'A',
    shifts: {
      '2026-06-16': 'full',      '2026-06-17': 'full',      '2026-06-18': 'morning',
      '2026-06-19': 'off',       '2026-06-20': 'full',      '2026-06-21': 'full',
    },
  },
  {
    id: 2, name: 'Natalie', role: 'Cashier', avatar: 'N',
    shifts: {
      '2026-06-16': 'afternoon', '2026-06-17': 'afternoon', '2026-06-18': 'full',
      '2026-06-19': 'afternoon', '2026-06-20': 'afternoon', '2026-06-21': 'leave',
    },
  },
  {
    id: 3, name: 'Jun', role: 'Kitchen', avatar: 'J',
    shifts: {
      '2026-06-16': 'morning',   '2026-06-17': 'morning',   '2026-06-18': 'afternoon',
      '2026-06-19': 'morning',   '2026-06-20': 'off',       '2026-06-21': 'morning',
    },
  },
  {
    id: 4, name: 'Nadz', role: 'Server', avatar: 'N',
    shifts: {
      '2026-06-16': 'off',       '2026-06-17': 'full',      '2026-06-18': 'off',
      '2026-06-19': 'full',      '2026-06-20': 'off',       '2026-06-21': 'full',
    },
  },
  {
    id: 5, name: 'Mei Ling', role: 'Server', avatar: 'M',
    shifts: {
      '2026-06-16': 'full',      '2026-06-17': 'leave',     '2026-06-18': 'off',
      '2026-06-19': 'leave',     '2026-06-20': 'full',      '2026-06-21': 'off',
    },
  },
]

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function summaryForDate(dateKey: string) {
  const working = staffList.filter(s => {
    const shift = s.shifts[dateKey]
    return shift && shift !== 'off' && shift !== 'leave'
  }).length
  const onLeave = staffList.filter(s => s.shifts[dateKey] === 'leave').length
  const off = staffList.filter(s => {
    const shift = s.shifts[dateKey]
    return !shift || shift === 'off'
  }).length
  return { working, onLeave, off, total: staffList.length }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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

  const selectedDateObj = new Date(selectedDate + 'T00:00:00')
  const selectedLabel = `${weekdays[selectedDateObj.getDay()]}, ${months[selectedDateObj.getMonth()]} ${selectedDateObj.getDate()}`
  const isSelectedToday = selectedDate === today

  const { working, onLeave, off, total } = summaryForDate(selectedDate)

  const roster = staffList.map(s => ({
    ...s,
    shift: (s.shifts[selectedDate] ?? 'off') as ShiftType,
  }))

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

      {/* ── Segmented control + date picker + metrics (unified sticky block) ── */}
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

            {/* Metric cards — hex colors to avoid oklch() Safari iOS incompatibility */}
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

          {/* Staff roster for selected date */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <span className="text-sm font-semibold text-gray-900">
                {isSelectedToday ? "Today's Schedule" : `${selectedLabel}'s Schedule`}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {roster.map((member) => {
                const cfg = shiftConfig[member.shift]
                return (
                  <div key={member.id} className="flex items-center gap-3 px-4 py-3 active:bg-gray-50">
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-bold flex-shrink-0">
                      {member.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900">{member.name}</div>
                      <div className="text-xs text-gray-400">{member.role}</div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      )}

      {/* ── ATTENDANCE TAB ── */}
      {tab === 'attendance' && staff && canAttendance && (
        <AttendanceInline staff={staff} isManager={isManager} />
      )}

    </main>
    </PageTransition>
  )
}
