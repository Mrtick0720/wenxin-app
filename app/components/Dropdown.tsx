'use client'

import { useState, useRef, useEffect } from 'react'

interface DropdownProps {
  value: string
  options: { label: string; value: string }[]
  onChange: (value: string) => void
}

export default function Dropdown({ value, options, onChange }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: Event) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [open])

  const selected = options.find(o => o.value === value)

  return (
    <div ref={containerRef} className="relative flex-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full bg-white border border-gray-200 rounded-xl px-2 py-1.5 text-xs text-gray-600 flex items-center justify-between gap-1"
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          className={`flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-full bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs ${
                opt.value === value ? 'text-orange-500 font-medium bg-orange-50' : 'text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
