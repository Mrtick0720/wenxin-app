'use client'

import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react'
import type { StaffRole } from '@/lib/auth/types'
import {
  PURCHASE_CATEGORIES,
  categoryColor,
} from '@/lib/purchaseLedger/categories'
import type { PurchaseSummary, PurchaseKpi, RatioPeriod, PurchaseRecord } from '@/lib/purchaseLedger/types'
import BackButton from '../components/BackButton'
import { useNavigation } from '../components/NavigationStack'
import {
  fetchPurchaseContextAction,
  fetchRecordsAction,
  fetchSummaryAction,
  fetchKpiAction,
  fetchCatalogAction,
  createRecordAction,
  updateRecordAction,
  deleteRecordAction,
} from './actions'
import { moveRecordToChecklistAction } from './checklist-actions'
import type { ChecklistEntry } from './checklist-actions'
import CatalogCombobox from './CatalogCombobox'
import QuickEditSheet from './QuickEditSheet'
import ChecklistSection from './ChecklistSection'
import type { CatalogItem } from '@/lib/purchaseLedger/catalog'

const DetailClient = lazy(() => import('./[id]/DetailClient'))
const CostRatioDetailsClient = lazy(() => import('./CostRatioDetailsClient'))

// Loose record shape — cost keys are absent for staff (kitchen).
export type LedgerRecord = {
  id: number
  date: string
  name: string
  specification: string | null
  category: string
  unit: string
  quantity: number
  purchaser: string | null
  receiver: string | null
  note: string | null
  status: string
  created_by: string | null
  created_at: string | null
  unit_price?: number | null
  total_price?: number | null
  supplier?: string | null
}

type Perms = { canViewCosts: boolean; canDelete: boolean; canExport: boolean }
type InlineEditField = 'quantity' | 'unit_price'
type InlineEditTarget = { record: LedgerRecord; field: InlineEditField }

const UNITS = ['kg', 'g', 'pcs', 'pack', 'box', 'bottle', 'bag', 'tray', 'bundle', 'carton', 'pail', 'portion']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December']

function rm(n: number | null | undefined) {
  return `RM ${(n ?? 0).toFixed(2)}`
}

function ratioText(r: number | null) {
  return r === null ? '—' : `${r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)}%`
}

function heroStatus(ratio: number | null): 'good' | 'warning' | 'bad' | 'na' {
  if (ratio === null) return 'na'
  if (ratio <= 30) return 'good'
  if (ratio <= 40) return 'warning'
  return 'bad'
}

function heroStatusLabel(st: 'good' | 'warning' | 'bad' | 'na'): string {
  switch (st) {
    case 'good':    return 'Good'
    case 'warning': return 'Watch'
    case 'bad':     return 'Too high'
    default:        return 'No data'
  }
}

const HERO_COLOR = {
  good:    { text: '#15803d', bg: '#dcfce7' },
  warning: { text: '#92400e', bg: '#fef3c7' },
  bad:     { text: '#991b1b', bg: '#fee2e2' },
  na:      { text: '#6b7280', bg: '#f3f4f6' },
}

