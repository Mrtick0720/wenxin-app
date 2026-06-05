'use client'

import { useState, useEffect, useRef } from 'react'

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTHS_ZH = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function getWeekDays(mondayStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayStr, i))
}

interface DatePickerProps {
  selectedDate: string
  onDateChange: (date: string) => void
}

export default function DatePicker({ selectedDate, onDateChange }: DatePickerProps) {
  const today = new Date().toISOString().split('T')[0]
  const [viewWeekStart, setViewWeekStart] = useState(getMondayOfWeek(selectedDate))
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    setViewWeekStart(getMondayOfWeek(selectedDate))
  }, [selectedDate])

  const weekDays = getWeekDays(viewWeekStart)
  // use Thursday to determine which month to display (handles week spanning two months)
  const thursdayDate = weekDays[3]
  const refDate = new Date(thursdayDate + 'T00:00:00')
  const monthLabel = MONTHS_ZH[refDate.getMonth()]
  const yearLabel = refDate.getFullYear()

  function prevWeek() { setViewWeekStart(addDays(viewWeekStart, -7)) }
  function nextWeek() { setViewWeekStart(addDays(viewWeekStart, 7)) }

  function handleDayTap(dateStr: string) {
    onDateChange(dateStr)
    setViewWeekStart(getMondayOfWeek(dateStr))
  }

  function goToday() {
    onDateChange(today)
    setViewWeekStart(getMondayOfWeek(today))
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) {
      diff > 0 ? nextWeek() : prevWeek()
    }
    touchStartX.current = null
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-gray-600">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span className="text-sm font-semibold text-gray-700">{monthLabel} {yearLabel}</span>
        </div>
        <div className="flex gap-1">
          <button onClick={prevWeek} className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 text-base leading-none">‹</button>
          <button onClick={nextWeek} className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 text-base leading-none">›</button>
        </div>
      </div>

      {/* Week strip */}
      <div
        className="grid grid-cols-7"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Weekday labels */}
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-xs text-gray-300 pb-1.5 font-medium">{label}</div>
        ))}

        {/* Day numbers */}
        {weekDays.map((dateStr) => {
          const day = new Date(dateStr + 'T00:00:00').getDate()
          const isSelected = dateStr === selectedDate
          const isToday = dateStr === today
          return (
            <button
              key={dateStr}
              onClick={() => handleDayTap(dateStr)}
              className="flex justify-center items-center py-0.5"
            >
              <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-blue-400 text-white'
                  : isToday
                  ? 'text-blue-400 font-semibold'
                  : 'text-gray-700'
              }`}>
                {day}
              </span>
            </button>
          )
        })}
      </div>

      {/* TODAY button — only shows when not on today */}
      {selectedDate !== today && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={goToday}
            className="px-8 py-1.5 bg-blue-400 text-white text-sm font-semibold rounded-full"
          >
            TODAY
          </button>
        </div>
      )}
    </div>
  )
}
