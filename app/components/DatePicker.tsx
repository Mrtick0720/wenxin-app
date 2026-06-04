'use client'

import { useState } from 'react'

interface DatePickerProps {
  selectedDate: string
  onDateChange: (date: string) => void
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default function DatePicker({ selectedDate, onDateChange }: DatePickerProps) {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const [showCalendar, setShowCalendar] = useState(false)
  const [viewYear, setViewYear] = useState(new Date(selectedDate).getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date(selectedDate).getMonth())

  const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)

  function formatDisplay(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00')
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
    return `${d.getMonth() + 1}月${d.getDate()}日 ${weekday}`
  }

  function handleDayClick(day: number) {
    const month = String(viewMonth + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    const dateStr = `${viewYear}-${month}-${dayStr}`
    onDateChange(dateStr)
    setShowCalendar(false)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }

  function goToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    onDateChange(todayStr)
    setShowCalendar(false)
  }

  return (
    <>
      {/* 日期显示 + 日历图标 */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-700">
          {selectedDate === todayStr ? `今日 · ${formatDisplay(selectedDate)}` : formatDisplay(selectedDate)}
        </div>
        <button
          onClick={() => setShowCalendar(true)}
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 bg-white text-gray-500"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </button>
      </div>

      {showCalendar && (
        <>
          {/* 背景遮罩 */}
          <div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            onClick={() => setShowCalendar(false)}
          />

          {/* 日历卡片 — 居中浮动 */}
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
            style={{ pointerEvents: 'none' }}
          >
          <div
            className="bg-white rounded-3xl shadow-2xl p-5 w-full"
            style={{
              maxWidth: '360px',
              animation: 'slideInRight 0.25s ease-out forwards',
              pointerEvents: 'auto',
            }}
          >
            {/* 月份导航 */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 text-lg">‹</button>
              <span className="font-semibold text-gray-900">{viewYear}年 {months[viewMonth]}</span>
              <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 text-lg">›</button>
            </div>

            {/* 星期标题 */}
            <div className="grid grid-cols-7 mb-2">
              {weekdays.map(d => (
                <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
              ))}
            </div>

            {/* 日期格子 */}
            <div className="grid grid-cols-7 gap-y-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const month = String(viewMonth + 1).padStart(2, '0')
                const dayStr = String(day).padStart(2, '0')
                const dateStr = `${viewYear}-${month}-${dayStr}`
                const isSelected = dateStr === selectedDate
                const isToday = dateStr === todayStr
                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    className={`aspect-square flex items-center justify-center rounded-full text-sm mx-auto w-9
                      ${isSelected ? 'bg-orange-500 text-white font-semibold' : ''}
                      ${isToday && !isSelected ? 'border border-orange-400 text-orange-500 font-semibold' : ''}
                      ${!isSelected && !isToday ? 'text-gray-700' : ''}
                    `}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {/* Today + 取消 */}
            <div className="mt-4 flex gap-3">
              <button onClick={goToday} className="flex-1 py-3 bg-orange-500 text-white rounded-2xl font-medium text-sm">
                Today
              </button>
              <button onClick={() => setShowCalendar(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-2xl font-medium text-sm">
                取消
              </button>
            </div>
          </div>
          </div>
        </>
      )}
    </>
  )
}