// ── History grouping ──
function historyDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`
}

type DayGroup   = { date: string; label: string; items: LedgerRecord[]; total: number }
type MonthGroup = { monthKey: string; monthLabel: string; days: DayGroup[]; total: number }

function groupHistory(records: LedgerRecord[], today: string): MonthGroup[] {
  const months = new Map<string, MonthGroup>()
  const dayMap  = new Map<string, DayGroup>()

  for (const r of records) {
    if (r.date === today) continue
    const monthKey = r.date.slice(0, 7)
    const d = new Date(r.date + 'T00:00:00')
    const monthLabel = `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`

    if (!months.has(monthKey)) {
      months.set(monthKey, { monthKey, monthLabel, days: [], total: 0 })
    }
    const month = months.get(monthKey)!

    if (!dayMap.has(r.date)) {
      const dg: DayGroup = { date: r.date, label: historyDayLabel(r.date), items: [], total: 0 }
      dayMap.set(r.date, dg)
      month.days.push(dg)
    }
    const day = dayMap.get(r.date)!
    day.items.push(r)
    day.total   += r.total_price ?? 0
    month.total += r.total_price ?? 0
  }

  return [...months.values()].sort((a, b) => b.monthKey.localeCompare(a.monthKey))
}

// ── Inline single-field edit sheet ──
function InlineFieldEditSheet({
  target, onClose, onSaved,
}: {
  target: InlineEditTarget
  onClose: () => void
  onSaved: () => void
}) {
  const { record, field } = target
  const isQty = field === 'quantity'
  const [value, setValue] = useState(
    isQty
      ? String(record.quantity)
      : record.unit_price != null ? String(record.unit_price) : '',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const qty   = isQty ? (parseFloat(value) || 0) : record.quantity
  const up    = isQty ? (record.unit_price ?? 0) : (parseFloat(value) || 0)
  const total = qty * up

  async function handleSave() {
    const num = parseFloat(value)
    if (!value || isNaN(num) || num <= 0) {
      setError(isQty ? 'Quantity must be greater than zero.' : 'Enter a valid price.')
      return
    }
    setSaving(true)
    setError(null)
    const res = await updateRecordAction(record.id, {
      name:          record.name,
      specification: record.specification ?? null,
      category:      record.category,
      unit:          record.unit,
      quantity:      isQty ? num : record.quantity,
      unit_price:    isQty ? (record.unit_price ?? null) : num,
      supplier:      record.supplier ?? null,
      purchaser:     record.purchaser ?? null,
      receiver:      record.receiver ?? null,
      remarks:       record.note ?? null,
    })
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    onSaved()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[450] flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.4)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="font-semibold text-base">{isQty ? 'Edit Quantity' : 'Edit Unit Price'}</div>
            <div className="text-xs text-gray-400 mt-0.5">{record.name}</div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>
        <div className="px-4 pt-4 pb-3 space-y-3">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
          )}
          <input
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-3 py-3 outline-none focus:border-orange-400 text-gray-900"
            style={{ fontSize: 28, fontWeight: 600 }}
            type="number"
            inputMode="decimal"
            placeholder={isQty ? '0' : '0.00'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
          />
          {qty > 0 && up > 0 && (
            <div className="flex items-center justify-between px-1 text-sm">
              <span className="text-gray-400">
                {qty.toFixed(qty % 1 === 0 ? 0 : 2)} {record.unit} × RM {up.toFixed(2)}
              </span>
              <span className="font-semibold text-gray-900">{rm(total)}</span>
            </div>
          )}
        </div>
        <div
          className="border-t border-gray-100 px-4 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
        >
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose}
              className="py-3 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-600 active:opacity-80">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="py-3 rounded-2xl text-sm font-semibold text-white active:opacity-90"
              style={{ background: saving ? '#d1d5db' : '#f97316' }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Record row with swipe-to-reveal actions ──
function RecordRow({
  item, isFirst, isLast, showCosts, canDelete,
  onDetail, onEditRecord, onDeleteRecord, onEditField, onUncheck,
}: {
  item: LedgerRecord
  isFirst: boolean
  isLast: boolean
  showCosts: boolean
  canDelete: boolean
  onDetail:      (r: LedgerRecord) => void
  onEditRecord:  (r: LedgerRecord) => void
  onDeleteRecord:(r: LedgerRecord) => void
  onEditField:   (r: LedgerRecord, field: InlineEditField) => void
  onUncheck:     (r: LedgerRecord) => void
}) {
  // Action area width: edit+trash=96, edit-only=52, kitchen=0
  const ACTION_W = showCosts ? (canDelete ? 96 : 52) : 0

  const [swiped, _setSwiped] = useState(false)
  const swipedRef   = useRef(false)
  const isSwipeGest = useRef(false)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  function setSwiped(v: boolean) { swipedRef.current = v; _setSwiped(v) }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isSwipeGest.current = false
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY)
    if (Math.abs(dx) > 40 && dy < 35) {
      isSwipeGest.current = true
      setSwiped(dx > 0) // left = open, right = close
      // Reset flag after click events fire (~300ms tap delay on iOS)
      setTimeout(() => { isSwipeGest.current = false }, 350)
    }
  }

  function handleDetailTap() {
    if (isSwipeGest.current) return
    if (swipedRef.current) { setSwiped(false); return }
    onDetail(item)
  }

  function handleQtyTap(e: React.MouseEvent) {
    e.stopPropagation()
    if (isSwipeGest.current) return
    if (swipedRef.current) { setSwiped(false); return }
    onEditField(item, 'quantity')
  }

  function handlePriceTap(e: React.MouseEvent) {
    e.stopPropagation()
    if (isSwipeGest.current) return
    if (swipedRef.current) { setSwiped(false); return }
    onEditField(item, 'unit_price')
  }

  const translate = showCosts && swiped ? -ACTION_W : 0
  const categoryClr = categoryColor(item.category)
  const borderBottom = !isLast ? '1px solid #f3f4f6' : 'none'

  // Strip border-radius matches or exceeds any card's border-radius to prevent corner color bleed
  const stripRadius = { borderTopLeftRadius: isFirst ? 20 : 0, borderBottomLeftRadius: isLast ? 20 : 0 }

  // Kitchen: simple row with checked checkbox, no swipe, no prices
  if (!showCosts) {
    return (
      <div style={{ position: 'relative', borderBottom, background: '#fff' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: categoryClr, ...stripRadius }} />
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Checked checkbox — visual only for kitchen */}
          <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center"
            style={{ borderColor: '#22c55e', background: '#22c55e' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <button type="button" onClick={() => onDetail(item)} className="flex-1 text-left min-w-0">
            <div className="font-medium text-sm text-gray-900">{item.name}</div>
            <div className="text-xs text-gray-400 mt-0.5">{item.quantity} {item.unit}</div>
          </button>
        </div>
      </div>
    )
  }

  // Owner/Manager: single-line grid with swipe actions
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderBottom, background: '#fff' }}>
      {/* Category color strip — rounded corners eliminate card border-radius clipping artifact */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: categoryClr, zIndex: 2, pointerEvents: 'none', ...stripRadius }} />
      {/* Swipe action area — z-index 0 ensures it stays below the sliding content */}
      <div
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: ACTION_W,
          display: 'flex', alignItems: 'stretch', background: '#ef4444', zIndex: 0,
        }}
      >
        <button
          type="button"
          onClick={() => { setSwiped(false); onEditRecord(item) }}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={() => { setSwiped(false); onDeleteRecord(item) }}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #f87171' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        )}
      </div>

      {/* Sliding content — sits above action area via z-index: 1 */}
      <div
        style={{ transform: `translateX(${translate}px)`, transition: 'transform 0.22s ease', background: '#fff', position: 'relative', zIndex: 1, width: '100%' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '40px 1.1fr 0.7fr 1.2fr 1fr',
            alignItems: 'center',
            minHeight: 56,
            padding: '0 12px',
            gap: 4,
          }}
        >
          {/* Checkbox — always checked (green); same wrapper+size as ChecklistSection Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => { if (swipedRef.current) { setSwiped(false); return } onUncheck(item) }}
              style={{
                WebkitAppearance: 'none',
                appearance: 'none',
                flexShrink: 0,
                width: 24,
                height: 24,
                minWidth: 24,
                minHeight: 24,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                cursor: 'pointer',
                background: '#22c55e',
                border: 'none',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          </div>

          {/* Col 1: Item name — taps to detail */}
          <button
            type="button"
            onClick={handleDetailTap}
            className="text-left active:opacity-70"
            style={{ minWidth: 0 }}
          >
            <span className="font-semibold text-gray-900 block truncate" style={{ fontSize: 16 }}>
              {item.name}
            </span>
          </button>

          {/* Col 2: Quantity + unit — taps to edit qty */}
          <button
            type="button"
            onClick={handleQtyTap}
            className="text-left active:opacity-70 tabular-nums"
            style={{ minWidth: 0 }}
          >
            <span className="font-medium text-gray-600 block truncate" style={{ fontSize: 13 }}>
              {item.quantity % 1 === 0 ? item.quantity.toFixed(0) : item.quantity.toFixed(2)} {item.unit}
            </span>
          </button>

          {/* Col 3: Unit price — taps to edit price */}
          <button
            type="button"
            onClick={handlePriceTap}
            className="text-left active:opacity-70 tabular-nums"
            style={{ minWidth: 0 }}
          >
            <span className="font-medium text-gray-600 block truncate" style={{ fontSize: 13 }}>
              {(item.unit_price ?? 0) > 0
                ? `RM${item.unit_price! % 1 === 0 ? item.unit_price!.toFixed(0) : item.unit_price!.toFixed(2)}/${item.unit}`
                : <span className="text-gray-300">—</span>}
            </span>
          </button>

          {/* Col 4: Total — taps to detail */}
          <button
            type="button"
            onClick={handleDetailTap}
            className="text-right active:opacity-70 tabular-nums"
            style={{ minWidth: 0 }}
          >
            {(item.total_price ?? 0) > 0
              ? <span className="font-semibold text-gray-900" style={{ fontSize: 14 }}>{rm(item.total_price)}</span>
              : <span className="text-gray-300" style={{ fontSize: 14 }}>—</span>
            }
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Category breakdown donut ──
function DonutChart({ data }: { data: { category: string; total: number }[] }) {
  const total = data.reduce((s, d) => s + d.total, 0)
  if (total === 0) return <div className="text-center text-gray-400 text-sm py-6">No data</div>
  const r = 58, cx = 80, cy = 80, strokeW = 22, circ = 2 * Math.PI * r
  let cum = 0
  const segs = data.map((d) => {
    const len = (d.total / total) * circ
    const seg = { ...d, len, offset: -cum, color: categoryColor(d.category) }
    cum += len
    return seg
  })
  return (
    <div className="flex flex-col items-center">
      <svg width={160} height={160} viewBox="0 0 160 160">
        <g transform={`rotate(-90, ${cx}, ${cy})`}>
          {segs.map((s, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={strokeW}
              strokeDasharray={`${s.len} ${circ}`} strokeDashoffset={s.offset} />
          ))}
        </g>
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="11" fill="#9ca3af">Total</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="15" fontWeight="700" fill="#111">{`RM ${total.toFixed(0)}`}</text>
      </svg>
      <div className="w-full space-y-2 mt-2 px-2">
        {data.map((d) => (
          <div key={d.category} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: categoryColor(d.category) }} />
              <span className="text-gray-700">{d.category}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-xs">{Math.round((d.total / total) * 100)}%</span>
              <span className="font-semibold text-gray-900">{rm(d.total)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Inline dropdown ──
function Picker({ value, options, onChange, label }: { value: string; options: string[]; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-left flex items-center justify-between bg-white" style={{ fontSize: 16 }}>
        <span className="text-gray-800">{value}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-30 overflow-y-auto" style={{ maxHeight: 220 }}>
          {options.map((opt) => (
            <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 hover:bg-orange-50"
              style={{ fontSize: 16, color: opt === value ? '#f97316' : '#374151', fontWeight: opt === value ? 600 : 400 }}>{opt}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-orange-400'

// Props supplied by the server component (SSR). Absent when rendered via nav stack.
type Props = {
  role?: StaffRole
  today?: string
  initialRecords?: LedgerRecord[]
  initialSummary?: PurchaseSummary | null
  initialKpi?: PurchaseKpi
  initialChecklist?: ChecklistEntry[]
  perms?: Perms
}

const emptyForm = {
  name: '', specification: '', category: 'Vegetables', unit: 'kg',
  quantity: '', unit_price: '', supplier: '', receiver: '', remarks: '',
}

type Ctx = { role: StaffRole; today: string; perms: Perms }

export default function PurchaseClient(props: Props) {
  const hasInitial = !!(props.role && props.today && props.perms)
  const { push, pop } = useNavigation()
  const [ctx, setCtx] = useState<Ctx | null>(
    hasInitial ? { role: props.role!, today: props.today!, perms: props.perms! } : null,
  )
  const [records, setRecords]   = useState<LedgerRecord[]>(props.initialRecords ?? [])
  const [summary, setSummary]   = useState<PurchaseSummary | null>(props.initialSummary ?? null)
  const [kpi, setKpi]           = useState<PurchaseKpi | null>(props.initialKpi ?? null)
  const [booting, setBooting]   = useState(!hasInitial)
  const [refreshing, setRefreshing] = useState(false)
  const [checklistRefreshKey, setChecklistRefreshKey] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [bootError, setBootError]     = useState<string | null>(null)
  const [bootAttempt, setBootAttempt] = useState(0)

  useEffect(() => {
    if (ctx) return
    let active = true
    setBooting(true)
    setBootError(null)
    fetchPurchaseContextAction().then((res) => {
      if (!active) return
      if (res.ok) {
        setCtx({ role: res.data.role, today: res.data.today, perms: res.data.perms })
        setRecords(res.data.records as LedgerRecord[])
        setSummary(res.data.summary)
        setKpi(res.data.kpi)
      } else {
        setBootError(res.error)
      }
      setBooting(false)
    })
    return () => { active = false }
  }, [ctx, bootAttempt])

  const [showFilters, setShowFilters]     = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [filters, setFilters] = useState({ category: '', from: '', to: '', supplier: '', purchaser: '' })

  const [catalog, setCatalog]               = useState<CatalogItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError]     = useState<string | null>(null)
  useEffect(() => {
    fetchCatalogAction()
      .then((res) => {
        if (res.ok) setCatalog(res.data)
        else setCatalogError(res.error)
      })
      .catch((e) => setCatalogError(e?.message ?? 'Failed to load catalog'))
      .finally(() => setCatalogLoading(false))
  }, [])

  const [showAdd, setShowAdd]                 = useState(false)
  const [form, setForm]                       = useState(emptyForm)
  const [selectedAddItem, setSelectedAddItem] = useState<CatalogItem | null>(null)
  const [saving, setSaving]                   = useState(false)
  const [addError, setAddError]               = useState<string | null>(null)
  const [successToast, setSuccessToast]       = useState<string | null>(null)
  const [editingRecord, setEditingRecord]     = useState<LedgerRecord | null>(null)
  const [deletingRecord, setDeletingRecord]   = useState<LedgerRecord | null>(null)
  const [deleteInProgress, setDeleteInProgress] = useState(false)
  const [inlineEdit, setInlineEdit]           = useState<InlineEditTarget | null>(null)

  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [expandedDays,   setExpandedDays]   = useState<Set<string>>(new Set())

  const refresh = useCallback(async (f = filters) => {
    setRefreshing(true)
    const canViewCosts = ctx?.perms.canViewCosts ?? false
    const activeFilters = canViewCosts
      ? { category: f.category || undefined, from: f.from || undefined, to: f.to || undefined, supplier: f.supplier || undefined, purchaser: f.purchaser || undefined }
      : {}
    const [recRes, sumRes, kpiRes] = await Promise.all([
      fetchRecordsAction(activeFilters),
      fetchSummaryAction(),
      fetchKpiAction(),
    ])
    if (recRes.ok) setRecords(recRes.data as LedgerRecord[])
    if (sumRes.ok) setSummary(sumRes.data)
    if (kpiRes.ok) setKpi(kpiRes.data)
    setRefreshing(false)
  }, [filters, ctx])

  const startY = useRef(0), pulling = useRef(false)
  const [pullDist, setPullDist] = useState(0)
  const THRESHOLD = 60
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onStart = (e: TouchEvent) => { if (el.scrollTop <= 0) { startY.current = e.touches[0].clientY; pulling.current = true } }
    const onMove  = (e: TouchEvent) => {
      if (!pulling.current || refreshing) return
      const dist = e.touches[0].clientY - startY.current
      if (dist > 0) { e.preventDefault(); setPullDist(Math.min(dist * 0.45, THRESHOLD + 20)) }
    }
    const onEnd = async () => {
      if (!pulling.current) return
      pulling.current = false
      if (pullDist >= THRESHOLD && !refreshing) { setPullDist(THRESHOLD); await refresh() }
      setPullDist(0)
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove',  onMove,  { passive: false })
    el.addEventListener('touchend',   onEnd,   { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove',  onMove)
      el.removeEventListener('touchend',   onEnd)
    }
  }, [pullDist, refreshing, refresh])

  const showCosts = ctx?.perms.canViewCosts ?? false

  function openAdd() { setForm(emptyForm); setSelectedAddItem(null); setAddError(null); setShowAdd(true) }

  async function handleAdd() {
    if (!form.name.trim()) { setAddError('Item name is required.'); return }
    if (!form.quantity || parseFloat(form.quantity) <= 0) { setAddError('Quantity must be greater than zero.'); return }
    setSaving(true)
    setAddError(null)
    const res = await createRecordAction({
      name:          form.name.trim(),
      specification: form.specification.trim() || null,
      category:      form.category,
      unit:          form.unit,
      quantity:      parseFloat(form.quantity),
      unit_price:    showCosts && form.unit_price ? parseFloat(form.unit_price) : null,
      supplier:      showCosts ? form.supplier.trim() || null : null,
      receiver:      form.receiver.trim() || null,
      remarks:       form.remarks.trim() || null,
    })
    setSaving(false)
    if (!res.ok) { setAddError(res.error); return }
    setForm(emptyForm)
    setSelectedAddItem(null)
    setShowAdd(false)
    setSuccessToast('Purchase added')
    setTimeout(() => setSuccessToast(null), 2500)
    refresh()
  }

  async function handleDelete() {
    if (!deletingRecord) return
    setDeleteInProgress(true)
    const res = await deleteRecordAction(deletingRecord.id)
    setDeleteInProgress(false)
    setDeletingRecord(null)
    if (res.ok) {
      setSuccessToast('Deleted')
      setTimeout(() => setSuccessToast(null), 2500)
      refresh()
    }
  }

  function openDetail(rec: LedgerRecord) {
    push(
      `/purchase/${rec.id}`,
      <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#f9fafb' }} />}>
        <DetailClient itemId={rec.id} onChanged={() => { pop(); refresh() }} />
      </Suspense>,
    )
  }

  function openKpiDetails() {
    if (!kpi || !ctx) return
    push(
      '/purchase/cost-ratio',
      <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#f9fafb' }} />}>
        <CostRatioDetailsClient kpi={kpi} today={ctx.today} />
      </Suspense>,
    )
  }

  function toggleMonth(key: string) {
    setExpandedMonths(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  function toggleDay(key: string) {
    setExpandedDays(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  function showToast(msg: string) {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(null), 2500)
  }

  if (booting || !ctx) {
    return (
      <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>
        <div className="bg-white px-4 py-3 flex items-center gap-3 border-b" style={{ flexShrink: 0 }}>
          <BackButton href="/" />
          <span className="font-semibold text-base">Purchase</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          {booting ? (
            <span className="text-gray-400 text-sm">Loading...</span>
          ) : (
            <>
              <span className="text-gray-500 text-sm">Couldn&apos;t load purchases.</span>
              {bootError && <span className="text-gray-400 text-xs">{bootError}</span>}
              <button onClick={() => setBootAttempt((n) => n + 1)}
                className="px-5 py-2 rounded-full text-sm font-semibold text-white bg-orange-500">Retry</button>
            </>
          )}
        </div>
      </div>
    )
  }

  const { today, perms } = ctx
  const todayRecords  = records.filter(r => r.date === today)
  const historyGroups = groupHistory(records, today)
  const todayTotal    = todayRecords.reduce((s, r) => s + (r.total_price ?? 0), 0)

  const exportHref = `/api/purchase/export?${new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
  ).toString()}`

  // Hero card: prefer month → week → today
  let heroLabel   = 'Today'
  let heroPeriod: RatioPeriod | null = kpi?.today ?? null
  if (kpi) {
    if (kpi.month) {
      const d = new Date(today + 'T00:00:00')
      heroLabel  = `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`
      heroPeriod = kpi.month
    } else if (kpi.week) {
      heroLabel  = 'This Week'
      heroPeriod = kpi.week
    }
  }
  const heroSt = heroStatus(heroPeriod?.ratio ?? null)
  const heroC  = HERO_COLOR[heroSt]

  // Fire-and-forget background KPI+summary refresh — never blocks the UI
  function refreshKpiAsync() {
    fetchKpiAction().then(r => { if (r.ok) setKpi(r.data) })
    fetchSummaryAction().then(r => { if (r.ok) setSummary(r.data) })
  }

  // Called by ChecklistSection when a pending item is marked as purchased.
  // The server action already created the purchase record and returned it —
  // prepend it directly to avoid a blocking re-fetch of the records list.
  function handleItemCompleted(record: PurchaseRecord) {
    setRecords(prev => [record as LedgerRecord, ...prev])
    refreshKpiAsync()
  }

  async function handleUncheck(rec: LedgerRecord) {
    // Optimistic: remove from records immediately so the row disappears at once
    setRecords(prev => prev.filter(r => r.id !== rec.id))

    const res = await moveRecordToChecklistAction(rec.id)
    if (res.ok) {
      showToast(`${rec.name} moved back to Checklist`)
      // Refresh checklist to show the restored pending item
      setChecklistRefreshKey(k => k + 1)
      // KPI+summary update in background — non-blocking
      refreshKpiAsync()
    } else {
      // Rollback: put the record back
      setRecords(prev => [rec, ...prev])
      showToast('Could not move back — please try again')
    }
  }

  // Shared row props
  const rowProps = {
    showCosts,
    canDelete: perms.canDelete,
    onDetail: openDetail,
    onEditRecord: setEditingRecord,
    onDeleteRecord: setDeletingRecord,
    onEditField: (r: LedgerRecord, field: InlineEditField) => setInlineEdit({ record: r, field }),
    onUncheck: handleUncheck,
  }

  return (
    <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <BackButton href="/" />
          <span className="font-semibold text-base">Purchase</span>
        </div>
        {showCosts && (
          <button onClick={() => setShowFilters((s) => !s)} aria-label="Filters"
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: showFilters ? '#fff7ed' : '#f3f4f6' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={showFilters ? '#f97316' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </button>
        )}
      </div>

      {/* Scroll area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        {/* Pull-to-refresh */}
        <div style={{ height: refreshing ? THRESHOLD : pullDist, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: refreshing || pullDist === 0 ? 'height 0.3s ease' : 'none', overflow: 'hidden' }}>
          {(pullDist > 5 || refreshing) && (
            <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2.5px solid #f97316', borderTopColor: 'transparent', animation: refreshing ? 'ptr-spin 0.7s linear infinite' : 'none', transform: !refreshing ? `rotate(${(pullDist / THRESHOLD) * 300}deg)` : undefined }} />
          )}
        </div>
        <style>{`@keyframes ptr-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

        {/* 1. Monthly hero KPI — whole card colored, taps to details */}
        {kpi && (
          <div className="px-4 pt-3">
            <button
              type="button"
              onClick={openKpiDetails}
              className="w-full rounded-2xl p-4 shadow-sm text-left active:opacity-90"
              style={{ background: heroC.bg }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold" style={{ color: heroC.text }}>Purchase Cost Ratio</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px]" style={{ color: heroC.text, opacity: 0.7 }}>Target ≤ {kpi.target}%</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={heroC.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
              <div className="text-xs mb-1.5" style={{ color: heroC.text, opacity: 0.75 }}>{heroLabel}</div>
              <div className="font-bold leading-none mb-2" style={{ fontSize: 44, color: heroC.text }}>
                {ratioText(heroPeriod?.ratio ?? null)}
              </div>
              <div className="text-sm font-semibold" style={{ color: heroC.text }}>{heroStatusLabel(heroSt)}</div>
              {kpi.showAmounts && heroPeriod && heroPeriod.purchase !== null && (
                <div className="text-xs mt-0.5" style={{ color: heroC.text, opacity: 0.75 }}>
                  {rm(heroPeriod.purchase)} / {rm(heroPeriod.revenue)}
                </div>
              )}
            </button>
          </div>
        )}

        {/* Filters (owner/manager) */}
        {showCosts && showFilters && (
          <div className="px-4 pt-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setFilters((f) => ({ ...f, category: '' }))}
                  className="px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ background: !filters.category ? '#f97316' : '#f3f4f6', color: !filters.category ? '#fff' : '#6b7280' }}>All</button>
                {PURCHASE_CATEGORIES.map((c) => (
                  <button key={c} onClick={() => setFilters((f) => ({ ...f, category: f.category === c ? '' : c }))}
                    className="px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{ background: filters.category === c ? categoryColor(c) : '#f3f4f6', color: filters.category === c ? '#fff' : '#6b7280' }}>{c}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From"><input type="date" className={inputCls} style={{ fontSize: 14 }} value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} /></Field>
                <Field label="To"><input type="date" className={inputCls} style={{ fontSize: 14 }} value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Supplier"><input className={inputCls} style={{ fontSize: 14 }} placeholder="Any" value={filters.supplier} onChange={(e) => setFilters((f) => ({ ...f, supplier: e.target.value }))} /></Field>
                <Field label="Purchaser"><input className={inputCls} style={{ fontSize: 14 }} placeholder="Any" value={filters.purchaser} onChange={(e) => setFilters((f) => ({ ...f, purchaser: e.target.value }))} /></Field>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { const c = { category: '', from: '', to: '', supplier: '', purchaser: '' }; setFilters(c); refresh(c) }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600">Clear</button>
                <button onClick={() => refresh()} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-orange-500">Apply</button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Today's Purchase Checklist */}
        <ChecklistSection
          showCosts={showCosts}
          catalog={catalog}
          catalogLoading={catalogLoading}
          onRecordCreated={refresh}
          onItemCompleted={handleItemCompleted}
          initialItems={props.initialChecklist}
          refreshKey={checklistRefreshKey}
        />

        {/* 3. Purchase Records — today only */}
        <div className="px-4 pt-4">
          <div className="px-1 mb-2">
            <span className="text-xs font-semibold text-gray-500">Purchase Records</span>
          </div>

          {todayRecords.length === 0 ? (
            <div className="text-center text-gray-400 py-10">
              <div className="text-3xl mb-2">🛒</div>
              <div className="text-sm">No records today — tap + to add.</div>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {todayRecords.map((item, idx) => (
                  <RecordRow key={item.id} item={item} isFirst={idx === 0} isLast={idx === todayRecords.length - 1} {...rowProps} />
                ))}
              </div>
              {showCosts && todayTotal > 0 && (
                <div className="flex justify-end px-1 mt-1.5">
                  <span className="text-xs font-semibold text-gray-400">{rm(todayTotal)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* 3. Purchase History — month → day → records tree */}
        {historyGroups.length > 0 && (
          <div className="px-4 pt-4">
            <div className="text-xs font-semibold text-gray-500 px-1 mb-2">Purchase History</div>
            <div className="space-y-2">
              {historyGroups.map((month) => (
                <div key={month.monthKey}>
                  <button
                    type="button"
                    onClick={() => toggleMonth(month.monthKey)}
                    className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm active:opacity-80"
                  >
                    <div className="flex items-center gap-2">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transform: expandedMonths.has(month.monthKey) ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      <span className="text-sm font-semibold text-gray-700">{month.monthLabel}</span>
                    </div>
                    {showCosts && month.total > 0 && (
                      <span className="text-xs font-semibold text-gray-400">{rm(month.total)}</span>
                    )}
                  </button>

                  {expandedMonths.has(month.monthKey) && (
                    <div className="mt-1.5 pl-4 space-y-1.5">
                      {month.days.map((day) => (
                        <div key={day.date}>
                          <button
                            type="button"
                            onClick={() => toggleDay(day.date)}
                            className="w-full flex items-center justify-between bg-white rounded-xl px-4 py-2.5 shadow-sm active:opacity-80"
                          >
                            <div className="flex items-center gap-2">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                                stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                style={{ transform: expandedDays.has(day.date) ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                              <span className="text-sm text-gray-600">{day.label}</span>
                              <span className="text-xs text-gray-400">({day.items.length})</span>
                            </div>
                            {showCosts && day.total > 0 && (
                              <span className="text-xs font-semibold text-gray-400">{rm(day.total)}</span>
                            )}
                          </button>

                          {expandedDays.has(day.date) && (
                            <div className="mt-1 bg-white rounded-xl shadow-sm overflow-hidden">
                              {day.items.map((item, idx) => (
                                <RecordRow key={item.id} item={item} isFirst={idx === 0} isLast={idx === day.items.length - 1} {...rowProps} />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Category breakdown (owner/manager) */}
        {showCosts && summary && summary.categoryBreakdown.length > 0 && (
          <div className="px-4 pt-3">
            <button onClick={() => setShowBreakdown((s) => !s)}
              className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm">
              <span className="text-sm font-semibold text-gray-700">Category Breakdown</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: showBreakdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showBreakdown && (
              <div className="bg-white rounded-2xl p-4 shadow-sm mt-2">
                <DonutChart data={summary.categoryBreakdown} />
              </div>
            )}
          </div>
        )}

        {/* 5. Export (owner only) */}
        {perms.canExport && (
          <div className="px-4 pt-3">
            <a href={exportHref}
              className="flex items-center justify-center gap-2 bg-white rounded-2xl py-3 shadow-sm text-sm font-semibold text-gray-700 active:opacity-60">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </a>
          </div>
        )}
      </div>

      {/* Success toast */}
      {successToast && (
        <div
          className="fixed left-1/2 z-[600] -translate-x-1/2 px-5 py-2.5 rounded-full text-sm font-medium text-white shadow-lg pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)', background: '#111827' }}
        >
          {successToast}
        </div>
      )}

      {/* Add sheet */}
      {showAdd && (
        <div
          className="fixed inset-0 z-[400] flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.4)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)' }}
          onClick={() => setShowAdd(false)}
        >
          <div
            className="bg-white rounded-t-3xl flex flex-col"
            style={{ maxHeight: 'calc(92vh - env(safe-area-inset-bottom, 0px) - 56px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-5 pb-3 flex items-center justify-between flex-shrink-0 border-b border-gray-100">
              <span className="font-semibold text-base">Add Purchase</span>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <div className="px-4 pt-4 pb-4 overflow-y-auto flex-1 min-h-0 space-y-3">
              {addError && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{addError}</div>}
              <div className="grid gap-3" style={{ gridTemplateColumns: 'minmax(0, 65fr) minmax(0, 35fr)' }}>
                <Field label="Item Name *">
                  <CatalogCombobox
                    items={catalog}
                    selectedItem={selectedAddItem}
                    loading={catalogLoading}
                    error={catalogError}
                    onSelect={(item) => {
                      setSelectedAddItem(item)
                      setForm((f) => ({ ...f, name: item.name_zh, category: item.category, unit: item.unit }))
                    }}
                  />
                </Field>
                <Field label="Specification">
                  <input className={inputCls} style={{ fontSize: 16 }} placeholder="Optional" value={form.specification}
                    onChange={(e) => setForm((f) => ({ ...f, specification: e.target.value }))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Picker label="Category" value={form.category} options={[...PURCHASE_CATEGORIES]} onChange={(v) => setForm((f) => ({ ...f, category: v }))} />
                <Picker label="Unit"     value={form.unit}     options={UNITS}                    onChange={(v) => setForm((f) => ({ ...f, unit: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantity *">
                  <input className={inputCls} style={{ fontSize: 16 }} type="number" inputMode="decimal" placeholder="0"
                    value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
                </Field>
                {showCosts ? (
                  <Field label="Unit Price (RM)">
                    <input className={inputCls} style={{ fontSize: 16 }} type="number" inputMode="decimal" placeholder="0.00"
                      value={form.unit_price} onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))} />
                  </Field>
                ) : <div />}
              </div>
              {showCosts && (
                <Field label="Supplier">
                  <input className={inputCls} style={{ fontSize: 16 }} placeholder="e.g. KK Meat Supply"
                    value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} />
                </Field>
              )}
              {showCosts && form.quantity && form.unit_price && (
                <div className="text-xs text-gray-500 text-right">
                  Est. Total: {rm(parseFloat(form.quantity) * parseFloat(form.unit_price) || 0)}
                </div>
              )}
              <Field label="Receiver">
                <input className={inputCls} style={{ fontSize: 16 }} placeholder="Optional"
                  value={form.receiver} onChange={(e) => setForm((f) => ({ ...f, receiver: e.target.value }))} />
              </Field>
              <Field label="Remarks">
                <input className={inputCls} style={{ fontSize: 16 }} placeholder="Optional"
                  value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
              </Field>
            </div>
            <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 pt-3"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="py-3 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-600 active:opacity-80">Cancel</button>
                <button type="button" onClick={handleAdd} disabled={saving || !form.name.trim()}
                  className="py-3 rounded-2xl text-sm font-semibold text-white active:opacity-90"
                  style={{ background: form.name.trim() ? '#f97316' : '#d1d5db' }}>
                  {saving ? 'Saving...' : 'Add Purchase'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deletingRecord && (
        <div
          className="fixed inset-0 z-[500] flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)' }}
          onClick={() => { if (!deleteInProgress) setDeletingRecord(null) }}
        >
          <div className="bg-white rounded-3xl mx-4 w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-4 text-center">
              <div className="text-base font-semibold text-gray-900 mb-1">Delete this purchase record?</div>
              <div className="text-sm text-gray-500 truncate">{deletingRecord.name}</div>
            </div>
            <div className="grid grid-cols-2 border-t border-gray-100">
              <button type="button" onClick={() => setDeletingRecord(null)} disabled={deleteInProgress}
                className="py-3.5 text-sm font-medium text-gray-600 border-r border-gray-100 active:bg-gray-50">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={deleteInProgress}
                className="py-3.5 text-sm font-semibold text-red-500 active:bg-red-50">
                {deleteInProgress ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline field edit sheet */}
      {inlineEdit && (
        <InlineFieldEditSheet
          target={inlineEdit}
          onClose={() => setInlineEdit(null)}
          onSaved={() => { showToast('Saved'); refresh() }}
        />
      )}

      {/* Full quick edit sheet (from swipe action) */}
      {editingRecord && (
        <QuickEditSheet
          record={editingRecord}
          showCosts={showCosts}
          onClose={() => setEditingRecord(null)}
          onSaved={() => { showToast('Saved'); refresh() }}
        />
      )}
    </div>
  )
}
