'use client'

import { useState, useEffect, useRef } from 'react'

// ── MoneyInput ────────────────────────────────────────────────────────────────
// Touch 'n Go-style money input: digits are entered as cents and displayed as a
// 2-decimal currency amount. No decimal key needed.
//
// Examples:
//   type 1      → 0.01
//   type 12     → 0.12
//   type 1234   → 12.34
//   backspace   → 1.23
//
// Paste rules (per product spec):
//   "12.34" (has decimal)  → RM 12.34  (treat as dollar amount)
//   "1234"  (digits only)  → RM 12.34  (treat as cents)
//   "RM 45.50"             → RM 45.50  (strip non-digit/dot, then decimal rule)
//
// Limits:
//   max="price"  →  RM 9,999.99 (unit price, small amounts)
//   max="cash"   → RM 99,999.99 (cash/sales/large amounts) — default
//
// nullable mode:
//   When nullable=true, backspacing to 0 calls onChange(null) and shows "".
//   Used for optional fields where empty ≠ zero (e.g. ImportSessionSheet).
//   When nullable=false (default), the minimum visible value is "0.00".

const MAX_CENTS = {
  price: 999999,   // RM 9,999.99
  cash:  9999999,  // RM 99,999.99
}

function toCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100)
}

export type MoneyInputProps = {
  value: number | null
  onChange: (value: number | null) => void
  nullable?: boolean
  max?: 'price' | 'cash'
  className?: string
  style?: React.CSSProperties
  placeholder?: string
  disabled?: boolean
}

export default function MoneyInput({
  value,
  onChange,
  nullable = false,
  max = 'cash',
  className,
  style,
  placeholder = '0.00',
  disabled = false,
}: MoneyInputProps) {
  const maxCents = MAX_CENTS[max]

  const [cents, setCents] = useState<number>(() =>
    value !== null && value !== undefined ? toCents(value) : 0,
  )
  // Empty state: only active when nullable=true and the current logical value is null
  const [empty, setEmpty] = useState<boolean>(
    nullable && (value === null || value === undefined),
  )

  // Sync when the controlled value changes from outside (e.g. form reset)
  const prevRef = useRef(value)
  useEffect(() => {
    if (prevRef.current === value) return
    prevRef.current = value
    if (value === null || value === undefined) {
      setCents(0)
      setEmpty(nullable)
    } else {
      setCents(toCents(value))
      setEmpty(false)
    }
  }, [value, nullable])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    const newCents = Math.min(parseInt(digits || '0', 10), maxCents)

    setCents(newCents)
    if (newCents === 0 && nullable) {
      setEmpty(true)
      onChange(null)
    } else {
      setEmpty(false)
      onChange(newCents / 100)
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').trim()
    // Strip currency symbols, spaces, commas — keep digits and dot
    const cleaned = text.replace(/[^\d.]/g, '')
    if (!cleaned) return

    let newCents: number
    if (cleaned.includes('.')) {
      // Has decimal point → treat as a dollar/ringgit amount
      newCents = toCents(parseFloat(cleaned))
    } else {
      // Digits only → treat as cents (spec: "1234" → RM 12.34)
      newCents = parseInt(cleaned, 10)
    }
    newCents = Math.min(newCents, maxCents)
    setCents(newCents)
    setEmpty(false)
    onChange(newCents / 100)
  }

  const displayValue = empty ? '' : (cents / 100).toFixed(2)

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onPaste={handlePaste}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      style={style}
    />
  )
}
