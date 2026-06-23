'use client'

import { useEffect, useState } from 'react'

type ToastType = 'success' | 'error'

interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  onDone?: () => void
}

export function Toast({ message, type = 'success', duration = 2200, onDone }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDone?.(), 300)
    }, duration)
    return () => clearTimeout(t)
  }, [duration, onDone])

  const bg = type === 'success' ? '#16a34a' : '#dc2626'
  const icon = type === 'success'
    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>

  return (
    <div
      className="fixed left-1/2 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-white text-sm font-medium transition-all duration-300"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        transform: `translateX(-50%) translateY(${visible ? '0' : '-80px'})`,
        opacity: visible ? 1 : 0,
        background: bg,
        maxWidth: 'calc(100vw - 48px)',
        whiteSpace: 'pre-line',
      }}
    >
      {icon}
      <span>{message}</span>
    </div>
  )
}

// Hook for managing toast state
export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  function show(message: string, type: ToastType = 'success') {
    setToast({ message, type })
  }

  function clear() { setToast(null) }

  const node = toast ? <Toast key={toast.message + toast.type} message={toast.message} type={toast.type} onDone={clear} /> : null

  return { show, node }
}
