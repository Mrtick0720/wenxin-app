'use client'

import { useState, useCallback, useRef, useEffect, lazy } from 'react'
import { FullPageSpinner } from '@/app/components/Spinner'
import { createPortal } from 'react-dom'
import type { StaffRole } from '@/lib/auth/types'
import {
  PURCHASE_CATEGORIES,
  categoryColor,
  categoryOrderIndex,
} from '@/lib/purchaseLedger/categories'
import type { PurchaseSummary, PurchaseKpi, RatioPeriod, PurchaseRecord } from '@/lib/purchaseLedger/types'
import BackButton from '../components/BackButton'
import { useNavigation } from '../components/NavigationStack'
import {
  fetchPurchaseHeroAction,
  fetchPurchaseRecordsAction,
  fetchRecordsAction,
  fetchSummaryAction,
  fetchKpiAction,
  fetchCatalogAction,
  fetchPendingVerificationAction,
  createRecordAction,
  updateRecordAction,
  deleteRecordAction,
} from './actions'
import { fetchChecklistAction, fetchPurchaseContentAction, moveRecordToChecklistAction } from './checklist-actions'
import type { ChecklistEntry } from './checklist-actions'
import type { RestoreChecklistAction } from './ChecklistSection'
import CatalogCombobox from './CatalogCombobox'
import QuickEditSheet from './QuickEditSheet'
import NumericEditorSheet from './NumericEditorSheet'
import ChecklistSection from './ChecklistSection'
import PendingVerificationSection from './PendingVerificationSection'
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
import { useChecklistRealtime } from './useChecklistRealtime'
import { usePurchaseRealtime } from './usePurchaseRealtime'

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
  purchase_method?: string | null
  payment_status?: string | null
  created_by_name?: string | null
  purchased_by_user_id?: string | null
  purchased_by_name?: string | null
  verified_by_name?: string | null
  verified_at?: string | null
  received_quantity?: number | null
  rejected_by_name?: string | null
  rejected_at?: string | null
  rejection_reason?: string | null
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

// ── Hero traffic-light bands ──
// Color category for the Purchase Cost Ratio hero card. These are the COLOR
// thresholds — a management urgency signal — and are deliberately distinct from
// the configurable `kpi.target` (which still drives the "Target ≤ X%" label):
//   < 25%  → Healthy (green)
//   25–30% → Warning (amber)
//   ≥ 30%  → Danger  (red)
type RatioBand = 'healthy' | 'warning' | 'danger' | 'na'

function ratioBand(ratio: number | null): RatioBand {
  if (ratio === null) return 'na'
  if (ratio < 25) return 'healthy'
  if (ratio < 30) return 'warning'
  return 'danger'
}

function ratioBandLabel(b: RatioBand): string {
  switch (b) {
    case 'healthy': return 'Healthy'
    case 'warning': return 'Warning'
    case 'danger':  return 'Danger'
    default:        return 'No data'
  }
}

// Per-band theme for the hero card. Gradients are noticeably more saturated than
// the Home revenue card (orange-400→600) so this reads as a warning indicator
// from a distance. Amber uses dark text for contrast; the rest use white.
const RATIO_BANDS: RatioBand[] = ['healthy', 'warning', 'danger', 'na']
const BAND_THEME: Record<RatioBand, {
  gradient: string; fg: string; fgMuted: string; fgFaint: string; badgeBg: string; badgeFg: string
}> = {
  healthy: {
    gradient: 'linear-gradient(150deg, #22c55e 0%, #16a34a 45%, #15803d 100%)',
    fg: '#ffffff', fgMuted: 'rgba(255,255,255,0.88)', fgFaint: 'rgba(255,255,255,0.70)',
    badgeBg: 'rgba(255,255,255,0.22)', badgeFg: '#ffffff',
  },
  warning: {
    gradient: 'linear-gradient(150deg, #fbbf24 0%, #f59e0b 45%, #d97706 100%)',
    fg: '#422006', fgMuted: 'rgba(66,32,6,0.82)', fgFaint: 'rgba(66,32,6,0.58)',
    badgeBg: 'rgba(66,32,6,0.16)', badgeFg: '#422006',
  },
  danger: {
    gradient: 'linear-gradient(150deg, #f87171 0%, #ef4444 45%, #dc2626 100%)',
    fg: '#ffffff', fgMuted: 'rgba(255,255,255,0.88)', fgFaint: 'rgba(255,255,255,0.70)',
    badgeBg: 'rgba(255,255,255,0.22)', badgeFg: '#ffffff',
  },
  na: {
    gradient: 'linear-gradient(150deg, #9ca3af 0%, #6b7280 45%, #4b5563 100%)',
    fg: '#ffffff', fgMuted: 'rgba(255,255,255,0.88)', fgFaint: 'rgba(255,255,255,0.70)',
    badgeBg: 'rgba(255,255,255,0.22)', badgeFg: '#ffffff',
  },
}

