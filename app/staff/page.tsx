'use client'

import { useState } from 'react'
import BackButton from '../components/BackButton'
import BottomNav from '../components/BottomNav'
import PageTransition from '../components/PageTransition'
import Link from 'next/link'
import { useStaff } from '../components/StaffProvider'

type ShiftType = 'morning' | 'full' | 'afternoon' | 'off' | 'leave'

type StaffMember = {
  id: number
  name: string
  role: string
  avatar: string
  shifts: Record<string, ShiftType> // key: 'YYYY-MM-DD'
}

const shiftConfig: Record<ShiftType, { label: string; short: string; bg: string; text: string }> = {
  morning:   { label: '09:00–15:00', short: '09–15', bg: 'bg-blue-100',   text: 'text-blue-700'   },
  full:      { label: '10:00–20:00', short: '10–20', bg: 'bg-green-100',  text: 'text-green-700'  },
  afternoon: { label: '14:00–21:00', short: '14–21', bg: 'bg-purple-100', text: 'text-purple-700' },
  off:       { label: 'Off',         short: 'Off',   bg: 'bg-gray-100',   text: 'text-gray-400'   },
  leave:     { label: 'Leave',       short: 'Leave', bg: 'bg-orange-100', text: 'text-orange-500' },
}

// Sample data — will be replaced with Supabase integration
const staffList: StaffMember[] = [
  {
    id: 1, name: 'Ah Ming', role: 'Chef', avatar: 'A',
    shifts: {
      '2026-06-01': 'full', '2026-06-02': 'full', '2026-06-03': 'full',
      '2026-06-04': 'off',  '2026-06-05': 'full', '2026-06-06': 'full', '2026-06-07': 'full',
    },
  },
  {
    id: 2, name: 'Siti', role: 'Server', avatar: 'S',
    shifts: {
      '2026-06-01': 'afternoon', '2026-06-02': 'afternoon', '2026-06-03': 'off',
      '2026-06-04': 'afternoon', '2026-06-05': 'afternoon', '2026-06-06': 'afternoon', '2026-06-07': 'leave',
    },
  },
  {
    id: 3, name: 'Raj', role: 'Kitchen', avatar: 'R',
    shifts: {
      '2026-06-01': 'morning', '2026-06-02': 'morning', '2026-06-03': 'morning',
      '2026-06-04': 'morning', '2026-06-05': 'off',     '2026-06-06': 'morning', '2026-06-07': 'morning',
    },
  },
  {
    id: 4, name: 'Mei Ling', role: 'Server', avatar: 'M',
    shifts: {
      '2026-06-01': 'off',  '2026-06-02': 'full', '2026-06-03': 'full',
      '2026-06-04': 'full', '2026-06-05': 'off',  '2026-06-06': 'full', '2026-06-07': 'off',
    },
  },
  {
    id: 5, name: 'Ahmad', role: 'Dishwasher', avatar: 'H',
    shifts: {
      '2026-06-01': 'full', '2026-06-02': 'leave', '2026-06-03': 'leave',
      '2026-06-04': 'leave','2026-06-05': 'full',  '2026-06-06': 'full', '2026-06-07': 'off',
    },
  },
]

function getWeekDates(anchor: Date): Date[] {
  const day = anchor.getDay()
  const monday = new Date(anchor)
  monday.setDate(anchor.getDate() - ((day + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function toKey(d: Date) {
  return d.toISOString().split('T')[0]
}

const weekdayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function SchedulePage() {
  const staff = useStaff()
  const today = new Date()
  const [anchor, setAnchor] = useState(today)
  const week = getWeekDates(anchor)
  const todayKey = toKey(today)

  const prevWeek = () => {
    const d = new Date(anchor)
    d.setDate(d.getDate() - 7)
    setAnchor(d)
  }
  const nextWeek = () => {
    const d = new Date(anchor)
    d.setDate(d.getDate() + 7)
    setAnchor(d)
  }

  const weekLabel = `${months[week[0].getMonth()]} ${week[0].getDate()} – ${
    week[0].getMonth() !== week[6].getMonth() ? months[week[6].getMonth()] + ' ' : ''
  }${week[6].getDate()}`

  // Count on-duty today
  const onDutyToday = staffList.filter(s => {
    const shift = s.shifts[todayKey]
    return shift && shift !== 'off' && shift !== 'leave'
  }).length

  return (
    <PageTransition>
    <main className="bg-gray-50 w-full mx-auto">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <BackButton href="/" />
          <span className="font-semibold text-base">Schedule</span>
        </div>
        <div className="flex items-center gap-2">
          {staff?.role === 'owner' && (
            <>
              <Link href="/staff/activity" className="rounded-md bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600">Activity</Link>
              <Link href="/staff/accounts" className="rounded-md bg-orange-500 px-2.5 py-1.5 text-xs font-medium text-white">Accounts</Link>
            </>
          )}
          <span className="text-xs text-green-500 font-medium">{onDutyToday} on duty</span>
        </div>
      </div>

      {/* Week navigator */}
      <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between sticky top-[49px] z-10">
        <button onClick={prevWeek} className="p-1.5 text-gray-400 active:text-gray-700">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-800">{weekLabel}</span>
        <button onClick={nextWeek} className="p-1.5 text-gray-400 active:text-gray-700">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      {/* Schedule grid */}
      <div className="pb-28 overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 w-24 sticky left-0 bg-gray-50 z-10">Staff</th>
              {week.map((d, i) => {
                const key = toKey(d)
                const isToday = key === todayKey
                return (
                  <th key={key} className="py-2.5 px-1 text-center w-[calc((100%-6rem)/7)]">
                    <div className={`text-[10px] font-medium mb-0.5 ${isToday ? 'text-orange-500' : 'text-gray-400'}`}>
                      {weekdayShort[i]}
                    </div>
                    <div className={`text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center mx-auto ${
                      isToday ? 'bg-orange-500 text-white' : 'text-gray-700'
                    }`}>
                      {d.getDate()}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staffList.map((member) => (
              <tr key={member.id} className="bg-white">
                {/* Name column — sticky left */}
                <td className="px-4 py-3 sticky left-0 bg-white z-10">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold flex-shrink-0">
                      {member.avatar}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-800 whitespace-nowrap">{member.name}</div>
                      <div className="text-[10px] text-gray-400 whitespace-nowrap">{member.role}</div>
                    </div>
                  </div>
                </td>
                {/* Shift cells */}
                {week.map((d) => {
                  const key = toKey(d)
                  const shift = (member.shifts[key] ?? 'off') as ShiftType
                  const cfg = shiftConfig[shift]
                  return (
                    <td key={key} className="px-1 py-3 text-center">
                      <span className={`inline-block rounded-lg px-1.5 py-1 text-[10px] font-semibold ${cfg.bg} ${cfg.text} whitespace-nowrap leading-none`}>
                        {cfg.short}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="fixed bottom-16 left-0 right-0 px-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-2.5 flex items-center gap-3 flex-wrap pointer-events-auto">
          {(Object.entries(shiftConfig) as [ShiftType, typeof shiftConfig[ShiftType]][]).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${cfg.bg} inline-block`}/>
              <span className="text-[11px] text-gray-500">{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </main>
    </PageTransition>
  )
}
