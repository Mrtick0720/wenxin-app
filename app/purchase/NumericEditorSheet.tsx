'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { SheetActionFooter } from '@/components/ui/SheetActionFooter'

// ── Custom numeric keypad (compact) ──────────────────────────────────────────
// Digit key button — declared at module scope to avoid react-hooks/static-components
const DIGIT_BASE =
  'h-[44px] flex items-center justify-center rounded-2xl border border-gray-200 ' +
  'select-none touch-manipulation transition-all duration-100 ease-out ' +
  'active:scale-95'
const digitCls = `${DIGIT_BASE} bg-gray-50 text-gray-900 text-xl font-bold active:bg-gray-200`
const dotCls   = `${DIGIT_BASE} bg-gray-50 text-gray-700 text-2xl font-bold leading-none active:bg-gray-200`
const delCls   = `${DIGIT_BASE} bg-gray-100 text-gray-500 active:bg-gray-200`

function DigitKey({ k, onKey }: { k: string; onKey: (k: string) => void }) {
  return <button type="button" className={digitCls} onClick={() => onKey(k)}>{k}</button>
}

function NumKeypad({ onKey, dotDisabled }: { onKey: (k: string) => void; dotDisabled: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <DigitKey k="1" onKey={onKey} /><DigitKey k="2" onKey={onKey} /><DigitKey k="3" onKey={onKey} />
      <DigitKey k="4" onKey={onKey} /><DigitKey k="5" onKey={onKey} /><DigitKey k="6" onKey={onKey} />
      <DigitKey k="7" onKey={onKey} /><DigitKey k="8" onKey={onKey} /><DigitKey k="9" onKey={onKey} />
      <button
        type="button"
        className={dotDisabled ? `${DIGIT_BASE} bg-gray-100 text-gray-300 cursor-not-allowed` : dotCls}
        onClick={() => { if (!dotDisabled) onKey('.') }}
        aria-label="Decimal point"
        aria-disabled={dotDisabled}
      >.</button>
      <DigitKey k="0" onKey={onKey} />
      <button type="button" className={delCls} onClick={() => onKey('⌫')} aria-label="Delete">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
          <line x1="18" y1="9" x2="12" y2="15"/>
          <line x1="12" y1="9" x2="18" y2="15"/>
        </svg>
      </button>
    </div>
  )
}

// ── Shared numeric editor bottom sheet ───────────────────────────────────────
// Used by:
//   1. Purchase Records — tap quantity or unit price cell → edit both fields
//   2. Purchase Checklist — tap completion circle → enter unit price

type ActiveField = 'quantity' | 'unit_price'

export type NumericEditorSheetProps = {
  // Display
  title: string
  itemName: string
  unit: string

  // Initial values
  initialQuantity: number
  initialUnitPrice: number | null
  initialSupplier?: string
  initialActiveField?: ActiveField

  // Mode flags
  quantityEditable: boolean
  showSupplier: boolean

  // Actions
  onSave: (data: {
    quantity: number
    unitPrice: number
    supplier: string
  }) => Promise<{ ok: boolean; error?: string }>
  onClose: () => void
  // Optional destructive action rendered as a red button below Cancel/Save.
  onDelete?: () => void
  deleteLabel?: string
}

