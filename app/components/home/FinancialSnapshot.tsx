'use client'

import { useRef, useLayoutEffect } from 'react'
import NavLink from '../NavLink'
import type { StaffRole } from '@/lib/auth/types'

const MAX_FONT = 18
const MIN_FONT = 11
const RIGHT_BUFFER = 6

interface Props {
  role: StaffRole
  receivablesTotal: number
  receivablesOpenCount: number
  payablesTotal: number
  payablesDueTodayCount: number
}

function fmt(n: number) {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function FinancialSnapshot({ role, receivablesTotal, receivablesOpenCount, payablesTotal, payablesDueTodayCount }: Props) {
  const isOwner = role === 'owner'

  const items = [
    {
      key: 'receivables',
      label: 'Receivables',
      value: fmt(receivablesTotal),
      note: receivablesOpenCount === 0 ? 'All clear' : `${receivablesOpenCount} outstanding`,
      amountClass: 'text-gray-900',
      noteClass: 'text-gray-400',
      href: '/receivables',
    },
    {
      key: 'payables',
      label: 'Payables',
      value: fmt(payablesTotal),
      note: payablesDueTodayCount > 0 ? `${payablesDueTodayCount} due today` : 'None due today',
      amountClass: 'text-gray-900',
      noteClass: payablesDueTodayCount > 0 ? 'text-orange-500 font-medium' : 'text-gray-400',
      href: '/payables',
    },
    ...(isOwner ? [{
      key: 'cash',
      label: 'Cash',
      value: '—',
      note: 'Manual entry',
      amountClass: 'text-gray-400',
      noteClass: 'text-gray-300',
      href: '/finance',
    }] : []),
  ]

  const spanRefs = useRef<(HTMLSpanElement | null)[]>([])

  useLayoutEffect(() => {
    const fitOne = (span: HTMLSpanElement) => {
      const parent = span.parentElement
      if (!parent) return
      let size = MAX_FONT
      span.style.fontSize = `${size}px`
      let guard = 0
      while (span.scrollWidth > parent.clientWidth - RIGHT_BUFFER && size > MIN_FONT && guard < 80) {
        size -= 0.5
        span.style.fontSize = `${size}px`
        guard += 1
      }
    }
    const fitAll = () => { for (const span of spanRefs.current) { if (span) fitOne(span) } }
    fitAll()
    const ro = new ResizeObserver(fitAll)
    for (const span of spanRefs.current) { if (span?.parentElement) ro.observe(span.parentElement) }
    document.fonts?.ready.then(fitAll).catch(() => {})
    return () => ro.disconnect()
  }, [items.length])

  const cols = isOwner ? 'grid-cols-3' : 'grid-cols-2'

  return (
    <div className={`grid ${cols} gap-2`}>
      {items.map((it, i) => (
        <NavLink key={it.key} href={it.href} className="bg-white rounded-2xl px-4 py-3 shadow-sm block">
          <div className="text-xs text-gray-500 truncate">{it.label}</div>
          <div className="mt-1 pr-1">
            <span
              ref={(el) => { spanRefs.current[i] = el }}
              className={`inline-block whitespace-nowrap font-bold ${it.amountClass}`}
              style={{ fontSize: `${MAX_FONT}px`, lineHeight: 1.3 }}>
              {it.value}
            </span>
          </div>
          <div className={`text-[11px] mt-0.5 truncate ${it.noteClass}`}>{it.note}</div>
        </NavLink>
      ))}
    </div>
  )
}
