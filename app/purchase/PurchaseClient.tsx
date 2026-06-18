'use client'

import { useState, useCallback, useRef, useEffect, lazy } from 'react'
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
import { fetchChecklistAction, moveRecordToChecklistAction } from './checklist-actions'
import type { ChecklistEntry } from './checklist-actions'
import type { RestoreChecklistAction } from './ChecklistSection'
import CatalogCombobox from './CatalogCombobox'
import QuickEditSheet from './QuickEditSheet'
import NumericEditorSheet from './NumericEditorSheet'
import ChecklistSection from './ChecklistSection'
import type { CatalogItem } from '@/lib/purchaseLedger/catalog'
import {
  applyRecordToKpi,
  applyRecordToSummary,
  createOptimisticPurchaseRecord,
  createOptimisticFromForm,
  prependOptimisticRecord,
  reconcileOptimisticRecord,
  removeOptimisticRecord,
  updateRecordInList,
  nextClientMutationId,
  setMutationId,
  getMutationId,
} from './optimistic'
import { usePurchaseSync } from './usePurchaseSync'

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
  checklist_item_id?: number | null
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

// Remove checklist items that are already represented in the records list.
// Two conditions cover both sides of the two-write race in completeChecklistItemAction:
//   1. purchase_record_id matches a record ID (steady state — both writes committed)
//   2. record.checklist_item_id matches the item ID (race window — record written, checklist not yet)
function reconcileChecklist(items: ChecklistEntry[], records: LedgerRecord[]): ChecklistEntry[] {
  const recordIds = new Set(records.map(r => r.id))
  const completedChecklistIds = new Set(
    records.map(r => r.checklist_item_id).filter((id): id is number => id != null),
  )
  return items.filter(item =>
    !(item.purchase_record_id != null && recordIds.has(item.purchase_record_id)) &&
    !completedChecklistIds.has(item.id),
  )
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

// ── Inline edit: now handled by shared NumericEditorSheet ──


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

  const stripRadius = { borderTopLeftRadius: isFirst ? 20 : 0, borderBottomLeftRadius: isLast ? 20 : 0 }

  // Kitchen: simple row with checked checkbox, no swipe, no prices
  if (!showCosts) {
    return (
      <div style={{ position: 'relative', borderBottom, background: '#fff' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: categoryClr, ...stripRadius }} />
        <div className="flex items-center gap-3 px-4 py-3">
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
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: categoryClr, zIndex: 2, pointerEvents: 'none', ...stripRadius }} />
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
function Picker({ value, options, onChange, label }: { value: string; options: readonly string[]; onChange: (v: string) => void; label: string }) {
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

// ── Module-level cache — survives component unmount between navigations ───────
type PurchaseCache = {
  ctx: Ctx
  records: LedgerRecord[]
  summary: PurchaseSummary | null
  kpi: PurchaseKpi | null
  checklist: ChecklistEntry[] | undefined
  cachedAt: number
}
let purchaseCache: PurchaseCache | null = null
const CACHE_TTL_MS = 4 * 60 * 1000

export default function PurchaseClient(props: Props) {
  const hasInitial = !!(props.role && props.today && props.perms)
  const { push, pop } = useNavigation()

  // Snapshot cache at mount time so useState initializers are stable
  const initCache = hasInitial ? null : purchaseCache

  const [ctx, setCtx] = useState<Ctx | null>(
    hasInitial ? { role: props.role!, today: props.today!, perms: props.perms! }
    : initCache?.ctx ?? null,
  )
  const [records, setRecords]   = useState<LedgerRecord[]>(props.initialRecords ?? initCache?.records ?? [])
  const [summary, setSummary]   = useState<PurchaseSummary | null>(props.initialSummary ?? initCache?.summary ?? null)
  const [kpi, setKpi]           = useState<PurchaseKpi | null>(props.initialKpi ?? initCache?.kpi ?? null)

  // initialLoading: blank-screen state only when there is truly no data to show yet
  const [initialLoading, setInitialLoading] = useState(!hasInitial && !initCache)
  const [refreshing, setRefreshing] = useState(false)
  // Seed checklist from SSR props → cache → fetched on first load (set via setChecklistSeed)
  const [checklistSeed, setChecklistSeed] = useState<ChecklistEntry[] | undefined>(
    props.initialChecklist ?? initCache?.checklist
  )
  const [checklistRefreshKey, setChecklistRefreshKey] = useState(0)
  const nextTempRecordId = useRef(-1)
  const optimisticRecords = useRef<Map<number, LedgerRecord>>(new Map())
  const scrollRef = useRef<HTMLDivElement>(null)
  const restoreChecklistRef = useRef<((action: RestoreChecklistAction) => void) | null>(null)
  const triggerAddChecklistRef = useRef<(() => void) | null>(null)
  const updateChecklistRef = useRef<((items: ChecklistEntry[]) => void) | null>(null)
  const breakdownRef = useRef<HTMLDivElement>(null)
  const pendingUnchecks = useRef<Set<number>>(new Set())
  const pendingRecordDeletes = useRef<Set<number>>(new Set())

  const [bootError, setBootError]     = useState<string | null>(null)
  const [bootAttempt, setBootAttempt] = useState(0)

  useEffect(() => {
    if (hasInitial) return
    let active = true

    // On explicit retry (bootAttempt > 0), ignore any stale cache and force a fresh load
    const cache = bootAttempt === 0 ? initCache : null

    if (!cache) {
      // No cached data — show skeleton and fetch context + checklist in parallel
      setInitialLoading(true)
      setBootError(null)
      Promise.all([fetchPurchaseContextAction(), fetchChecklistAction()]).then(([ctxRes, checkRes]) => {
        if (!active) return
        if (!ctxRes.ok) { setBootError(ctxRes.error); setInitialLoading(false); return }
        const newCtx = { role: ctxRes.data.role, today: ctxRes.data.today, perms: ctxRes.data.perms }
        setCtx(newCtx)
        setRecords(ctxRes.data.records as LedgerRecord[])
        setSummary(ctxRes.data.summary)
        setKpi(ctxRes.data.kpi)
        const checklist = checkRes.ok ? checkRes.data : undefined
        setChecklistSeed(checklist)
        purchaseCache = { ctx: newCtx, records: ctxRes.data.records as LedgerRecord[], summary: ctxRes.data.summary, kpi: ctxRes.data.kpi, checklist, cachedAt: Date.now() }
        setInitialLoading(false)
      })
    } else {
      // Have cached data — show it immediately, refresh in background if stale
      const isFresh = Date.now() - cache.cachedAt < CACHE_TTL_MS
      if (!isFresh) {
        setRefreshing(true)
        fetchPurchaseContextAction().then((ctxRes) => {
          if (!active) return
          if (ctxRes.ok) {
            const newCtx = { role: ctxRes.data.role, today: ctxRes.data.today, perms: ctxRes.data.perms }
            setCtx(newCtx)
            setRecords(ctxRes.data.records as LedgerRecord[])
            setSummary(ctxRes.data.summary)
            setKpi(ctxRes.data.kpi)
            purchaseCache = { ...purchaseCache!, ctx: newCtx, records: ctxRes.data.records as LedgerRecord[], summary: ctxRes.data.summary, kpi: ctxRes.data.kpi, cachedAt: Date.now() }
            setChecklistRefreshKey(k => k + 1)
          }
          setRefreshing(false)
        })
      }
      // Fresh cache: nothing to do — cached state already applied at useState init
    }

    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootAttempt])

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
  const [editingRecord, setEditingRecord]     = useState<LedgerRecord | null>(null)
  const [deletingRecord, setDeletingRecord]   = useState<LedgerRecord | null>(null)
  const [deleteInProgress, setDeleteInProgress] = useState(false)
  const [inlineEdit, setInlineEdit]           = useState<InlineEditTarget | null>(null)

  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [expandedDays,   setExpandedDays]   = useState<Set<string>>(new Set())

  // ── Refresh function (used by pull-to-refresh, filters, and sync) ──
  // silent=true: background poll — no visible "Refreshing…" indicator
  const refresh = useCallback(async (f = filters, silent = false) => {
    if (!silent) setRefreshing(true)
    const canViewCosts = ctx?.perms.canViewCosts ?? false
    const activeFilters = canViewCosts
      ? { category: f.category || undefined, from: f.from || undefined, to: f.to || undefined, supplier: f.supplier || undefined, purchaser: f.purchaser || undefined }
      : {}
      // Fetch records, summary, KPI, and checklist in a single parallel batch.
    // This makes the cross-device sync atomic: both sections update together
    // in one React render, eliminating the dual-display window that would occur
    // if checklist was fetched sequentially after records.
    const [recRes, sumRes, kpiRes, checkRes] = await Promise.all([
      fetchRecordsAction(activeFilters),
      fetchSummaryAction(),
      fetchKpiAction(),
      fetchChecklistAction(),
    ])
    if (recRes.ok) {
      // Filter out records with in-flight optimistic mutations so background
      // polling never re-adds a row that was just removed from the UI.
      const blocked = new Set([...pendingUnchecks.current, ...pendingRecordDeletes.current])
      setRecords(blocked.size > 0
        ? (recRes.data as LedgerRecord[]).filter(r => !blocked.has(r.id))
        : recRes.data as LedgerRecord[]
      )
    }
    if (sumRes.ok) setSummary(sumRes.data)
    if (kpiRes.ok) setKpi(kpiRes.data)
    if (recRes.ok && sumRes.ok && kpiRes.ok && purchaseCache) {
      purchaseCache = { ...purchaseCache, records: recRes.data as LedgerRecord[], summary: sumRes.data, kpi: kpiRes.data, cachedAt: Date.now() }
    }
    // Reconcile checklist against records before pushing to ChecklistSection.
    // This eliminates dual-display in both the steady state (purchase_record_id match)
    // and the race window between the two DB writes (checklist_item_id match).
    if (checkRes.ok) {
      const freshRecords = recRes.ok ? (recRes.data as LedgerRecord[]) : records
      updateChecklistRef.current?.(reconcileChecklist(checkRes.data, freshRecords))
    }
    if (!silent) setRefreshing(false)
  }, [filters, ctx])

  // Silent background refresh — used by polling/visibility/reconnect so no "Refreshing…" shows
  const backgroundRefresh = useCallback(() => refresh(filters, true), [refresh, filters])

  // ── Cross-device sync: polling, visibility, reconnect ──
  usePurchaseSync(backgroundRefresh)

  // ── Pull-to-refresh touch handlers ──
  const startY = useRef(0)
  const pulling = useRef(false)
  const [pullDist, setPullDist] = useState(0)
  const THRESHOLD = 60

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onTouchStart(e: TouchEvent) {
      if (el!.scrollTop > 0) return
      startY.current = e.touches[0].clientY
      pulling.current = true
    }
    function onTouchMove(e: TouchEvent) {
      if (!pulling.current) return
      const dy = e.touches[0].clientY - startY.current
      if (dy > 0) setPullDist(Math.min(dy * 0.5, THRESHOLD * 1.2))
      else setPullDist(0)
    }
    function onTouchEnd() {
      if (pullDist >= THRESHOLD) {
        refresh()
      }
      pulling.current = false
      setPullDist(0)
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [pullDist, refresh])

  const showCosts = ctx?.perms.canViewCosts ?? false

  // ── Open add sheet ──
  function openAdd() {
    setForm(emptyForm)
    setSelectedAddItem(null)
    setAddError(null)
    setSaving(false)
    setShowAdd(true)
  }

  // ── handleAdd: optimistic create ──
  async function handleAdd() {
    if (!form.name.trim()) { setAddError('Item name is required.'); return }
    const tempId = nextTempRecordId.current--
    const mutationId = nextClientMutationId()
    const optimistic = createOptimisticFromForm(
      {
        name: form.name.trim(),
        specification: form.specification.trim() || null,
        category: form.category,
        unit: form.unit,
        quantity: parseFloat(form.quantity) || 0,
        unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
        supplier: form.supplier.trim() || null,
        receiver: form.receiver.trim() || null,
        remarks: form.remarks.trim() || null,
      },
      tempId,
      ctx!.today,
      showCosts,
    )
    setMutationId(optimistic, mutationId)

    // Apply optimistic record + update summary/KPI
    setRecords((prev) => prependOptimisticRecord(prev, optimistic, mutationId))
    setSummary((prev) => prev ? applyRecordToSummary(prev, optimistic, 1, ctx!.today) : prev)
    setKpi((prev) => prev ? applyRecordToKpi(prev, optimistic, 1, ctx!.today) : prev)

    setShowAdd(false)
    setSaving(true)

    const res = await createRecordAction({
      name:          form.name.trim(),
      specification: form.specification.trim() || null,
      category:      form.category,
      unit:          form.unit,
      quantity:      parseFloat(form.quantity) || 0,
      unit_price:    form.unit_price ? parseFloat(form.unit_price) : null,
      supplier:      form.supplier.trim() || null,
      purchaser:     ctx!.role,
      receiver:      form.receiver.trim() || null,
      remarks:       form.remarks.trim() || null,
    })

    setSaving(false)

    if (res.ok) {
      // Reconcile temp record with server record; refresh KPI/summary for accuracy.
      setRecords((prev) => reconcileOptimisticRecord(prev, tempId, res.data as LedgerRecord))
      refreshKpiAndSummaryAsync()
    } else {
      // Rollback: remove optimistic record, revert summary/KPI
      setRecords((prev) => removeOptimisticRecord(prev, tempId))
      setSummary((prev) => prev ? applyRecordToSummary(prev, optimistic, -1, ctx!.today) : prev)
      setKpi((prev) => prev ? applyRecordToKpi(prev, optimistic, -1, ctx!.today) : prev)
      setAddError(res.error)
      setShowAdd(true)
    }
  }

  // ── handleDelete: optimistic delete ──
  async function handleDelete() {
    const target = deletingRecord!
    setDeleteInProgress(true)
    pendingRecordDeletes.current.add(target.id)

    // Optimistic: remove from list, revert summary/KPI
    setRecords((prev) => prev.filter((r) => r.id !== target.id))
    setSummary((prev) => prev ? applyRecordToSummary(prev, target, -1, ctx!.today) : prev)
    setKpi((prev) => prev ? applyRecordToKpi(prev, target, -1, ctx!.today) : prev)
    setDeletingRecord(null)

    const res = await deleteRecordAction(target.id)
    pendingRecordDeletes.current.delete(target.id)
    setDeleteInProgress(false)

    if (!res.ok) {
      // Rollback: restore record, revert summary/KPI
      setRecords((prev) => {
        const idx = prev.findIndex((r) => r.id === target.id)
        if (idx >= 0) {
          setSummary((s) => s ? applyRecordToSummary(s, target, 1, ctx!.today) : s)
          setKpi((k) => k ? applyRecordToKpi(k, target, 1, ctx!.today) : k)
          return prev
        }
        const restored = [...prev, target].sort((a, b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date)
          return b.id - a.id
        })
        setSummary((s) => s ? applyRecordToSummary(s, target, 1, ctx!.today) : s)
        setKpi((k) => k ? applyRecordToKpi(k, target, 1, ctx!.today) : k)
        return restored
      })
    } else {
      // Confirm KPI/summary with server values; no full refresh needed.
      refreshKpiAndSummaryAsync()
    }
  }

  // ── Navigation ──
  function openDetail(r: LedgerRecord) {
    push('/purchase/' + r.id, <DetailClient />)
  }

  function openKpiDetails() {
    push('/purchase/kpi-details', <CostRatioDetailsClient kpi={kpi!} today={ctx!.today} />)
  }

  function toggleMonth(mk: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(mk)) next.delete(mk); else next.add(mk)
      return next
    })
  }

  function toggleDay(d: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d); else next.add(d)
      return next
    })
  }

  // ── Fire-and-forget background refresh for KPI + Summary ──
  // Used after mutations so the hero card stays accurate without a full page refresh.
  const refreshKpiAsync = useCallback(async () => {
    const kpiRes = await fetchKpiAction()
    if (kpiRes.ok) setKpi(kpiRes.data)
  }, [])

  const refreshKpiAndSummaryAsync = useCallback(async () => {
    const [kpiRes, sumRes] = await Promise.all([fetchKpiAction(), fetchSummaryAction()])
    if (kpiRes.ok) setKpi(kpiRes.data)
    if (sumRes.ok) setSummary(sumRes.data)
  }, [])

  // ── handleInlineEditSave: optimistic in-place update of quantity + unit price ──
  // Applies the new values immediately (so the row, category breakdown, and totals
  // update without waiting), then persists. Rolls back on API failure.
  async function handleInlineEditSave(
    record: LedgerRecord,
    newQty: number,
    newUnitPrice: number,
  ): Promise<{ ok: boolean; error?: string }> {
    const original = record
    const optimistic: LedgerRecord = {
      ...record,
      quantity: newQty,
      unit_price: newUnitPrice,
      total_price: newQty * newUnitPrice,
    }
    setRecords((prev) => updateRecordInList(prev, record.id, optimistic))
    const res = await updateRecordAction(record.id, {
      name:          record.name,
      specification: record.specification ?? null,
      category:      record.category,
      unit:          record.unit,
      quantity:      newQty,
      unit_price:    newUnitPrice,
      supplier:      record.supplier ?? null,
      purchaser:     record.purchaser ?? null,
      receiver:      record.receiver ?? null,
      remarks:       record.note ?? null,
    })
    if (!res.ok) {
      setRecords((prev) => updateRecordInList(prev, record.id, original))
      return { ok: false, error: res.error }
    }
    setRecords((prev) => updateRecordInList(prev, record.id, res.data as LedgerRecord))
    refreshKpiAndSummaryAsync()
    return { ok: true }
  }

  // ── handleQuickEditSaved: optimistic in-place update ──
  function handleQuickEditSaved(updated: LedgerRecord) {
    setRecords((prev) => updateRecordInList(prev, updated.id, updated))
    refreshKpiAndSummaryAsync()
  }

  // ── Checklist completion callbacks ──
  function handleItemCompleting(item: ChecklistEntry, completion: { unit_price: number; supplier: string | null }): number {
    // Return a temporary optimistic ID so the parent can reconcile later
    const tempId = nextTempRecordId.current--
    const optimistic = createOptimisticPurchaseRecord({
      item,
      tempId,
      today: ctx!.today,
      unitPrice: completion.unit_price,
      supplier: completion.supplier,
    })
    const mutationId = nextClientMutationId()
    setMutationId(optimistic, mutationId)
    setRecords((prev) => prependOptimisticRecord(prev, optimistic, mutationId))
    setSummary((prev) => prev ? applyRecordToSummary(prev, optimistic, 1, ctx!.today) : prev)
    setKpi((prev) => prev ? applyRecordToKpi(prev, optimistic, 1, ctx!.today) : prev)
    return tempId
  }

  function handleItemCompleted(record: PurchaseRecord, optimisticId?: number) {
    // Replace the optimistic temp record with the server record
    if (optimisticId !== undefined) {
      setRecords((prev) => reconcileOptimisticRecord(prev, optimisticId, record as LedgerRecord))
      // Refresh KPI for server-consistent cost ratio after purchase completion (BUG #6)
      refreshKpiAsync()
    } else {
      // No optimistic ID — just add to list (dedup by id)
      setRecords((prev) => {
        if (prev.some((r) => r.id === record.id)) return prev
        return [record as LedgerRecord, ...prev]
      })
      setSummary((prev) => prev ? applyRecordToSummary(prev, record as LedgerRecord, 1, ctx!.today) : prev)
      setKpi((prev) => prev ? applyRecordToKpi(prev, record as LedgerRecord, 1, ctx!.today) : prev)
      refreshKpiAsync()
    }
  }

  function handleItemCompleteFailed(optimisticId?: number) {
    if (optimisticId !== undefined) {
      // Find and remove the optimistic record
      const record = records.find((r) => r.id === optimisticId)
      setRecords((prev) => removeOptimisticRecord(prev, optimisticId))
      if (record) {
        setSummary((prev) => prev ? applyRecordToSummary(prev, record, -1, ctx!.today) : prev)
        setKpi((prev) => prev ? applyRecordToKpi(prev, record, -1, ctx!.today) : prev)
      }
    }
  }

  // ── Uncheck: move record back to checklist ──
  async function handleUncheck(record: LedgerRecord) {
    if (pendingUnchecks.current.has(record.id)) return
    pendingUnchecks.current.add(record.id)

    // Build a temp checklist entry immediately so the item appears in the checklist
    // before the API responds. Use a negative temp ID to distinguish from real entries.
    const tempChecklistId = nextTempRecordId.current--
    const tempEntry: ChecklistEntry = {
      id: tempChecklistId,
      name: record.name,
      category: record.category,
      unit: record.unit,
      quantity: record.quantity,
      note: record.note,
      status: 'pending',
      purchase_record_id: null,
      created_at: record.created_at ?? new Date().toISOString(),
      completed_at: null,
      created_by: null,
      created_by_name: null,
    }

    // Optimistic: remove from records + update KPI/summary + add temp to checklist
    setRecords((prev) => prev.filter((r) => r.id !== record.id))
    setSummary((prev) => prev ? applyRecordToSummary(prev, record, -1, ctx!.today) : prev)
    setKpi((prev) => prev ? applyRecordToKpi(prev, record, -1, ctx!.today) : prev)
    restoreChecklistRef.current?.({ type: 'add', item: tempEntry })

    const res = await moveRecordToChecklistAction(record.id)
    pendingUnchecks.current.delete(record.id)

    if (res.ok) {
      // Replace temp checklist entry with the real server-confirmed entry
      restoreChecklistRef.current?.({ type: 'replace', tempId: tempChecklistId, item: res.data })
      // Refresh KPI/summary for server-consistent cost ratio after uncheck
      refreshKpiAndSummaryAsync()
      // No checklistRefreshKey bump needed — the optimistic replace already gives
      // the correct visual state; the rate-limited background sync will reconcile later.
    } else {
      // Rollback: remove temp entry from checklist, restore record and KPI/summary
      restoreChecklistRef.current?.({ type: 'remove', id: tempChecklistId })
      setRecords((prev) => {
        if (prev.some((r) => r.id === record.id)) return prev
        return [...prev, record].sort((a, b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date)
          return b.id - a.id
        })
      })
      setSummary((prev) => prev ? applyRecordToSummary(prev, record, 1, ctx!.today) : prev)
      setKpi((prev) => prev ? applyRecordToKpi(prev, record, 1, ctx!.today) : prev)
    }
  }

  // ── Row props ──
  const rowProps = {
    showCosts,
    canDelete: ctx?.perms.canDelete ?? false,
    onDetail: openDetail,
    onEditRecord: setEditingRecord,
    onDeleteRecord: setDeletingRecord,
    onEditField: (r: LedgerRecord, f: InlineEditField) => setInlineEdit({ record: r, field: f }),
    onUncheck: handleUncheck,
  }

  // ── Derived data ──
  const todayRecords = records.filter((r) => r.date === ctx?.today)
  const historyRecords = records.filter((r) => r.date !== ctx?.today)
  // Render-level dedup: the set of checklist_item_id values carried by purchase
  // records. ChecklistSection hides any checklist item whose id appears here, so
  // a purchased item never shows in both sections — even during the cross-device
  // race window before the checklist row's own status flips to 'done'.
  const purchasedChecklistIds = new Set(
    records.map((r) => r.checklist_item_id).filter((id): id is number => id != null),
  )
  const historyGroups = groupHistory(historyRecords, ctx?.today ?? '')
  const categoryTotals = todayRecords.reduce<{ category: string; total: number }[]>((acc, r) => {
    const existing = acc.find((a) => a.category === r.category)
    if (existing) existing.total += r.total_price ?? 0
    else acc.push({ category: r.category, total: r.total_price ?? 0 })
    return acc
  }, [])
  // Compact top-3 preview shown in the hero card's right column.
  const heroCategoryTotal = categoryTotals.reduce((s, c) => s + c.total, 0)
  const heroCategoryPreview = [...categoryTotals].sort((a, b) => b.total - a.total).slice(0, 3)

  // ── Loading state ──
  if (initialLoading) {
    return (
      <div className="flex flex-col h-dvh bg-gray-50">
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
          <BackButton href="/purchase" />
          <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="w-10" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading…</div>
        </div>
      </div>
    )
  }

  if (bootError && !ctx) {
    return (
      <div className="flex flex-col h-dvh bg-gray-50">
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
          <div className="flex items-center gap-3">
            <BackButton href="/purchase" />
            <span className="text-base font-semibold text-gray-800">Purchase</span>
          </div>
          <div className="w-10" />
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center">
            <div className="text-red-500 text-sm mb-3">{bootError}</div>
            <button type="button" onClick={() => setBootAttempt((n) => n + 1)}
              className="px-5 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold active:opacity-80">
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main UI ──
  return (
    <div className="flex flex-col h-dvh bg-gray-50">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <BackButton href="/purchase" />
          <span className="text-base font-semibold text-gray-800">Purchase</span>
        </div>
        <div className="flex items-center gap-2">
          {ctx?.perms.canExport && (
            <a
              href="/api/purchase/export"
              download
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:opacity-70"
              aria-label="Export CSV"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* ── Pull-to-refresh indicator ── */}
      {pullDist > 0 && (
        <div className="flex items-center justify-center py-2 text-xs text-gray-400 flex-shrink-0"
          style={{ height: Math.max(pullDist, 0), overflow: 'hidden', transition: 'height 0.1s' }}>
          {pullDist >= THRESHOLD ? 'Release to refresh…' : 'Pull to refresh…'}
        </div>
      )}

      {/* ── Scrollable content ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
        {/* ── Hero KPI ── */}
        {kpi && ctx && (() => {
          const st = heroStatus(kpi.today.ratio)
          const clr = HERO_COLOR[st]
          const d = new Date(ctx.today + 'T00:00:00')
          const monthLabel = `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`
          return (
            <div className="mx-4 mt-4">
              <button type="button" onClick={openKpiDetails} className="w-full text-left active:opacity-80">
                <div className="rounded-2xl px-5 pt-5 pb-5" style={{ background: clr.bg }}>
                  <div className="flex items-start justify-between gap-4">
                    {/* Left column: ratio */}
                    <div className="flex-1 min-w-0">
                      {/* Row 1: title */}
                      <span className="text-sm font-bold" style={{ color: clr.text }}>
                        Purchase Cost Ratio
                      </span>
                      {/* Row 2: month */}
                      <div className="text-sm mt-0.5 mb-3" style={{ color: clr.text, opacity: 0.75 }}>
                        {monthLabel}
                      </div>
                      {/* Row 3: large percentage */}
                      <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1, color: clr.text }}>
                        {ratioText(kpi.today.ratio)}
                      </div>
                      {/* Row 4: status */}
                      <div className="text-base font-bold mt-3" style={{ color: clr.text }}>
                        {heroStatusLabel(st)}
                      </div>
                      {/* Row 5: amount / revenue */}
                      <div className="text-sm mt-0.5" style={{ color: clr.text, opacity: 0.85 }}>
                        {rm(kpi.today.purchase)} / {rm(kpi.today.revenue)}
                      </div>
                    </div>

                    {/* Right column: target + compact category breakdown */}
                    <div className="flex flex-col items-end flex-shrink-0" style={{ minWidth: 128, maxWidth: 168 }}>
                      <span className="flex items-center gap-0.5 text-xs font-medium" style={{ color: clr.text, opacity: 0.75 }}>
                        Target ≤ {kpi.target}%
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                      </span>
                      {showCosts && heroCategoryPreview.length > 0 && heroCategoryTotal > 0 && (
                        <div className="w-full mt-4 space-y-1.5">
                          <div className="text-xs font-semibold" style={{ color: clr.text, opacity: 0.7 }}>
                            Top Categories
                          </div>
                          {heroCategoryPreview.map((c) => (
                            <div key={c.category} className="flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: categoryColor(c.category) }} />
                                <span className="truncate" style={{ color: clr.text, opacity: 0.9 }}>{c.category}</span>
                              </div>
                              <span className="font-semibold tabular-nums flex-shrink-0" style={{ color: clr.text }}>
                                {Math.round((c.total / heroCategoryTotal) * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )
        })()}

        {/* ── Filters ── */}
        {showCosts && (
          <div className="mx-4 mt-4">
            <button type="button" onClick={() => setShowFilters((o) => !o)}
              className="flex items-center gap-1.5 text-xs text-gray-500 active:opacity-70">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="12" y1="18" x2="20" y2="18" />
              </svg>
              Filters
              {Object.values(filters).some(Boolean) && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />}
            </button>
            {showFilters && (
              <div className="mt-2 p-3 bg-white rounded-xl border border-gray-100 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Picker label="Category" value={filters.category || 'All'} options={['All', ...PURCHASE_CATEGORIES]} onChange={(v) => setFilters((f) => ({ ...f, category: v === 'All' ? '' : v }))} />
                  <Picker label="Supplier" value={filters.supplier || 'All'} options={['All']} onChange={(v) => setFilters((f) => ({ ...f, supplier: v === 'All' ? '' : v }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">From</label>
                    <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">To</label>
                    <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400" />
                  </div>
                </div>
                <button type="button" onClick={() => { setFilters({ category: '', from: '', to: '', supplier: '', purchaser: '' }); refresh() }}
                  className="text-xs text-orange-500 font-semibold active:opacity-70">Reset</button>
              </div>
            )}
          </div>
        )}

        {/* ── Today's Purchase Checklist ── */}
        <div className="mx-4 mt-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-gray-900">Purchase Checklist</h2>
            <button
              type="button"
              onClick={() => triggerAddChecklistRef.current?.()}
              aria-label="Add checklist item"
              className="w-9 h-9 flex items-center justify-center rounded-full active:opacity-80"
              style={{ background: '#f97316' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
            <ChecklistSection
              showCosts={showCosts}
              catalog={catalog}
              catalogLoading={catalogLoading}
              onRecordCreated={() => setChecklistRefreshKey((k) => k + 1)}
              onItemCompleting={handleItemCompleting}
              onItemCompleted={handleItemCompleted}
              onItemCompleteFailed={handleItemCompleteFailed}
              initialItems={checklistSeed}
              refreshKey={checklistRefreshKey}
              restoreItemRef={restoreChecklistRef}
              triggerAddRef={triggerAddChecklistRef}
              purchasedChecklistIds={purchasedChecklistIds}
              updateItemsRef={updateChecklistRef}
            />
          </div>
        </div>

        {/* ── Purchase Records (today) ── */}
        <div className="mx-4 mt-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-gray-900">Purchase Records</h2>
          </div>
          {todayRecords.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-8 text-center text-sm text-gray-400">
              No records for today
            </div>
          ) : (
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
              {todayRecords.map((r, i) => (
                <RecordRow key={r.id} item={r} isFirst={i === 0} isLast={i === todayRecords.length - 1} {...rowProps} />
              ))}
            </div>
          )}
        </div>

        {/* ── Purchase History ── */}
        <div className="mx-4 mt-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-gray-900">Purchase History</h2>
            {historyGroups.length > 0 && ctx?.perms.canExport && (
              <a
                href="/api/purchase/export"
                download
                className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 active:opacity-70"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export CSV
              </a>
            )}
          </div>
          {historyGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-6 text-center text-sm text-gray-400">
              No purchase history — records from previous days will appear here.
            </div>
          ) : (
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
              {historyGroups.map((month) => (
                <div key={month.monthKey}>
                  {/* Month header */}
                  <button type="button" onClick={() => toggleMonth(month.monthKey)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 active:opacity-70">
                    <span className="text-sm font-semibold text-gray-700">{month.monthLabel}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 tabular-nums">{rm(month.total)}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transform: expandedMonths.has(month.monthKey) ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>
                  {expandedMonths.has(month.monthKey) && month.days.map((day) => (
                    <div key={day.date}>
                      {/* Day header */}
                      <button type="button" onClick={() => toggleDay(day.date)}
                        className="w-full flex items-center justify-between px-4 py-2 active:opacity-70"
                        style={{ borderTop: '1px solid #f3f4f6' }}>
                        <span className="text-xs font-medium text-gray-500">{day.label}</span>
                        <span className="text-xs text-gray-400 tabular-nums">{rm(day.total)}</span>
                      </button>
                      {expandedDays.has(day.date) && day.items.map((r, i) => (
                        <RecordRow key={r.id} item={r} isFirst={i === 0} isLast={i === day.items.length - 1} {...rowProps} />
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          </div>
        {/* ── Category Breakdown ── */}
        {showCosts && categoryTotals.length > 0 && (
          <div ref={breakdownRef} className="mx-4 mt-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold text-gray-900">Category Breakdown</h2>
              <button
                type="button"
                onClick={() => {
                  const opening = !showBreakdown
                  setShowBreakdown(opening)
                  if (opening) {
                    // Wait for the card to expand, then scroll it into view
                    setTimeout(() => {
                      breakdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                    }, 80)
                  }
                }}
                className="flex items-center gap-1 text-xs text-gray-400 active:opacity-70 py-1"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: showBreakdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>
            {showBreakdown && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <DonutChart data={categoryTotals} />
              </div>
            )}
          </div>
        )}

        {/* ── Bottom spacer — tall enough for expanded Category Breakdown to clear the nav bar ── */}
        <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }} />
      </div>

      {/* ── Add sheet ── */}
      {showAdd && (
        <div
          className="fixed inset-0 z-[450] flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowAdd(false)}
        >
          <div
            className="bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <div className="font-semibold text-base">Add Item</div>
              <button type="button" onClick={() => setShowAdd(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <div className="px-4 pt-4 pb-3 space-y-3">
              {addError && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{addError}</div>
              )}
              <CatalogCombobox
                items={catalog}
                selectedItem={selectedAddItem}
                onSelect={(item) => {
                  setSelectedAddItem(item)
                  setForm({
                    name: item.name_zh || item.name_ms || '',
                    specification: '',
                    category: item.category,
                    unit: item.unit,
                    quantity: '',
                    unit_price: '',
                    supplier: '',
                    receiver: '',
                    remarks: '',
                  })
                }}
                loading={catalogLoading}
                error={catalogError}
              />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Name">
                  <input className={inputCls} placeholder="Item name" value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </Field>
                <Field label="Specification">
                  <input className={inputCls} placeholder="Optional" value={form.specification}
                    onChange={(e) => setForm((f) => ({ ...f, specification: e.target.value }))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Picker label="Category" value={form.category} options={PURCHASE_CATEGORIES}
                  onChange={(v) => setForm((f) => ({ ...f, category: v }))} />
                <Picker label="Unit" value={form.unit} options={UNITS}
                  onChange={(v) => setForm((f) => ({ ...f, unit: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Quantity">
                  <input className={inputCls} type="number" inputMode="decimal" placeholder="0" value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
                </Field>
                <Field label="Unit Price (RM)">
                  <input className={inputCls} type="number" inputMode="decimal" placeholder="0.00" value={form.unit_price}
                    onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Supplier">
                  <input className={inputCls} placeholder="Optional" value={form.supplier}
                    onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} />
                </Field>
                <Field label="Receiver">
                  <input className={inputCls} placeholder="Optional" value={form.receiver}
                    onChange={(e) => setForm((f) => ({ ...f, receiver: e.target.value }))} />
                </Field>
              </div>
              <Field label="Remarks">
                <input className={inputCls} placeholder="Optional" value={form.remarks}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
              </Field>
            </div>
            <div className="border-t border-gray-100 px-4 pt-3 pb-3">
              <button type="button" onClick={handleAdd} disabled={saving}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-white active:opacity-90"
                style={{ background: saving ? '#d1d5db' : '#f97316' }}>
                {saving ? 'Adding…' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit sheet (QuickEditSheet) ── */}
      {editingRecord && (
        <QuickEditSheet
          record={editingRecord}
          showCosts={showCosts}
          onClose={() => setEditingRecord(null)}
          onSaved={() => {
            // Re-fetch records silently after full edit so totals stay accurate
            refresh(filters, true)
            setEditingRecord(null)
          }}
        />
      )}

      {/* ── Delete confirm ── */}
      {deletingRecord && (
        <div
          className="fixed inset-0 z-[450] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setDeletingRecord(null)}
        >
          <div className="bg-white rounded-2xl mx-6 p-5 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-base font-semibold text-gray-900">Delete Item</div>
              <div className="text-sm text-gray-500 mt-2">Are you sure you want to delete <strong>{deletingRecord.name}</strong>?</div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setDeletingRecord(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 active:opacity-80">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={deleteInProgress}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white active:opacity-80"
                style={{ background: deleteInProgress ? '#d1d5db' : '#ef4444' }}>
                {deleteInProgress ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Inline field edit sheet (shared NumericEditorSheet) ── */}
      {inlineEdit && (
        <NumericEditorSheet
          title="Edit Item"
          itemName={inlineEdit.record.name}
          unit={inlineEdit.record.unit}
          initialQuantity={inlineEdit.record.quantity}
          initialUnitPrice={inlineEdit.record.unit_price ?? null}
          initialActiveField={inlineEdit.field}
          quantityEditable={true}
          showSupplier={false}
          onSave={async ({ quantity, unitPrice }) => {
            const res = await handleInlineEditSave(inlineEdit.record, quantity, unitPrice)
            return res
          }}
          onClose={() => setInlineEdit(null)}
        />
      )}

    </div>
  )
}
