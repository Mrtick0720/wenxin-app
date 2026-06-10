'use client'

import { useRef, useLayoutEffect } from 'react'

// TODO: Replace PLACEHOLDER_FINANCIALS with real POS API data once the
// POS integration lands. This section is intentionally NOT connected to
// Supabase — the values below are static UI placeholders only.
const PLACEHOLDER_FINANCIALS = {
  receivables: { amount: 5200, note: '3 pending' },
  payables: { amount: 8700, note: '2 due today' },
  cash: { amount: 45320, note: '+RM 2,100' },
}

// Auto-fit each currency value to its own card width: never truncate, never
// clip, never show an ellipsis. Each amount shrinks independently based on its
// length until it fits, with a right-side buffer so the final digit always has
// breathing room. Re-fits on container resize AND on web-font load (a late
// font swap widens the text after the first measure — the classic clip bug).
const MAX_FONT = 18 // px — matches the previous text-lg size
const MIN_FONT = 11 // px — floor so values stay readable
const RIGHT_BUFFER = 6 // px — guaranteed clearance after the last digit

export default function FinancialSnapshot() {
  const { receivables, payables, cash } = PLACEHOLDER_FINANCIALS
  const items = [
    { key: 'receivables', label: 'Receivables', amount: receivables.amount, note: receivables.note, amountClass: 'text-gray-900', noteClass: 'text-gray-400' },
    { key: 'payables', label: 'Payables', amount: payables.amount, note: payables.note, amountClass: 'text-gray-900', noteClass: 'text-orange-500 font-medium' },
    { key: 'cash', label: 'Cash', amount: cash.amount, note: cash.note, amountClass: 'text-green-600', noteClass: 'text-gray-400' },
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
    const fitAll = () => {
      for (const span of spanRefs.current) {
        if (span) fitOne(span)
      }
    }

    fitAll()

    const ro = new ResizeObserver(fitAll)
    for (const span of spanRefs.current) {
      if (span?.parentElement) ro.observe(span.parentElement)
    }
    // Re-measure once web fonts finish loading (their wider glyphs land after
    // the first synchronous fit and would otherwise overflow).
    document.fonts?.ready.then(fitAll).catch(() => {})

    return () => ro.disconnect()
  }, [])

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((it, i) => (
        <div key={it.key} className="bg-white rounded-2xl px-4 py-3 shadow-sm">
          <div className="text-xs text-gray-500 truncate">{it.label}</div>
          <div className="mt-1 pr-1">
            <span
              ref={(el) => { spanRefs.current[i] = el }}
              className={`inline-block whitespace-nowrap font-bold ${it.amountClass}`}
              style={{ fontSize: `${MAX_FONT}px`, lineHeight: 1.3 }}
            >
              RM {it.amount.toLocaleString()}
            </span>
          </div>
          <div className={`text-[11px] mt-0.5 truncate ${it.noteClass}`}>{it.note}</div>
        </div>
      ))}
    </div>
  )
}
