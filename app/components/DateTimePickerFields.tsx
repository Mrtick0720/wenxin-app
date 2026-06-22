'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))
const ITEM_HEIGHT = 48

function normalizeTimeValue(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return ''
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return ''
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

type SharedFieldProps = {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  className?: string
  placeholder?: string
}

type DatePickerFieldProps = SharedFieldProps & {
  min?: string
  max?: string
}

export function DatePickerField({
  value,
  onChange,
  ariaLabel,
  className = '',
  placeholder = 'Select date',
  min,
  max,
}: DatePickerFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function openPicker() {
    const input = inputRef.current
    if (!input) return
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker()
        return
      }
    } catch {
      // Fall through to the browser's focus/click behavior.
    }
    input.focus()
    input.click()
  }

  return (
    <div className={`relative min-w-0 ${className}`}>
      {/* Visual button — pointer-events: none so taps fall through to the native input */}
      <div
        aria-label={ariaLabel}
        className="pointer-events-none flex h-[46px] w-full min-w-0 items-center overflow-hidden rounded-xl border border-gray-200 bg-white px-4 text-left text-sm"
      >
        <span className={`truncate ${value ? 'text-gray-800' : 'text-gray-400'}`}>
          {value || placeholder}
        </span>
      </div>
      {/* Native input covers the full button — iOS Safari taps it directly */}
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={event => onChange(event.target.value)}
        onClick={openPicker}
        className="absolute inset-0 h-full w-full cursor-pointer rounded-xl opacity-0"
        style={{ fontSize: 16 }}
      />
    </div>
  )
}

type TimePickerFieldProps = SharedFieldProps & {
  title?: string
}

export function TimePickerField({
  value,
  onChange,
  ariaLabel,
  className = '',
  placeholder = 'Select time',
  title = 'Select Time',
}: TimePickerFieldProps) {
  const [open, setOpen] = useState(false)
  const [draftHour, setDraftHour] = useState('00')
  const [draftMinute, setDraftMinute] = useState('00')
  const displayValue = normalizeTimeValue(value)

  function openPicker() {
    const now = new Date()
    const [hour, minute] = displayValue
      ? displayValue.split(':')
      : [String(now.getHours()).padStart(2, '0'), String(now.getMinutes()).padStart(2, '0')]
    setDraftHour(hour)
    setDraftMinute(minute)
    setOpen(true)
  }

  function confirm() {
    onChange(`${draftHour}:${draftMinute}`)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        aria-label={ariaLabel}
        className={`flex h-[46px] w-full min-w-0 items-center overflow-hidden rounded-xl border border-gray-200 bg-white px-4 text-left text-sm outline-none focus:border-orange-400 ${className}`}
      >
        <span className={`truncate tabular-nums ${displayValue ? 'text-gray-800' : 'text-gray-400'}`}>
          {displayValue || placeholder}
        </span>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[2147483647] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
          onKeyDown={event => {
            if (event.key === 'Escape') setOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="w-full rounded-t-3xl bg-white shadow-2xl sm:max-w-sm sm:rounded-3xl"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-gray-500">
                Cancel
              </button>
              <div className="text-base font-semibold text-gray-900">{title}</div>
              <button type="button" onClick={confirm} className="text-sm font-semibold text-orange-500">
                Confirm
              </button>
            </div>

            <div className="relative mx-auto grid max-w-xs grid-cols-2 gap-4 px-6 py-5">
              <div className="pointer-events-none absolute left-6 right-6 top-1/2 h-12 -translate-y-1/2 rounded-xl bg-orange-50" />
              <WheelColumn
                label="Hour"
                values={HOURS}
                selected={draftHour}
                onSelect={setDraftHour}
              />
              <WheelColumn
                label="Minute"
                values={MINUTES}
                selected={draftMinute}
                onSelect={setDraftMinute}
              />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

function WheelColumn({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string
  values: string[]
  selected: string
  onSelect: (value: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedIndex = Math.max(0, values.indexOf(selected))

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      ref.current?.scrollTo({ top: selectedIndex * ITEM_HEIGHT })
    })
    return () => cancelAnimationFrame(frame)
  }, [selectedIndex])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  function handleScroll() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const element = ref.current
      if (!element) return
      const index = Math.max(0, Math.min(values.length - 1, Math.round(element.scrollTop / ITEM_HEIGHT)))
      onSelect(values[index])
    }, 80)
  }

  function choose(value: string, index: number) {
    onSelect(value)
    ref.current?.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' })
  }

  return (
    <div className="relative z-10 min-w-0">
      <div className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div
        ref={ref}
        onScroll={handleScroll}
        className="h-60 snap-y snap-mandatory overflow-y-auto overscroll-contain no-scrollbar"
        style={{ paddingBlock: ITEM_HEIGHT * 2 }}
      >
        {values.map((item, index) => (
          <button
            key={item}
            type="button"
            onClick={() => choose(item, index)}
            className={`flex h-12 w-full snap-center items-center justify-center text-2xl tabular-nums transition-colors ${
              item === selected ? 'font-semibold text-orange-500' : 'text-gray-400'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  )
}
