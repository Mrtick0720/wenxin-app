'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { todayLocalStr, addDays, getMondayOfWeek } from '@/lib/dateUtils'

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTHS_ZH = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

function getWeekDays(mondayStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayStr, i))
}

function getMonthInfo(weekStart: string) {
  const d = new Date(weekStart + 'T00:00:00')
  return { key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS_ZH[d.getMonth()], year: d.getFullYear() }
}

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function getFirstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay() }

interface DatePickerProps {
  selectedDate: string
  onDateChange: (date: string) => void
}

export default function DatePicker({ selectedDate, onDateChange }: DatePickerProps) {
  const today = todayLocalStr()
  const [viewWeekStart, setViewWeekStart] = useState(() => getMondayOfWeek(selectedDate))

  // Calendar popup
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

  // Strip refs
  const stripRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const isDragging = useRef(false)
  const hasDragged = useRef(false)
  const animRef = useRef<Animation | null>(null)
  const navDirection = useRef<'next' | 'prev'>('next')
  const resetTransformAfterRender = useRef(false)

  // After React commits new week content, reset transform before browser paints
  useLayoutEffect(() => {
    if (resetTransformAfterRender.current) {
      resetTransformAfterRender.current = false
      setTransform('translateX(-33.333%)')
    }
  }, [viewWeekStart]) // eslint-disable-line

  // Month animation
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

  // Sync view when selectedDate changes externally
  useEffect(() => {
    const monday = getMondayOfWeek(selectedDate)
    if (monday !== viewWeekStart && !isDragging.current && !animRef.current) {
      setTransform('translateX(-33.333%)')
      setViewWeekStart(monday)
    }
  }, [selectedDate]) // eslint-disable-line

  const prevWeekStart = addDays(viewWeekStart, -7)
  const nextWeekStart = addDays(viewWeekStart, 7)

  // Instant transform, no animation
  function setTransform(value: string) {
    const el = stripRef.current
    if (!el) return
    if (animRef.current) {
      try { animRef.current.commitStyles() } catch {}
      animRef.current.cancel()
      animRef.current = null
    }
    el.style.transform = value
  }

  // Animated transform via Web Animations API — consistent across iOS/Android
  function animateTransform(target: string, onDone?: () => void) {
    const el = stripRef.current
    if (!el) return
    if (animRef.current) {
      try { animRef.current.commitStyles() } catch {}
      animRef.current.cancel()
      animRef.current = null
    }
    // Read actual pixel offset via DOMMatrix to avoid calc(%+px) unit-mismatch across platforms
    const matrix = new DOMMatrix(window.getComputedStyle(el).transform)
    const from = `translateX(${matrix.m41}px)`
    const anim = el.animate(
      [{ transform: from }, { transform: target }],
      { duration: 500, easing: 'cubic-bezier(0, 0, 0.15, 1)', fill: 'forwards' }
    )
    animRef.current = anim
    anim.onfinish = () => {
      if (animRef.current !== anim) return
      try { anim.commitStyles() } catch {}
      anim.cancel()
      animRef.current = null
      onDone?.()
    }
  }

  function getContainerWidth() {
    return stripRef.current?.parentElement?.clientWidth ?? 300
  }

  // Representative date in target week: same day-of-week as selectedDate
  function getRepDate(newWeekStart: string): string {
    const d = new Date(selectedDate + 'T00:00:00')
    const idx = d.getDay() === 0 ? 6 : d.getDay() - 1
    return addDays(newWeekStart, idx)
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (animRef.current) return
    touchStartX.current = e.touches[0].clientX
    isDragging.current = true
    hasDragged.current = false
    setTransform('translateX(-33.333%)')
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging.current) return
    const delta = e.touches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 3) hasDragged.current = true
    const el = stripRef.current
    if (el) el.style.transform = `translateX(calc(-33.333% + ${delta}px))`
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!isDragging.current) return
    isDragging.current = false
    const delta = e.changedTouches[0].clientX - touchStartX.current
    const threshold = getContainerWidth() * 0.22

    if (delta > threshold) {
      navDirection.current = 'prev'
      const targetWeek = prevWeekStart
      onDateChange(getRepDate(targetWeek))
      animateTransform('translateX(0%)', () => {
        resetTransformAfterRender.current = true
        setViewWeekStart(targetWeek)
      })
    } else if (delta < -threshold) {
      navDirection.current = 'next'
      const targetWeek = nextWeekStart
      onDateChange(getRepDate(targetWeek))
      animateTransform('translateX(-66.666%)', () => {
        resetTransformAfterRender.current = true
        setViewWeekStart(targetWeek)
      })
    } else {
      animateTransform('translateX(-33.333%)')
    }
  }

  // Calendar popup handlers
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
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 99999 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 16px 40px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1) } else setCalMonth(calMonth - 1) }}
            style={{ width: 40, height: 40, borderRadius: '50%', background: '#f3f4f6', border: 'none', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <span style={{ fontWeight: 600, fontSize: 17, color: '#111' }}>{calYear}年 {MONTHS_ZH[calMonth]}</span>
          <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1) } else setCalMonth(calMonth + 1) }}
            style={{ width: 40, height: 40, borderRadius: '50%', background: '#f3f4f6', border: 'none', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
          {['日','一','二','三','四','五','六'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>{d}</div>
          ))}
        </div>
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
              <div key={day} style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                <button onClick={() => handleCalendarSelect(day)} style={{
                  width: 38, height: 38, borderRadius: '50%',
                  border: isTod && !isSel ? '1.5px solid #60a5fa' : 'none',
                  background: isSel ? '#60a5fa' : 'transparent',
                  color: isSel ? '#fff' : isTod ? '#60a5fa' : '#374151',
                  fontWeight: isSel || isTod ? 700 : 400,
                  fontSize: 16, cursor: 'pointer'
                }}>{day}</button>
              </div>
            )
          })}
        </div>
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
      {/* Centered header — calendar icon + month label, both clickable */}
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

      {/* Static weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-xs text-gray-300 font-medium pb-1">{label}</div>
        ))}
      </div>

      {/* Sliding week strip */}
      <div className="overflow-hidden">
        <div
          ref={stripRef}
          className="flex"
          style={{ width: '300%', transform: 'translateX(-33.333%)', willChange: 'transform' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {weeks.map((weekDays, wi) => (
            <div key={wi} style={{ width: '33.333%' }}>
              <div className="grid grid-cols-7">
                {weekDays.map((dateStr) => {
                  const day = new Date(dateStr + 'T00:00:00').getDate()
                  const isSelected = dateStr === selectedDate
                  const isToday = dateStr === today
                  return (
                    <button
                      key={dateStr}
                      onClick={() => {
                        if (hasDragged.current || animRef.current) return
                        onDateChange(dateStr)
                        if (wi !== 1) {
                          const dir = wi === 0 ? 'prev' : 'next'
                          navDirection.current = dir
                          const targetWeek = dir === 'prev' ? prevWeekStart : nextWeekStart
                          const targetTransform = dir === 'prev' ? 'translateX(0%)' : 'translateX(-66.666%)'
                          animateTransform(targetTransform, () => {
                            resetTransformAfterRender.current = true
                            setViewWeekStart(targetWeek)
                          })
                        }
                      }}
                      className="flex justify-center items-center py-1"
                    >
                      <span className="relative w-8 h-8 flex items-center justify-center">
                        <span
                          className="absolute inset-0 rounded-full"
                          style={{
                            transform: isSelected ? 'scale(1)' : 'scale(0)',
                            transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            backgroundColor: isToday ? '#60a5fa' : '#e5e7eb',
                          }}
                        />
                        <span
                          className="relative text-sm font-medium"
                          style={{
                            transition: 'color 0.18s ease',
                            color: isSelected && isToday ? '#fff' : isSelected ? '#111827' : isToday ? '#60a5fa' : '#374151',
                            fontWeight: isToday ? 600 : 400,
                          }}
                        >
                          {day}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {mounted && createPortal(calendarModal, document.body)}
    </div>
  )
}
