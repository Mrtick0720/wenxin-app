'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

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

function getMonthInfo(weekStart: string) {
  const d = new Date(getWeekDays(weekStart)[3] + 'T00:00:00')
  return { key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS_ZH[d.getMonth()], year: d.getFullYear() }
}

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function getFirstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay() }

interface DatePickerProps {
  selectedDate: string
  onDateChange: (date: string) => void
  isLoading?: boolean
}

export default function DatePicker({ selectedDate, onDateChange, isLoading = false }: DatePickerProps) {
  const today = new Date().toISOString().split('T')[0]
  const [viewWeekStart, setViewWeekStart] = useState(() => getMondayOfWeek(selectedDate))

  // ── Calendar popup ────────────────────────────────────────────
  const [showCalendar, setShowCalendar] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    document.body.style.overflow = showCalendar ? 'hidden' : ''
    document.body.style.position = showCalendar ? 'fixed' : ''
    document.body.style.width = showCalendar ? '100%' : ''
    return () => { document.body.style.overflow = ''; document.body.style.position = ''; document.body.style.width = '' }
  }, [showCalendar])

  // ── Strip refs ────────────────────────────────────────────────
  const stripRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const isDragging = useRef(false)
  const hasDragged = useRef(false)
  const isLoadingRef = useRef(isLoading)
  // State machine: 'idle' | 'springing-back' | 'waiting-load' | 'snapping-forward'
  const animState = useRef('idle')
  const snapTarget = useRef<{ weekStart: string; transform: string } | null>(null)
  const [isWaiting, setIsWaiting] = useState(false)
  const navDirection = useRef<'next' | 'prev'>('next')

  // ── Month label animation ─────────────────────────────────────
  const initial = getMonthInfo(getMondayOfWeek(selectedDate))
  const [displayMonth, setDisplayMonth] = useState({ label: initial.label, year: initial.year })
  const [exitMonth, setExitMonth] = useState<{ label: string; year: number } | null>(null)
  const [animDir, setAnimDir] = useState<'next' | 'prev'>('next')
  const prevMonthKeyRef = useRef(initial.key)
  const prevMonthDataRef = useRef({ label: initial.label, year: initial.year })

  useEffect(() => {
    const { key, label, year } = getMonthInfo(viewWeekStart)
    if (key !== prevMonthKeyRef.current) {
      setExitMonth({ ...prevMonthDataRef.current })
      setDisplayMonth({ label, year })
      setAnimDir(navDirection.current)
      prevMonthKeyRef.current = key
      prevMonthDataRef.current = { label, year }
      const t = setTimeout(() => setExitMonth(null), 320)
      return () => clearTimeout(t)
    }
  }, [viewWeekStart])

  // Keep isLoadingRef in sync
  useEffect(() => { isLoadingRef.current = isLoading }, [isLoading])

  // When loading finishes, snap forward if waiting
  useEffect(() => {
    if (!isLoading && animState.current === 'waiting-load') {
      doSnapForward()
    }
  }, [isLoading]) // eslint-disable-line

  // Sync view when selectedDate changes externally
  useEffect(() => {
    const monday = getMondayOfWeek(selectedDate)
    if (monday === viewWeekStart) return

    if (animState.current !== 'idle') {
      // Our own triggered change → let animation continue
      if (snapTarget.current?.weekStart === monday) return
      // External override (e.g. TODAY button) → cancel and jump
      snapTarget.current = null
      animState.current = 'idle'
      setIsWaiting(false)
    }
    applyTransform('translateX(-33.333%)', false)
    setViewWeekStart(monday)
  }, [selectedDate]) // eslint-disable-line

  const prevWeekStart = addDays(viewWeekStart, -7)
  const nextWeekStart = addDays(viewWeekStart, 7)

  // ── Strip helpers ─────────────────────────────────────────────
  function applyTransform(value: string, animate: boolean) {
    const el = stripRef.current
    if (!el) return
    el.style.transition = animate ? 'transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
    el.style.transform = value
  }

  function getContainerWidth() {
    return stripRef.current?.parentElement?.clientWidth ?? 300
  }

  function doSnapForward() {
    if (!snapTarget.current) return
    animState.current = 'snapping-forward'
    setIsWaiting(false)
    applyTransform(snapTarget.current.transform, true)
  }

  // Representative date in target week: same day-of-week as current selectedDate
  function getRepDate(newWeekStart: string): string {
    const d = new Date(selectedDate + 'T00:00:00')
    const idx = d.getDay() === 0 ? 6 : d.getDay() - 1
    return addDays(newWeekStart, idx)
  }

  // ── Touch handlers ────────────────────────────────────────────
  function handleTouchStart(e: React.TouchEvent) {
    if (animState.current !== 'idle') return
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

    if (Math.abs(delta) > threshold) {
      const goingPrev = delta > 0
      const targetWeek = goingPrev ? prevWeekStart : nextWeekStart
      navDirection.current = goingPrev ? 'prev' : 'next'
      snapTarget.current = {
        weekStart: targetWeek,
        transform: goingPrev ? 'translateX(0%)' : 'translateX(-66.666%)'
      }
      animState.current = 'springing-back'
      // Trigger data load for representative date in new week
      onDateChange(getRepDate(targetWeek))
      // Spring back to current position while loading
      applyTransform('translateX(-33.333%)', true)
    } else {
      applyTransform('translateX(-33.333%)', true)
    }
  }

  function handleTransitionEnd() {
    if (animState.current === 'springing-back') {
      animState.current = 'waiting-load'
      if (!isLoadingRef.current) {
        doSnapForward()
      } else {
        setIsWaiting(true)
      }
    } else if (animState.current === 'snapping-forward') {
      const target = snapTarget.current
      snapTarget.current = null
      animState.current = 'idle'
      setIsWaiting(false)
      if (target) {
        applyTransform('translateX(-33.333%)', false)
        setViewWeekStart(target.weekStart)
      }
    }
  }

  // ── Calendar popup handlers ───────────────────────────────────
  function handleCalendarSelect(day: number) {
    const m = String(calMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    onDateChange(`${calYear}-${m}-${d}`)
    setShowCalendar(false)
  }

  const weeks = [getWeekDays(prevWeekStart), getWeekDays(viewWeekStart), getWeekDays(nextWeekStart)]
  const exitClass = animDir === 'next' ? 'month-exit-up' : 'month-exit-down'
  const enterClass = animDir === 'next' ? 'month-enter-up' : 'month-enter-down'
  const daysInCalMonth = getDaysInMonth(calYear, calMonth)
  const firstCalDay = getFirstDayOfMonth(calYear, calMonth)

  const calendarModal = showCalendar && (
    <div
      onClick={() => setShowCalendar(false)}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '0 24px', boxSizing: 'border-box' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#fff', borderRadius: 24, padding: 20, width: '100%', maxWidth: 340, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1) } else setCalMonth(calMonth - 1) }}
            style={{ width: 36, height: 36, borderRadius: '50%', background: '#f3f4f6', border: 'none', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <span style={{ fontWeight: 600, fontSize: 15, color: '#111' }}>{calYear}年 {MONTHS_ZH[calMonth]}</span>
          <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1) } else setCalMonth(calMonth + 1) }}
            style={{ width: 36, height: 36, borderRadius: '50%', background: '#f3f4f6', border: 'none', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        </div>
        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
          {['日','一','二','三','四','五','六'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>{d}</div>
          ))}
        </div>
        {/* Days */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {Array.from({ length: firstCalDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInCalMonth }).map((_, i) => {
            const day = i + 1
            const m = String(calMonth + 1).padStart(2, '0')
            const d2 = String(day).padStart(2, '0')
            const dateStr = `${calYear}-${m}-${d2}`
            const isSel = dateStr === selectedDate
            const isTod = dateStr === today
            return (
              <div key={day} style={{ display: 'flex', justifyContent: 'center', padding: '3px 0' }}>
                <button onClick={() => handleCalendarSelect(day)} style={{
                  width: 34, height: 34, borderRadius: '50%',
                  border: isTod && !isSel ? '1.5px solid #60a5fa' : 'none',
                  background: isSel ? '#60a5fa' : 'transparent',
                  color: isSel ? '#fff' : isTod ? '#60a5fa' : '#374151',
                  fontWeight: isSel || isTod ? 700 : 400,
                  fontSize: 14, cursor: 'pointer'
                }}>{day}</button>
              </div>
            )
          })}
        </div>
        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button onClick={() => { onDateChange(today); setShowCalendar(false) }}
            style={{ flex: 1, padding: 12, background: '#60a5fa', color: '#fff', border: 'none', borderRadius: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Today</button>
          <button onClick={() => setShowCalendar(false)}
            style={{ flex: 1, padding: 12, background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 14, fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>取消</button>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      {/* Header: centered, calendar icon is clickable */}
      <div className="flex justify-center mb-3">
        <button
          onClick={() => {
            const d = new Date(selectedDate + 'T00:00:00')
            setCalYear(d.getFullYear())
            setCalMonth(d.getMonth())
            setShowCalendar(true)
          }}
          className="flex items-center gap-1.5 active:opacity-60 transition-opacity"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <div style={{ position: 'relative', overflow: 'hidden', height: '1.25rem', minWidth: '5rem' }} className="flex items-center">
            {exitMonth && (
              <span key={`exit-${exitMonth.label}-${exitMonth.year}`} className={`text-sm font-semibold text-gray-700 ${exitClass}`}>
                {exitMonth.label} {exitMonth.year}
              </span>
            )}
            <span key={`enter-${displayMonth.label}-${displayMonth.year}`} className={`text-sm font-semibold text-gray-700 ${enterClass}`}>
              {displayMonth.label} {displayMonth.year}
            </span>
          </div>
        </button>
      </div>

      {/* Weekday labels */}
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
                        if (hasDragged.current || animState.current !== 'idle') return
                        onDateChange(dateStr)
                        if (wi !== 1) {
                          const dir = wi === 0 ? 'prev' : 'next'
                          navDirection.current = dir
                          const targetWeek = dir === 'prev' ? prevWeekStart : nextWeekStart
                          snapTarget.current = { weekStart: targetWeek, transform: dir === 'prev' ? 'translateX(0%)' : 'translateX(-66.666%)' }
                          animState.current = 'springing-back'
                          applyTransform('translateX(-33.333%)', true)
                        }
                      }}
                      className="flex justify-center items-center py-1"
                    >
                      <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium ${
                        isSelected && isToday ? 'bg-blue-400 text-white'
                        : isSelected ? 'bg-gray-200 text-gray-800'
                        : isToday ? 'text-blue-400 font-semibold'
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

      {/* Loading dots while waiting for data before snap */}
      {isWaiting && (
        <div className="flex justify-center gap-1 pt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}

      {/* Calendar portal */}
      {mounted && createPortal(calendarModal, document.body)}
    </div>
  )
}