export default function NumericEditorSheet({
  title,
  itemName,
  unit,
  initialQuantity,
  initialUnitPrice,
  initialSupplier = '',
  initialActiveField,
  quantityEditable,
  showSupplier,
  onSave,
  onClose,
  onDelete,
  deleteLabel = 'Delete',
}: NumericEditorSheetProps) {
  const [active, setActive] = useState<ActiveField>(
    initialActiveField ?? (quantityEditable ? 'quantity' : 'unit_price'),
  )
  const [qtyStr, setQtyStr] = useState(
    initialQuantity > 0 ? String(initialQuantity) : '',
  )
  // Price uses money/cents mode: stored as integer cents, displayed as 2-decimal amount.
  // No decimal key needed — digits shift left like a Touch 'n Go terminal.
  const [priceCents, setPriceCents] = useState(
    initialUnitPrice != null && initialUnitPrice > 0
      ? Math.round((initialUnitPrice + Number.EPSILON) * 100)
      : 0,
  )
  const [supplier, setSupplier] = useState(initialSupplier)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Slide animation
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const dismiss = useCallback(() => {
    setVisible(false)
    setTimeout(() => onClose(), 250)
  }, [onClose])

  const isQtyActive = active === 'quantity'
  const qtyNum   = parseFloat(qtyStr) || 0
  const priceNum = priceCents / 100

  function handleKey(k: string) {
    setError(null)

    // ── Price field: Touch 'n Go / cents mode ─────────────────────────────────
    // Digits shift left (append cent digit). No decimal key — it's a no-op.
    // Cap at RM 9,999.99 = 999,999 cents.
    if (!isQtyActive) {
      if (k === '⌫') {
        setPriceCents(c => Math.floor(c / 10))
        return
      }
      if (k === '.') return  // decimal not needed in money mode
      const d = parseInt(k, 10)
      if (isNaN(d)) return
      setPriceCents(c => Math.min(c * 10 + d, 999999))
      return
    }

    // ── Quantity field: normal decimal mode (unchanged) ───────────────────────
    const value    = qtyStr
    const setValue = setQtyStr

    if (k === '⌫') {
      setValue(value.length <= 1 ? '' : value.slice(0, -1))
      return
    }
    if (k === '.') {
      if (value.includes('.')) return
      setValue(value === '' ? '0.' : value + '.')
      return
    }
    // Collapse lone leading zero
    if (value === '0') { setValue(k); return }
    // Cap at 3 decimal places for weights
    const dotIdx = value.indexOf('.')
    if (dotIdx >= 0 && value.length - dotIdx > 3) return
    // Max 7 significant digits
    if (value.replace('.', '').length >= 7) return
    setValue(value + k)
  }

  async function handleSave() {
    if (qtyNum <= 0) {
      if (quantityEditable) { setActive('quantity'); setError('Quantity must be greater than zero.'); return }
      setError('Invalid quantity.'); return
    }
    if (priceCents <= 0) { setActive('unit_price'); setError('Enter a valid unit price.'); return }
    setSaving(true)
    setError(null)
    const res = await onSave({
      quantity: qtyNum,
      unitPrice: priceNum,   // priceCents / 100 — normal decimal submitted to server
      supplier: supplier.trim(),
    })
    setSaving(false)
    if (!res.ok) { setError(res.error ?? 'Save failed.'); return }
    dismiss()
  }

  // Card styling
  function cardCls(fieldActive: boolean) {
    return 'flex-1 rounded-2xl px-3 py-3 text-left transition-colors border ' +
      (fieldActive ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white active:bg-gray-50')
  }

  const qtyDisplay   = qtyStr === '' ? '0' : qtyStr
  const priceDisplay = (priceCents / 100).toFixed(2)

  // Maximum safe z-index (32-bit signed int max) so the sheet trumps everything
  // including any intermediate stacking contexts created by transforms or position:fixed.
  const Z_MAX = 2147483647

  const sheet = (
    <div
      className="fixed"
      style={{
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: visible ? Z_MAX : -1,
        background: visible ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
        transition: 'background 0.25s ease',
        // When invisible or closing, let taps pass through to content beneath
        pointerEvents: visible ? 'auto' : 'none',
      }}
      onClick={dismiss}
    >
      {/* Sheet — slides up from bottom, covers everything including bottom nav */}
      <div
        className="fixed left-0 right-0 bg-white rounded-t-3xl flex flex-col"
        style={{
          bottom: 0,
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.25s ease',
          maxHeight: '100dvh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="px-4 pt-1 pb-2 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="font-semibold text-base text-gray-900">{title}</div>
            <div className="text-xs text-gray-400 mt-0.5">{itemName}</div>
          </div>
          <button type="button" onClick={dismiss} className="text-gray-400 text-2xl leading-none p-1">×</button>
        </div>

        {/* Dual input cards */}
        <div className="px-4 pb-2 flex-shrink-0">
          {error && (
            <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
          )}
          <div className="flex gap-3">
            {/* Quantity card */}
            <button
              type="button"
              onClick={() => { if (quantityEditable) setActive('quantity') }}
              className={cardCls(isQtyActive)}
              style={{ cursor: quantityEditable ? 'pointer' : 'default' }}
            >
              <div className="text-xs font-medium text-gray-400 mb-1">Quantity</div>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold tabular-nums ${quantityEditable ? 'text-gray-900' : 'text-gray-500'}`}>
                  {qtyDisplay}
                </span>
                <span className="text-sm text-gray-400">{unit}</span>
              </div>
            </button>
            {/* Unit Price card */}
            <button
              type="button"
              onClick={() => setActive('unit_price')}
              className={cardCls(!isQtyActive)}
            >
              <div className="text-xs font-medium text-gray-400 mb-1">Unit Price</div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm text-gray-400">RM</span>
                <span className="text-2xl font-bold text-gray-900 tabular-nums">{priceDisplay}</span>
                <span className="text-sm text-gray-400">/{unit}</span>
              </div>
            </button>
          </div>
          {/* Live total */}
          <div className="text-center text-sm text-gray-400 mt-3">
            {`${qtyNum % 1 === 0 ? qtyNum.toFixed(0) : qtyNum.toFixed(2)} ${unit} × RM ${priceNum.toFixed(2)} = `}
            <span className="font-semibold text-gray-700">
              RM {(qtyNum * priceNum).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Optional supplier field */}
        {showSupplier && (
          <div className="px-4 pb-2 flex-shrink-0">
            <label className="text-xs text-gray-400 mb-1 block">Supplier (optional)</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400"
              style={{ fontSize: 16 }}
              placeholder="e.g. KK Meat Supply"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
          </div>
        )}

        {/* Custom numeric keypad — decimal dot is disabled when price field is active */}
        <div className="px-4 pb-1 flex-shrink-0">
          <NumKeypad onKey={handleKey} dotDisabled={!isQtyActive} />
        </div>

        {/* Action buttons */}
        <SheetActionFooter>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={dismiss}
              className="flex-1 flex items-center justify-center rounded-2xl text-base font-semibold bg-gray-100 text-gray-600 active:opacity-80"
              style={{ minHeight: 50 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || qtyNum <= 0 || priceCents <= 0}
              className="flex-1 flex items-center justify-center rounded-2xl text-base font-semibold text-white active:opacity-90"
              style={{ minHeight: 50, background: saving || qtyNum <= 0 || priceNum <= 0 ? '#d1d5db' : '#f97316' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-2xl text-base font-semibold active:opacity-80"
              style={{ minHeight: 50, background: '#fef2f2', color: '#ef4444' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
              {deleteLabel}
            </button>
          )}
        </SheetActionFooter>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(sheet, document.body)
}
