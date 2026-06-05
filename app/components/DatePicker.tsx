'use client'

import { useState, useRef, useEffect } from 'react'

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
  const [viewWeekStart, setViewWeekStart] = useState(() => getMondayOfWeek(selectedDate))

  const stripRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const isDragging = useRef(false)
  const hasDragged = useRef(false)
  const pendingWeek = useRef<string | null>(null)
  const navDirection = useRef<'next' | 'prev'>('next')

  // Month flip animation: track when month/year changes
  const refD = new Date(getWeekDays(viewWeekStart)[3] + 'T00:00:00')
  const monthLabel = MONTHS_ZH[refD.getMonth()]
  const yearLabel = refD.getFullYear()
  const monthKey = `${refD.getFullYear()}-${refD.getMonth()}`

  const [displayedMonthKey, setDisplayedMonthKey] = useState(monthKey)
  const [flipClass, setFlipClass] = useState('')

  useEffect(() => {
    if (monthKey !== displayedMonthKey) {
      setFlipClass(navDirection.current === 'next' ? 'month-flip-next' : 'month-flip-prev')
      setDisplayedMonthKey(monthKey)
    }
  }, [monthKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync view when selectedDate jumps to a different week externally
  useEffect(() => {
    const monday = getMondayOfWeek(selectedDate)
    if (monday !== viewWeekStart && !isDragging.current) {
      pendingWeek.current = null
      applyTransform('translateX(-33.333%)', false)
      setViewWeekStart(monday)
    }
  }, [selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const prevWeekStart = addDays(viewWeekStart, -7)
  const nextWeekStart = addDays(viewWeekStart, 7)

  function applyTransform(value: string, animate: boolean) {
    const el = stripRef.current
    if (!el) return
    el.style.transition = animate
      ? 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
      : 'none'
    el.style.transform = value
  }

  function getContainerWidth() {
    return stripRef.current?.parentElement?.clientWidth ?? 300
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (pendingWeek.current) return
    touchStartX.current = e.touches[0].clientX
    isDragging.current = true
    hasDragged.current = false
    applyTransform('translateX(-33.333%)', false)
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging.current) return
    const delta = e.touches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 5) hasDragged.current = true
    applyTransform(`translateX(calc(-33.333% + ${delta}px))`, false)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!isDragging.current) return
    isDragging.current = false
    const delta = e.changedTouches[0].clientX - touchStartX.current
    const threshold = getContainerWidth() * 0.22

    if (delta > threshold) {
      navDirection.current = 'prev'
      pendingWeek.current = prevWeekStart
      applyTransform('translateX(0%)', true)
    } else if (delta < -threshold) {
      navDirection.current = 'next'
      pendingWeek.current = nextWeekStart
      applyTransform('translateX(-66.666%)', true)
    } else {
      applyTransform('translateX(-33.333%)', true)
    }
  }

  function handleTransitionEnd() {
    if (!pendingWeek.current) return
    const newWeekStart = pendingWeek.current
    pendingWeek.current = null
    applyTransform('translateX(-33.333%)', false)
    setViewWeekStart(newWeekStart)
  }

  function navigate(dir: 'prev' | 'next') {
    if (pendingWeek.current || isDragging.current) return
    navDirection.current = dir
    pendingWeek.current = dir === 'prev' ? prevWeekStart : nextWeekStart
    applyTransform('translateX(-33.333%)', false)
    requestAnimationFrame(() => {
      applyTransform(dir === 'prev' ? 'translateX(0%)' : 'translateX(-66.666%)', true)
    })
  }

  const weeks = [
    getWeekDays(prevWeekStart),
    getWeekDays(viewWeekStart),
    getWeekDays(nextWeekStart),
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {/* key triggers re-mount → CSS animation fires */}
          <span
            key={displayedMonthKey}
            className={`text-sm font-semibold text-gray-700 ${flipClass}`}
          >
            {monthLabel} {yearLabel}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => navigate('prev')}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 text-base leading-none"
          >‹</button>
          <button
            onClick={() => navigate('next')}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 text-base leading-none"
          >›</button>
        </div>
      </div>

      {/* Static weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-xs text-gray-300 font-medium pb-1">{label}</div>
        ))}
      </div>

      {/* Sliding strip */}
      <div className="overflow-hidden">
        <div
          ref={stripRef}
          className="flex"
          style={{ width: '300%', transform: 'translateX(-33.333%)', willChange: 'transform' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTransitionEnd={handleTransitionEnd}
        >
          {weeks.map((weekDays, wi) => (
            <div key={`${wi}-${weekDays[0]}`} style={{ width: '33.333%' }}>
              <div className="grid grid-cols-7">
                {weekDays.map((dateStr) => {
                  const day = new Date(dateStr + 'T00:00:00').getDate()
                  const isSelected = dateStr === selectedDate
                  const isToday = dateStr === today
                  return (
                    <button
                      key={dateStr}
                      onClick={() => {
                        if (hasDragged.current) return
                        onDateChange(dateStr)
                        if (wi !== 1) navigate(wi === 0 ? 'prev' : 'next')
                      }}
                      className="flex justify-center items-center py-1"
                    >
                      <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium ${
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
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