// Money formatting for the hero secondary row — integer + thousands separator,
// matching the Home hero card's style (display only; no calculation change).
function rmHero(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : `RM ${Math.floor(n).toLocaleString('en-US')}`
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
  item, isFirst, isLast, showCosts, canDelete, catalog,
  onDetail, onEditRecord, onDeleteRecord, onUncheck,
}: {
  item: LedgerRecord
  isFirst: boolean
  isLast: boolean
  showCosts: boolean
  canDelete: boolean
  catalog: CatalogItem[]
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

  const translate = showCosts && swiped ? -ACTION_W : 0
  const categoryClr = categoryColor(item.category)
  const borderBottom = !isLast ? '1px solid #f3f4f6' : 'none'

  const stripRadius = { borderTopLeftRadius: isFirst ? 20 : 0, borderBottomLeftRadius: isLast ? 20 : 0 }

  // Kitchen: simple row with checked checkbox, no swipe, no prices
  if (!showCosts) {
    const catalogMatch = catalog.find((c) => c.name_zh === item.name)
    const displayName = catalogMatch?.name_ms?.trim() || item.name
    return (
      <div style={{ position: 'relative', borderBottom, background: '#fff' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: categoryClr, ...stripRadius }} />
        <button type="button" onClick={() => onDetail(item)} className="flex items-center gap-3 px-4 py-3 w-full text-left active:opacity-70">
          <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center"
            style={{ borderColor: '#22c55e', background: '#22c55e' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900">{displayName}</div>
            <div className="text-xs text-gray-400 mt-0.5">{item.quantity} {item.unit}</div>
          </div>
        </button>
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
        {/* Row content — tap anywhere to edit */}
        <button
          type="button"
          onClick={() => {
            if (isSwipeGest.current) return
            if (swipedRef.current) { setSwiped(false); return }
            onEditRecord(item)
          }}
          style={{
            display: 'grid',
            gridTemplateColumns: '40px minmax(0, 1fr) auto auto',
            alignItems: 'center',
            minHeight: 56,
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
            padding: '0 12px',
            columnGap: 12,
            cursor: 'pointer',
          }}
        >
          {/* Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span
              onClick={(e) => {
                e.stopPropagation()
                if (swipedRef.current) { setSwiped(false); return }
                onUncheck(item)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                minWidth: 24,
                minHeight: 24,
                borderRadius: '50%',
                cursor: 'pointer',
                background: '#22c55e',
                border: 'none',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          </div>

          {/* Name — flexible, truncates */}
          <span className="font-semibold text-gray-900 text-left" style={{ fontSize: 16, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name}
          </span>

          {/* Quantity — auto width, never wraps */}
          <span className="font-medium text-gray-600 tabular-nums text-left" style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
            {item.quantity % 1 === 0 ? item.quantity.toFixed(0) : item.quantity.toFixed(2)} {item.unit}
          </span>

          {/* Total Amount — auto width, never wraps, capped */}
          <span className="font-semibold text-gray-900 tabular-nums text-right" style={{ fontSize: 15, whiteSpace: 'nowrap', maxWidth: 90 }}>
            {(item.total_price ?? 0) > 0 ? rm(item.total_price) : '—'}
          </span>
        </button>
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
  purchaserName?: string
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
  checklistLoaded: boolean
  recordsLoaded: boolean
  pendingVerification: LedgerRecord[]
  cachedAt: number
}
let purchaseCache: PurchaseCache | null = null
const CACHE_TTL_MS = 4 * 60 * 1000

const Z_MAX = 2147483647

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
  const [pendingVerification, setPendingVerification] = useState<LedgerRecord[]>(initCache?.pendingVerification ?? [])
  const [pendingVerificationLoaded, setPendingVerificationLoaded] = useState(false)

  const [heroLoading, setHeroLoading] = useState(!hasInitial && !initCache)
  const [checklistLoading, setChecklistLoading] = useState(
    !hasInitial && !initCache?.checklistLoaded,
  )
  const [recordsLoading, setRecordsLoading] = useState(
    !hasInitial && !initCache?.recordsLoaded,
  )
  const [recordsError, setRecordsError] = useState<string | null>(null)
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
  const triggerSendChecklistRef = useRef<(() => void) | null>(null)
  const triggerSelectAllRef = useRef<(() => void) | null>(null)
  const triggerCancelSelectRef = useRef<(() => void) | null>(null)
  const [checklistSelectMode, setChecklistSelectMode] = useState(false)
  const [checklistSelectedCount, setChecklistSelectedCount] = useState(0)
  const [checklistAllSelected, setChecklistAllSelected] = useState(false)
  const updateChecklistRef = useRef<((items: ChecklistEntry[]) => void) | null>(null)
  const breakdownRef = useRef<HTMLDivElement>(null)
  const pendingUnchecks = useRef<Set<number>>(new Set())
  const pendingRecordDeletes = useRef<Set<number>>(new Set())

  const [bootError, setBootError]     = useState<string | null>(null)
  const [bootAttempt, setBootAttempt] = useState(0)

  // When SSR provides initial data (hasInitial), write it into the module cache
  // so that re-entry after popToRoot() renders instantly from cache instead of
  // showing the full loading skeleton.
  useEffect(() => {
    if (!hasInitial) return
    const ctx = { role: props.role!, today: props.today!, perms: props.perms! }
    purchaseCache = {
      ctx,
      records: (props.initialRecords ?? purchaseCache?.records ?? []) as LedgerRecord[],
      summary: props.initialSummary ?? purchaseCache?.summary ?? null,
      kpi: props.initialKpi ?? purchaseCache?.kpi ?? null,
      checklist: props.initialChecklist ?? purchaseCache?.checklist,
      checklistLoaded: !!(props.initialChecklist ?? purchaseCache?.checklistLoaded),
      recordsLoaded: !!(props.initialRecords ?? purchaseCache?.recordsLoaded),
      pendingVerification: purchaseCache?.pendingVerification ?? [],
      cachedAt: Date.now(),
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (hasInitial) return
    let active = true

    // On explicit retry (bootAttempt > 0), ignore any stale cache and force a fresh load
    const cache = bootAttempt === 0 ? initCache : null
    let loadedContent: {
      checklist: ChecklistEntry[]
      pending: LedgerRecord[]
      records: LedgerRecord[]
      summary: PurchaseSummary | null
    } | null = null

    async function refreshPendingVerificationFromCache() {
      const res = await fetchPendingVerificationAction()
      if (!active) return
      if (res.ok) {
        const pending = res.data as LedgerRecord[]
        setPendingVerification(pending)
        if (purchaseCache) {
          purchaseCache = { ...purchaseCache, pendingVerification: pending }
        }
      }
      setPendingVerificationLoaded(true)
    }

    async function loadStages() {
      setBootError(null)
      setRecordsError(null)
      setHeroLoading(!cache?.kpi)
      setChecklistLoading(!cache?.checklistLoaded)
      setRecordsLoading(!cache?.recordsLoaded)

      // Start both independent requests before awaiting either one. Content can
      // become usable while the slower KPI finishes, and vice versa.
      const contentPromise = fetchPurchaseContentAction()
      const heroPromise = fetchPurchaseHeroAction()

      async function loadContent() {
        const contentRes = await contentPromise
        if (!active) return

        if (contentRes.ok) {
          const { checklist, pending, records: recs, summary: sum } = contentRes.data
          loadedContent = {
            checklist,
            pending: pending as LedgerRecord[],
            records: recs as LedgerRecord[],
            summary: sum,
          }
          setChecklistSeed(checklist)
          setPendingVerification(loadedContent.pending)
          setRecords(loadedContent.records)
          setSummary(sum)
          if (purchaseCache) {
            purchaseCache = {
              ...purchaseCache,
              checklist,
              checklistLoaded: true,
              pendingVerification: loadedContent.pending,
              records: loadedContent.records,
              summary: sum,
              recordsLoaded: true,
              cachedAt: Date.now(),
            }
          }
        } else {
          setRecordsError(contentRes.error)
        }
        setChecklistLoading(false)
        setPendingVerificationLoaded(true)
        setRecordsLoading(false)
      }

      async function loadHero() {
        const heroRes = await heroPromise
        if (!active) return

        if (!heroRes.ok) {
          setBootError(heroRes.error)
        } else {
          const newCtx = { role: heroRes.data.role, today: heroRes.data.today, perms: heroRes.data.perms }
          setCtx(newCtx)
          setKpi(heroRes.data.kpi)
          purchaseCache = {
            ctx: newCtx,
            records: loadedContent?.records ?? purchaseCache?.records ?? [],
            summary: loadedContent?.summary ?? purchaseCache?.summary ?? null,
            kpi: heroRes.data.kpi,
            checklist: loadedContent?.checklist ?? purchaseCache?.checklist,
            checklistLoaded: loadedContent ? true : purchaseCache?.checklistLoaded ?? false,
            recordsLoaded: loadedContent ? true : purchaseCache?.recordsLoaded ?? false,
            pendingVerification: loadedContent?.pending ?? purchaseCache?.pendingVerification ?? [],
            cachedAt: Date.now(),
          }
        }
        setHeroLoading(false)
      }

      await Promise.all([loadContent(), loadHero()])
    }

    // Start all fetches immediately. Cached data renders instantly; a cold entry
    // shows each section as soon as its data arrives (all in parallel now).
    if (!cache) {
      loadStages().catch((error) => {
        if (!active) return
        setBootError(error instanceof Error ? error.message : String(error))
        setHeroLoading(false)
      })
    } else {
      // Have cached data — show it immediately, refresh in background if stale
      const isFresh =
        cache.checklistLoaded &&
        cache.recordsLoaded &&
        Date.now() - cache.cachedAt < CACHE_TTL_MS
      if (isFresh) {
        void refreshPendingVerificationFromCache()
      } else {
        setRefreshing(true)
        loadStages().finally(() => {
          if (active) setRefreshing(false)
        })
      }
    }

    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootAttempt])

  const [showFilters, setShowFilters]     = useState(false)
  const [showVerifyFilters, setShowVerifyFilters] = useState(false)
  const [verifyFilters, setVerifyFilters] = useState({ category: '', supplier: '' })
  const [showBreakdown, setShowBreakdown] = useState(false)
  // ── Stage carousel (Checklist → Verify → Received), touch-driven like HeroCard ──
  const TAB_KEYS = ['checklist', 'verification', 'records'] as const
  type TabKey = (typeof TAB_KEYS)[number]
  const SLIDE_COUNT = 3
  const pctPerSlide = 100 / SLIDE_COUNT
  const [tabIndex, setTabIndex] = useState(0)
  const didSetKitchenTab = useRef(false)
  const activeTab: TabKey = TAB_KEYS[tabIndex]
  const [carHeight, setCarHeight] = useState<number | undefined>(undefined)
  const carContainerRef = useRef<HTMLDivElement>(null)
  const carTrackRef = useRef<HTMLDivElement>(null)
  const panelRefs = useRef<(HTMLDivElement | null)[]>([])
  const carWidth = useRef(0)
  const carTouchX = useRef(0)
  const carTouchY = useRef(0)
  const carTracking = useRef(false)
  const carAxis = useRef<'h' | 'v' | null>(null)
  const carAnimId = useRef(0)
  const carAnimating = useRef(false)
  const tabIndexRef = useRef(0)
  tabIndexRef.current = tabIndex
  // showCosts is async (depends on ctx); mirror into a ref so the once-bound native
  // touch listeners always know the latest swipe upper bound (kitchen can't reach Received).
  const showCostsRef = useRef(false)

  const goToIndex = (next: number) => {
    if (carAnimating.current || next === tabIndexRef.current || next < 0 || next >= SLIDE_COUNT) return
    const el = carTrackRef.current
    if (!el) return
    el.style.transition = 'transform 0.3s cubic-bezier(0.3,0,0.1,1)'
    el.style.transform = `translateX(${-(next * pctPerSlide)}%)`
    carAnimating.current = true
    setTabIndex(next); tabIndexRef.current = next
    carAnimId.current++
    const id = carAnimId.current
    setTimeout(() => {
      if (id !== carAnimId.current) return
      el.style.transition = ''
      carAnimating.current = false
    }, 320)
  }
  const goToTab = (key: TabKey) => goToIndex(TAB_KEYS.indexOf(key))

  // Kitchen role defaults to To Verify — applied once when ctx loads (role is async)
  useEffect(() => {
    if (didSetKitchenTab.current) return
    if (ctx?.role === 'kitchen') {
      didSetKitchenTab.current = true
      goToIndex(1)
    }
  }, [ctx])

  const [filters, setFilters] = useState({ category: '', from: '', to: '', supplier: '', purchaser: '' })

  const [catalog, setCatalog]               = useState<CatalogItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogSettled, setCatalogSettled] = useState(false) // true once first fetch completes
  const [catalogError, setCatalogError]     = useState<string | null>(null)
  const catalogLoadStarted = useRef(false)
  const ensureCatalogLoaded = useCallback(async () => {
    if (catalogLoadStarted.current) return
    catalogLoadStarted.current = true
    setCatalogLoading(true)
    setCatalogError(null)
    try {
      const res = await fetchCatalogAction()
      if (res.ok) setCatalog(res.data)
      else setCatalogError(res.error)
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : 'Failed to load catalog')
    } finally {
      setCatalogLoading(false)
      setCatalogSettled(true)
    }
  }, [])

  // Kitchen (no cost view) renders item names translated via the catalog, so it
  // must load eagerly — not just when the Add sheet opens. Without this the
  // kitchen list shows "Unknown item" for every row (empty catalog).
  useEffect(() => {
    if (ctx && !ctx.perms.canViewCosts) void ensureCatalogLoaded()
  }, [ctx, ensureCatalogLoaded])

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
  const [noPermToast, setNoPermToast]       = useState(false)

  function showNoPermToast() {
    setNoPermToast(true)
    setTimeout(() => setNoPermToast(false), 2500)
  }

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
    const [recRes, sumRes, kpiRes, checkRes, pendingRes] = await Promise.all([
      fetchRecordsAction(activeFilters),
      fetchSummaryAction(),
      fetchKpiAction(),
      fetchChecklistAction(),
      fetchPendingVerificationAction(),
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
    if (pendingRes.ok) setPendingVerification(prev => {
      const serverData = pendingRes.data as LedgerRecord[]
      const serverIds = new Set(serverData.map(r => r.id))
      // Keep items that are NOT yet in the server response (optimistic or in-flight).
      // This prevents a background poll from wiping an item that was just added
      // but hasn't been committed to DB yet (or the UPDATE is still in progress).
      const localOnly = prev.filter(r => !serverIds.has(r.id))
      return [...localOnly, ...serverData]
    })
    if (!silent) setRefreshing(false)
  }, [filters, ctx])

  // Silent background refresh — used by polling/visibility/reconnect so no "Refreshing…" shows
  const backgroundRefresh = useCallback(() => {
    setChecklistRefreshKey(k => k + 1)
    return refresh(filters, true)
  }, [refresh, filters])

  // ── Cross-device sync: polling, visibility, reconnect ──
  usePurchaseSync(backgroundRefresh)

  // ── Realtime subscriptions ──
  useChecklistRealtime(() => setChecklistRefreshKey(k => k + 1))
  // purchase_items changes (from any device) → refresh pending verification + records
  usePurchaseRealtime(backgroundRefresh)

  // ── Pull-to-refresh touch handlers ──
  const startY = useRef(0)
  const pulling = useRef(false)
  const pullDistRef = useRef(0)
  const [pullDist, setPullDist] = useState(0)
  const THRESHOLD = 60

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onTouchStart(e: TouchEvent) {
      if (el!.scrollTop > 0) return
      startY.current = e.touches[0].clientY
      pulling.current = true
      pullDistRef.current = 0
    }
    function onTouchMove(e: TouchEvent) {
      if (!pulling.current) return
      const dy = e.touches[0].clientY - startY.current
      // Minimum drag threshold — ignore micro-movements from taps
      // so we never trigger a React re-render during a tap sequence.
      // Re-rendering during tap cancels the synthesized click on iOS Safari.
      if (dy <= 5) return
      const dist = Math.min(dy * 0.5, THRESHOLD * 1.2)
      // Only call setState when the visual distance changes meaningfully,
      // avoiding cascading re-renders on every pixel of scroll.
      if (Math.abs(dist - pullDistRef.current) >= 2) {
        pullDistRef.current = dist
        setPullDist(dist)
      }
    }
    function onTouchEnd() {
      if (pullDistRef.current >= THRESHOLD) {
        refresh()
      }
      pulling.current = false
      pullDistRef.current = 0
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
    // refresh is intentionally excluded — it changes on every filters/ctx change
    // and re-creating listeners mid-gesture breaks pull-to-refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showCosts = ctx?.perms.canViewCosts ?? false
  const canViewReceived = showCosts || ctx?.role === 'kitchen' || ctx?.role === 'front_desk'
  showCostsRef.current = showCosts

  // ── Carousel: native touch listeners (passive:false so a classified horizontal
  // swipe can preventDefault and claim the gesture from the vertical scroller —
  // mirrors HeroCard / PullToRefresh). ──
  useEffect(() => {
    const el = carContainerRef.current
    if (!el) return
    const ELASTIC = 0.35
    const onStart = (e: TouchEvent) => {
      carTouchX.current = e.touches[0].clientX
      carTouchY.current = e.touches[0].clientY
      carTracking.current = true
      carAxis.current = null
      carWidth.current = el.offsetWidth
    }
    const onMove = (e: TouchEvent) => {
      if (!carTracking.current || carAnimating.current) return
      const dx = e.touches[0].clientX - carTouchX.current
      const dy = e.touches[0].clientY - carTouchY.current
      if (!carAxis.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        carAxis.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      }
      if (carAxis.current !== 'h') return
      e.preventDefault()
      const track = carTrackRef.current
      const cw = carWidth.current
      if (!track || cw <= 0) return
      const idx = tabIndexRef.current
      const maxIdx = (showCostsRef.current ? 3 : 2) - 1
      const basePx = -(idx * cw)
      let offset = basePx + dx
      const maxPx = 0
      const minPx = -(maxIdx * cw)
      if (offset > maxPx) offset = maxPx + (offset - maxPx) * ELASTIC
      else if (offset < minPx) offset = minPx + (offset - minPx) * ELASTIC
      track.style.transition = 'none'
      track.style.transform = `translateX(${Math.round(offset)}px)`
    }
    const onEnd = (e: TouchEvent) => {
      if (!carTracking.current) { return }
      const wasH = carAxis.current === 'h'
      carTracking.current = false
      if (!wasH) return
      const idx = tabIndexRef.current
      const dx = e.changedTouches[0].clientX - carTouchX.current
      const threshold = 50
      const maxIdx = (showCostsRef.current ? 3 : 2) - 1
      const track = carTrackRef.current
      if (!track) return
      if (idx > 0 && dx > threshold) goToIndex(idx - 1)
      else if (idx < maxIdx && dx < -threshold) goToIndex(idx + 1)
      else {
        track.style.transition = 'transform 0.25s ease-out'
        track.style.transform = `translateX(${-(idx * pctPerSlide)}%)`
        carAnimId.current++
        const id = carAnimId.current
        setTimeout(() => { if (id === carAnimId.current) track.style.transition = '' }, 260)
      }
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
    // Listeners read live values via refs — bind once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Carousel height tracks the active panel's natural height so shorter tabs
  // don't leave empty space below (panels off-screen are clipped horizontally).
  useEffect(() => {
    const panel = panelRefs.current[tabIndex]
    if (panel) setCarHeight(panel.offsetHeight)
  })

  // ── Open add sheet ──
  function openAdd() {
    void ensureCatalogLoaded()
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
    if (!showCosts) { showNoPermToast(); return }
    push('/purchase/' + r.id, <DetailClient />)
  }

  function openKpiDetails() {
    if (!showCosts) { showNoPermToast(); return }
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
  // Updates the row immediately with recalculated quantity, unit_price, and total_price.
  // No async fetch — the row total changes instantly.
  function handleQuickEditSaved(updated: LedgerRecord) {
    const total_price = (updated.quantity ?? 1) * (updated.unit_price ?? 0)
    setRecords((prev) => updateRecordInList(prev, updated.id, { ...updated, total_price }))
    // Silently refresh KPI/summary in the background — doesn't block the row update
    refreshKpiAndSummaryAsync()
  }

  // ── Checklist completion callbacks ──
  // Completed checklist items go to Pending Verification, NOT directly to records.
  function handleItemCompleting(item: ChecklistEntry, completion: { unit_price: number; supplier: string | null }): number {
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
    console.log('[PV] handleItemCompleting', item.name, 'tempId=', tempId)
    setPendingVerification((prev) => {
      const next = prependOptimisticRecord(prev, optimistic as LedgerRecord, mutationId)
      console.log('[PV] after optimistic add, pendingVerification.length=', next.length)
      return next
    })
    return tempId
  }

  function handleItemCompleted(record: PurchaseRecord, optimisticId?: number) {
    console.log('[PV] handleItemCompleted', record.name, 'optimisticId=', optimisticId, 'status=', record.status)
    if (optimisticId !== undefined) {
      setPendingVerification((prev) => reconcileOptimisticRecord(prev, optimisticId, record as LedgerRecord))
    } else {
      setPendingVerification((prev) => {
        if (prev.some((r) => r.id === record.id)) return prev
        return [record as LedgerRecord, ...prev]
      })
    }
  }

  function handleItemCompleteFailed(optimisticId?: number) {
    console.log('[PV] handleItemCompleteFailed optimisticId=', optimisticId)
    if (optimisticId !== undefined) {
      setPendingVerification((prev) => removeOptimisticRecord(prev, optimisticId))
    }
  }

  // ── Verification accept/reject callbacks ──
  function handleVerificationAccepted(record: PurchaseRecord) {
    setPendingVerification((prev) => prev.filter((r) => r.id !== record.id))
    const ledger = record as LedgerRecord
    setRecords((prev) => {
      if (prev.some((r) => r.id === ledger.id)) return prev
      return [ledger, ...prev]
    })
    setSummary((prev) => prev ? applyRecordToSummary(prev, ledger, 1, ctx!.today) : prev)
    setKpi((prev) => prev ? applyRecordToKpi(prev, ledger, 1, ctx!.today) : prev)
  }

  function handleVerificationRejected(id: number) {
    setPendingVerification((prev) => prev.filter((r) => r.id !== id))
    // Server-side restores the checklist item; trigger a checklist refresh
    setChecklistRefreshKey((k) => k + 1)
  }

  function handleVerificationAcceptFailed(_id: number) {
    // Card stays visible — user can retry
  }

  function handleVerificationRejectFailed(_id: number) {
    // Sheet is closed — user can re-open via Reject button
  }

  function handleVerificationCancelled(id: number) {
    // Remove from pendingVerification; server already restored the checklist item
    setPendingVerification((prev) => prev.filter((r) => r.id !== id))
    setChecklistRefreshKey((k) => k + 1)
  }

  function handleVerificationCancelFailed(_id: number) {
    // Item stays in pendingVerification — user can retry
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
      specification: record.specification ?? null,
      supplier: record.supplier ?? null,
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
      // Replace temp checklist entry with the real server-confirmed entry.
      // Sort by id DESC matches the server order, so the replace prepend is correct.
      restoreChecklistRef.current?.({ type: 'replace', tempId: tempChecklistId, item: res.data })
      // Silently refresh KPI in background — does not affect row position
      refreshKpiAsync()
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
    catalog,
    onDetail: openDetail,
    onEditRecord: setEditingRecord,
    onDeleteRecord: setDeletingRecord,
    onEditField: (r: LedgerRecord, f: InlineEditField) => setInlineEdit({ record: r, field: f }),
    onUncheck: handleUncheck,
  }

  // ── Derived data ──
  const todayRecords = records
    .filter((r) => r.date === ctx?.today)
    .sort((a, b) => categoryOrderIndex(a.category) - categoryOrderIndex(b.category))
  const historyRecords = records.filter((r) => r.date !== ctx?.today)

  // Unique supplier list for the Received filter (derived from all records)
  const supplierOptions = ['All', ...Array.from(new Set(records.map(r => r.supplier).filter((s): s is string => !!s))).sort()]

  // Verify tab filter derived data
  type PendingRecord = { category: string; supplier?: string | null; total_price?: number | null }
  const pendingRecords = pendingVerification as unknown as PendingRecord[]
  const verifySupplierOptions = ['All', ...Array.from(new Set(pendingRecords.map(r => r.supplier).filter((s): s is string => !!s))).sort()]
  const filteredPending = pendingRecords.filter(r =>
    (!verifyFilters.category || r.category === verifyFilters.category) &&
    (!verifyFilters.supplier || r.supplier === verifyFilters.supplier)
  )
  const filteredPendingTotal = filteredPending.reduce((sum, r) => sum + (r.total_price ?? 0), 0)

  // Filtered today records (client-side, for display + total in Received tab)
  const filteredTodayRecords = todayRecords.filter(r =>
    (!filters.category || r.category === filters.category) &&
    (!filters.supplier || r.supplier === filters.supplier)
  )
  const filteredTodayTotal = filteredTodayRecords.reduce((sum, r) => sum + (r.total_price ?? 0), 0)
  // Render-level dedup: the set of checklist_item_id values carried by purchase
  // records. ChecklistSection hides any checklist item whose id appears here, so
  // a purchased item never shows in both sections — even during the cross-device
  // race window before the checklist row's own status flips to 'done'.
  const purchasedChecklistIds = new Set(
    [...records, ...pendingVerification]
      .map((r) => r.checklist_item_id)
      .filter((id): id is number => id != null),
  )
  const historyGroups = groupHistory(historyRecords, ctx?.today ?? '')
  const checklistPendingCount = (checklistSeed ?? []).filter(
    (i) => i.status === 'pending' && !purchasedChecklistIds.has(i.id),
  ).length
  const categoryTotals = todayRecords.reduce<{ category: string; total: number }[]>((acc, r) => {
    const existing = acc.find((a) => a.category === r.category)
    if (existing) existing.total += r.total_price ?? 0
    else acc.push({ category: r.category, total: r.total_price ?? 0 })
    return acc
  }, [])

  async function retryRecords() {
    setRecordsLoading(true)
    setRecordsError(null)
    const res = await fetchPurchaseRecordsAction()
    if (res.ok) {
      const freshRecords = res.data.records as LedgerRecord[]
      setRecords(freshRecords)
      setSummary(res.data.summary)
      if (purchaseCache) {
        purchaseCache = {
          ...purchaseCache,
          records: freshRecords,
          summary: res.data.summary,
          recordsLoaded: true,
          cachedAt: Date.now(),
        }
      }
    } else {
      setRecordsError(res.error)
    }
    setRecordsLoading(false)
  }

  // For kitchen (no cost view), catalog must finish before we show anything.
  // We check catalogSettled (not !catalogLoading) to avoid the timing gap where
  // catalogLoading is still false before the useEffect kicks it off.
  const needsCatalog = ctx !== null && !ctx.perms.canViewCosts
  const dataReady = !!ctx && !checklistLoading && !heroLoading && (!needsCatalog || catalogSettled)
  if (!dataReady && !bootError) {
    return <FullPageSpinner />
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
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>

        {/* ── Hero KPI — always at top; shell renders immediately, numbers fill in last ── */}
        {heroLoading ? (
          <div className="mx-4 mt-4 rounded-2xl overflow-hidden" style={{ backgroundImage: BAND_THEME.danger.gradient }}>
            <div className="relative px-5 pt-3 pb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Purchase Cost Ratio</div>
                <div className="w-20 h-3 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
              </div>
              <div className="flex items-center justify-between" style={{ minHeight: 40 }}>
                <div className="flex gap-1.5 items-center" style={{ height: 36 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.5)', animation: 'pulse-dot 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
              <div className="flex items-end justify-between mt-1">
                <div className="flex gap-6">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Purchase</div>
                    <div className="w-16 h-4 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Revenue</div>
                    <div className="w-16 h-4 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
                  </div>
                </div>
                <div className="w-16 h-6 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
              </div>
            </div>
            <div style={{ height: 15 }} />
          </div>
        ) : kpi && ctx ? (() => {
          const band = ratioBand(kpi.today.ratio)
          const theme = BAND_THEME[band]
          const d = new Date(ctx.today + 'T00:00:00')
          const monthLabel = `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`
          return (
            <div className="mx-4 mt-4">
              <button type="button" onClick={openKpiDetails} className="w-full text-left active:opacity-90">
                <div className="relative rounded-2xl overflow-hidden">
                  {RATIO_BANDS.map((b) => (
                    <div key={b} className="absolute inset-0" style={{ backgroundImage: BAND_THEME[b].gradient, opacity: b === band ? 1 : 0, transition: 'opacity 0.5s ease' }} />
                  ))}
                  <div className="relative px-0 pt-3 pb-2">
                    <div className="flex flex-col px-5" style={{ color: theme.fg, transition: 'color 0.4s ease' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium" style={{ color: theme.fgMuted }}>Purchase Cost Ratio</div>
                        <span className="flex items-center gap-0.5 text-xs font-medium" style={{ color: theme.fgFaint }}>
                          Target ≤ {kpi.target}%
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </span>
                      </div>
                      <div className="flex items-center justify-between" style={{ minHeight: 40 }}>
                        <div className="text-3xl font-bold tracking-tight leading-none">{ratioText(kpi.today.ratio)}</div>
                        <div className="text-xs font-medium" style={{ color: theme.fgFaint }}>{monthLabel}</div>
                      </div>
                      <div className="flex-1 min-h-0" />
                      <div className="flex items-end justify-between">
                        <div className="flex gap-6">
                          <div>
                            <div className="text-[10px] uppercase tracking-wide" style={{ color: theme.fgFaint }}>Purchase</div>
                            <div className="text-base font-bold leading-tight whitespace-nowrap">{rmHero(kpi.today.purchase)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide" style={{ color: theme.fgFaint }}>Revenue</div>
                            <div className="text-base font-bold leading-tight whitespace-nowrap">{rmHero(kpi.today.revenue)}</div>
                          </div>
                        </div>
                        <span className="text-xs font-medium rounded-full px-3 py-1 whitespace-nowrap" style={{ background: theme.badgeBg, color: theme.badgeFg, transition: 'background 0.4s ease, color 0.4s ease' }}>
                          {ratioBandLabel(band)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="relative" style={{ height: 15 }} aria-hidden />
                </div>
              </button>
            </div>
          )
        })() : null}

        {/* ── Stage tabs: Checklist → Verify → Received ── */}
        <div className="mx-4 mt-4 flex gap-2">
          {([
            { key: 'checklist',    label: 'To Buy',    count: checklistPendingCount,        activeBg: '#FF7A1A', inactiveBg: '#FFF3E8', activeText: '#FFFFFF', inactiveText: '#C2410C' },
            { key: 'verification', label: 'To Verify', count: pendingVerification.length,   activeBg: '#2563EB', inactiveBg: '#EFF6FF', activeText: '#FFFFFF', inactiveText: '#1D4ED8' },
            { key: 'records',      label: 'Received',  count: todayRecords.length, locked: !canViewReceived, activeBg: '#16A34A', inactiveBg: '#ECFDF5', activeText: '#FFFFFF', inactiveText: '#15803D' },
          ] as const).map((tab) => {
            const active = activeTab === tab.key
            const locked = 'locked' in tab && tab.locked
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => { if (!locked) goToTab(tab.key) }}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-2xl py-3 transition-colors active:opacity-80"
                style={{
                  background: active ? tab.activeBg : tab.inactiveBg,
                  color: active ? tab.activeText : locked ? '#cbd5e1' : tab.inactiveText,
                }}
              >
                <span className="flex items-center gap-1 text-sm font-semibold leading-none">
                  {tab.label}
                  {locked && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  )}
                </span>
                <span
                  className="text-xl font-bold leading-none tabular-nums"
                  style={{ color: active ? tab.activeText : locked ? '#cbd5e1' : tab.inactiveText }}
                >
                  {locked ? '—' : tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── Stage carousel: Checklist | Verify | Received ── */}
        <div ref={carContainerRef} style={{ overflowX: 'clip', overflowY: 'visible', height: carHeight, transition: 'height 0.3s cubic-bezier(0.3,0,0.1,1)' }}>
          <div ref={carTrackRef} className="flex items-start" style={{ width: '300%', transform: `translateX(${-(tabIndex * pctPerSlide)}%)`, willChange: 'transform' }}>

            {/* Panel 0: Checklist */}
            <div ref={(el) => { panelRefs.current[0] = el }} style={{ width: `${pctPerSlide}%` }}>
        <div className="mx-4 mt-4">
          {/* Send icon (outside card, top-right) OR select controls */}
          {showCosts && (checklistSeed?.filter(i => i.status === 'pending' && i.purchase_record_id === null).length ?? 0) > 0 && (
            checklistSelectMode ? (
              <div className="flex items-center justify-between px-1 pb-2">
                <button type="button" className="text-sm font-medium text-orange-500 active:opacity-60"
                  onClick={() => triggerSelectAllRef.current?.()}>
                  {checklistAllSelected ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-gray-400">{checklistSelectedCount} selected</span>
                <button type="button" className="text-sm font-medium text-gray-500 active:opacity-60"
                  onClick={() => triggerCancelSelectRef.current?.()}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex justify-end pb-2">
                <button type="button"
                  className="p-1 text-gray-400 active:opacity-60"
                  aria-label="Send order"
                  onClick={() => { void ensureCatalogLoaded(); triggerSendChecklistRef.current?.() }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            )
          )}
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
            {(checklistLoading || (!showCosts && catalogLoading)) ? (
              <div className="space-y-3 p-4">
                <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
                <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
                <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
              </div>
            ) : (
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
                triggerSendRef={triggerSendChecklistRef}
                triggerSelectAllRef={triggerSelectAllRef}
                triggerCancelSelectRef={triggerCancelSelectRef}
                purchasedChecklistIds={purchasedChecklistIds}
                updateItemsRef={updateChecklistRef}
                onItemsChange={setChecklistSeed}
                onSelectModeChange={setChecklistSelectMode}
                onSelectionChange={(count, all) => { setChecklistSelectedCount(count); setChecklistAllSelected(all) }}
                purchaserName={props.purchaserName ?? ''}
              />
            )}
          </div>
        </div>
            </div>

            {/* Panel 1: Verify */}
            <div ref={(el) => { panelRefs.current[1] = el }} style={{ width: `${pctPerSlide}%` }}>
          {showCosts && pendingVerification.length > 0 && (
            <div className="mx-4 mt-4">
              <button type="button" onClick={() => setShowVerifyFilters((o) => !o)}
                className="flex items-center gap-1.5 text-xs text-gray-500 active:opacity-70">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6" /><circle cx="8" cy="6" r="2" fill="white" stroke="currentColor" strokeWidth="2" />
                  <line x1="4" y1="12" x2="20" y2="12" /><circle cx="16" cy="12" r="2" fill="white" stroke="currentColor" strokeWidth="2" />
                  <line x1="4" y1="18" x2="20" y2="18" /><circle cx="10" cy="18" r="2" fill="white" stroke="currentColor" strokeWidth="2" />
                </svg>
                {(verifyFilters.category || verifyFilters.supplier) && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />}
              </button>
              {showVerifyFilters && (
                <div className="mt-2 p-3 bg-white rounded-xl border border-gray-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Picker label="Category" value={verifyFilters.category || 'All'} options={['All', ...PURCHASE_CATEGORIES]} onChange={(v) => setVerifyFilters((f) => ({ ...f, category: v === 'All' ? '' : v }))} />
                    <Picker label="Supplier" value={verifyFilters.supplier || 'All'} options={verifySupplierOptions} onChange={(v) => setVerifyFilters((f) => ({ ...f, supplier: v === 'All' ? '' : v }))} />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <button type="button" onClick={() => setVerifyFilters({ category: '', supplier: '' })}
                      className="text-xs text-gray-400 font-medium active:opacity-70">Reset</button>
                    <button type="button" onClick={() => setShowVerifyFilters(false)}
                      className="px-4 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg active:opacity-80">Apply</button>
                  </div>
                </div>
              )}
              {(verifyFilters.category || verifyFilters.supplier) && (
                <div className="mt-2 flex items-center justify-between px-1">
                  <span className="text-xs text-gray-400">
                    {filteredPending.length} item{filteredPending.length !== 1 ? 's' : ''}
                    {verifyFilters.supplier ? ` · ${verifyFilters.supplier}` : ''}
                    {verifyFilters.category ? ` · ${verifyFilters.category}` : ''}
                  </span>
                  <span className="text-sm font-bold text-gray-900">RM {filteredPendingTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
          {pendingVerification.length > 0 ? (
            <PendingVerificationSection
              items={(verifyFilters.category || verifyFilters.supplier ? filteredPending : pendingRecords) as unknown as import('@/lib/purchaseLedger/types').PurchaseRecord[]}
              canVerify={ctx?.perms.canViewCosts || ctx?.role === 'kitchen' || ctx?.role === 'front_desk'}
              onAccepted={handleVerificationAccepted}
              onAcceptFailed={handleVerificationAcceptFailed}
              onRejected={handleVerificationRejected}
              onRejectFailed={handleVerificationRejectFailed}
              onCancelled={handleVerificationCancelled}
              onCancelFailed={handleVerificationCancelFailed}
            />
          ) : (
            <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 px-4 py-10 text-center text-sm text-gray-400">
              No items awaiting verification
            </div>
          )}
            </div>

            {/* Panel 2: Received (owner/manager only; kitchen sees a lock) */}
            <div ref={(el) => { panelRefs.current[2] = el }} style={{ width: `${pctPerSlide}%` }}>
          {!canViewReceived ? (
            <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 px-4 py-12 flex flex-col items-center gap-2 text-sm text-gray-400">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              No access
            </div>
          ) : (
          <>
          {/* Filters */}
          <div className="mx-4 mt-4">
            <button type="button" onClick={() => setShowFilters((o) => !o)}
              className="flex items-center gap-1.5 text-xs text-gray-500 active:opacity-70">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6" /><circle cx="8" cy="6" r="2" fill="white" stroke="currentColor" strokeWidth="2" />
                <line x1="4" y1="12" x2="20" y2="12" /><circle cx="16" cy="12" r="2" fill="white" stroke="currentColor" strokeWidth="2" />
                <line x1="4" y1="18" x2="20" y2="18" /><circle cx="10" cy="18" r="2" fill="white" stroke="currentColor" strokeWidth="2" />
              </svg>
              {Object.values(filters).some(Boolean) && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />}
            </button>
            {showFilters && (
              <div className="mt-2 p-3 bg-white rounded-xl border border-gray-100 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Picker label="Category" value={filters.category || 'All'} options={['All', ...PURCHASE_CATEGORIES]} onChange={(v) => setFilters((f) => ({ ...f, category: v === 'All' ? '' : v }))} />
                  <Picker label="Supplier" value={filters.supplier || 'All'} options={supplierOptions} onChange={(v) => setFilters((f) => ({ ...f, supplier: v === 'All' ? '' : v }))} />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <button type="button" onClick={() => { setFilters({ category: '', from: '', to: '', supplier: '', purchaser: '' }) }}
                    className="text-xs text-gray-400 font-medium active:opacity-70">Reset</button>
                  <button type="button" onClick={() => setShowFilters(false)}
                    className="px-4 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg active:opacity-80">Apply</button>
                </div>
              </div>
            )}
            {(filters.category || filters.supplier) && (
              <div className="mt-2 flex items-center justify-between px-1">
                <span className="text-xs text-gray-400">
                  {filteredTodayRecords.length} item{filteredTodayRecords.length !== 1 ? 's' : ''}
                  {filters.supplier ? ` · ${filters.supplier}` : ''}
                  {filters.category ? ` · ${filters.category}` : ''}
                </span>
                <span className="text-sm font-bold text-gray-900">RM {filteredTodayTotal.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Today's received */}
          <div className="mx-4 mt-4">
            {(recordsLoading || (!showCosts && catalogLoading)) ? (
              <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4">
                <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
                <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
              </div>
            ) : recordsError ? (
              <div className="rounded-2xl border border-red-100 bg-white px-4 py-6 text-center">
                <div className="mb-3 text-sm text-red-500">{recordsError}</div>
                <button type="button" onClick={retryRecords}
                  className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white active:opacity-80">
                  Retry records
                </button>
              </div>
            ) : filteredTodayRecords.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 px-4 py-8 text-center text-sm text-gray-400">
                {todayRecords.length === 0 ? 'No records for today' : 'No records match the filter'}
              </div>
            ) : (
              <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                {filteredTodayRecords.map((r, i) => (
                  <RecordRow key={r.id} item={r} isFirst={i === 0} isLast={i === filteredTodayRecords.length - 1} {...rowProps} />
                ))}
              </div>
            )}
          </div>

          {/* ── Purchase History ── */}
          {!recordsLoading && !recordsError && (
          <div className="mx-4 mt-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold text-gray-900">Purchase History</h2>
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
                        {ctx?.perms.canExport && (() => {
                          const [y, m] = month.monthKey.split('-').map(Number)
                          const lastDay = new Date(y, m, 0).getDate()
                          const from = `${month.monthKey}-01`
                          const to = `${month.monthKey}-${String(lastDay).padStart(2, '0')}`
                          return (
                            <a
                              href={`/api/purchase/export?from=${from}&to=${to}`}
                              download
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 text-gray-400 active:opacity-70"
                              aria-label={`Export ${month.monthLabel}`}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                              </svg>
                            </a>
                          )
                        })()}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
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
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 tabular-nums">{rm(day.total)}</span>
                            {ctx?.perms.canExport && (
                              <a
                                href={`/api/purchase/export?from=${day.date}&to=${day.date}`}
                                download
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 text-gray-400 active:opacity-70"
                                aria-label={`Export ${day.label}`}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                  <polyline points="7 10 12 15 17 10"/>
                                  <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                              </a>
                            )}
                          </div>
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
        )}
          {/* ── Category Breakdown ── */}
          {categoryTotals.length > 0 && (
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
          </>
          )}
            </div>
          </div>
        </div>

        {/* ── Bottom spacer — tall enough for expanded Category Breakdown to clear the nav bar ── */}
        <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }} />
      </div>

      {/* ── Checklist FAB — hidden when in select-to-send mode ── */}
      {activeTab === 'checklist' && !checklistSelectMode && typeof document !== 'undefined' && createPortal(
        <button
          type="button"
          onClick={() => {
            void ensureCatalogLoaded()
            triggerAddChecklistRef.current?.()
          }}
          aria-label="Add item to buy"
          className="fixed z-[290] w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:opacity-80"
          style={{
            background: '#f97316',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>,
        document.body
      )}

      {/* ── Add sheet — portaled to body so it clears bottom nav ── */}
      {showAdd && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed flex flex-col justify-end"
          style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: Z_MAX, background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowAdd(false)}
        >
          <div
            className="bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
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
        </div>,
        document.body
      )}

      {/* ── Edit sheet (QuickEditSheet) — optimistic save ── */}
      {editingRecord && (
        <QuickEditSheet
          record={editingRecord}
          showCosts={showCosts}
          onClose={() => setEditingRecord(null)}
          onOptimisticSave={(optimistic) => {
            setEditingRecord(null)
            handleQuickEditSaved(optimistic)
          }}
          onSaveFailed={(original) => {
            // Revert to original values if the background save failed
            setRecords((prev) => updateRecordInList(prev, original.id, original as unknown as LedgerRecord))
            refreshKpiAndSummaryAsync()
          }}
        />
      )}

      {/* ── Delete confirm — portaled to body ── */}
      {deletingRecord && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed flex items-center justify-center"
          style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: Z_MAX, background: 'rgba(0,0,0,0.4)' }}
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
        </div>,
        document.body
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

      {noPermToast && (
        <div
          className="fixed left-1/2 z-[600] -translate-x-1/2 px-5 py-2.5 rounded-full text-sm font-medium text-white shadow-lg pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom,0px) + 72px)', background: '#111827' }}
        >
          You do not have access to view this information.
        </div>
      )}
    </div>
  )
}
