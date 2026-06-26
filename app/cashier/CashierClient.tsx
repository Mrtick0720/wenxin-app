'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import BackButton from '@/app/components/BackButton'
import { FullPageSpinner } from '@/app/components/Spinner'
import type { CashDrawerSession, CashAdjustment } from '@/lib/cashDrawer/types'
import { computeCurrentCash, selectBestSession } from '@/lib/cashDrawer/utils'
import {
  fetchCashDrawerSessionsAction,
  fetchCashAdjustmentsAction,
  fetchLatestClosedSessionAction,
  deleteCashDrawerSessionAction,
  softDeleteCashAdjustmentAction,
  fetchFeedMeRelayAction,
} from './actions'
import { useHideAmounts } from '@/app/hooks/useHideAmounts'
import { useStaff } from '@/app/components/StaffProvider'
import { businessToday } from '@/lib/purchaseLedger/time'
import ImportSessionSheet from './ImportSessionSheet'
import AddAdjustmentSheet from './AddAdjustmentSheet'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtAmount(n: number) {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${DAYS[date.getUTCDay()]}, ${d} ${MONTHS[m - 1]} ${y}`
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('en-MY', {
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kuching',
    })
  } catch { return '—' }
}

const METHOD_LABELS: Record<string, string> = {
  CASH:           'Cash',
  ALIPAY:         'Alipay',
  WECHAT:         'WeChat',
  'WECHAT PAY':   'WeChat Pay',
  DUITNOW:        'DuitNow',
  'DUIT NOW':     'DuitNow',
  'MAYBANK QR':   'Maybank QR',
  "TOUCH'N GO":   "Touch'n Go",
  TOUCHNGO:       "Touch'n Go",
  TNG:            "Touch'n Go",
}

function methodLabel(m: string): string {
  return (
    METHOD_LABELS[m.toUpperCase()] ??
    m.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  )
}

// ── Shared UI primitives ────────────────────────────────────────────────────────

function SectionTitle({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between pt-4 pb-1">
      <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</div>
      {action}
    </div>
  )
}

function Row({
  label,
  value,
  highlight,
  dim,
  noBorder,
}: {
  label: string
  value: string
  highlight?: boolean
  dim?: boolean
  noBorder?: boolean
}) {
  return (
    <div className={`flex items-center justify-between py-2.5 ${noBorder ? '' : 'border-b border-gray-50'}`}>
      <span className={`text-sm ${highlight ? 'font-semibold text-gray-900' : dim ? 'text-gray-400' : 'text-gray-500'}`}>
        {label}
      </span>
      <span className={`text-sm tabular-nums ${highlight ? 'font-semibold text-gray-900' : dim ? 'text-gray-300' : 'text-gray-700'}`}>
        {value}
      </span>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-6">
      <span className="text-sm text-gray-400">{message}</span>
    </div>
  )
}

type AdjTypeBadgeProps = { type: CashAdjustment['adjustmentType'] }
function AdjTypeBadge({ type }: AdjTypeBadgeProps) {
  const labels: Record<CashAdjustment['adjustmentType'], string> = {
    coupon: 'Coupon', voucher: 'Voucher', refund: 'Refund',
    manual_adjustment: 'Adjustment', pay_out: 'Pay Out', other: 'Other',
  }
  const colors: Record<CashAdjustment['adjustmentType'], string> = {
    coupon: 'bg-blue-100 text-blue-700',
    voucher: 'bg-purple-100 text-purple-700',
    refund: 'bg-yellow-100 text-yellow-700',
    manual_adjustment: 'bg-gray-100 text-gray-600',
    pay_out: 'bg-orange-100 text-orange-700',
    other: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors[type]}`}>
      {labels[type]}
    </span>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

type Payment = { method: string; amount: number; percentage: number }

export default function CashierClient() {
  const staff = useStaff()
  const businessDate = businessToday()
  const canImport = staff?.role === 'owner'
  const canAdjust = staff?.role === 'owner' || staff?.role === 'manager'

  const [loading, setLoading] = useState(true)
  const [todaySessions, setTodaySessions] = useState<CashDrawerSession[]>([])
  const [lastClosedSession, setLastClosedSession] = useState<CashDrawerSession | null>(null)
  const [adjustments, setAdjustments] = useState<CashAdjustment[]>([])
  const [feedMeCashSales, setFeedMeCashSales] = useState<number | null>(null)
  const [feedMePayments, setFeedMePayments] = useState<Payment[] | null>(null)

  const [hidden, toggleHidden] = useHideAmounts()
  const [selectedSession, setSelectedSession] = useState<CashDrawerSession | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [importSheetOpen, setImportSheetOpen] = useState(false)
  const [addAdjSheetOpen, setAddAdjSheetOpen] = useState(false)

  async function refresh() {
    const date = businessToday()
    const [sessionsResult, adjustmentsResult, lastClosedResult] = await Promise.all([
      fetchCashDrawerSessionsAction(date),
      fetchCashAdjustmentsAction(date),
      fetchLatestClosedSessionAction(date),
    ])

    const sessions = sessionsResult.ok ? sessionsResult.data : []
    setTodaySessions(sessions)
    setAdjustments(adjustmentsResult.ok ? adjustmentsResult.data : [])
    setLastClosedSession(lastClosedResult.ok ? lastClosedResult.data : null)
    setSelectedSession(selectBestSession(sessions))

    if (sessions.length === 0) {
      const relayResult = await fetchFeedMeRelayAction()
      if (relayResult.ok) {
        setFeedMeCashSales(relayResult.data.cashSales)
        setFeedMePayments(relayResult.data.payments)
      }
    } else {
      setFeedMeCashSales(null)
      setFeedMePayments(null)
    }

    setLoading(false)
  }

  useEffect(() => { void refresh() }, [])

  // Hero value: open → current cash, closed → closing float, fallback → lastClosedSession
  const heroValue = selectedSession
    ? (selectedSession.closeTime === null
        ? computeCurrentCash(selectedSession)
        : selectedSession.closingFloat)
    : (lastClosedSession
        ? (lastClosedSession.closingFloat ?? computeCurrentCash(lastClosedSession))
        : null)
  const heroBadge = selectedSession
    ? (selectedSession.closeTime ? 'Closed' : 'Open')
    : (lastClosedSession ? 'Closed' : null)

  async function handleDeleteSession() {
    if (!selectedSession || deleting) return
    setDeleting(true)
    setDeleteError(null)
    const result = await deleteCashDrawerSessionAction(selectedSession.id)
    if (result.ok) {
      setShowDeleteConfirm(false)
      await refresh()
      setDeleting(false)
    } else {
      setDeleteError(result.error)
      setDeleting(false)
    }
  }

  async function handleSoftDeleteAdjustment(id: number) {
    const result = await softDeleteCashAdjustmentAction(id)
    if (result.ok) void refresh()
  }

  if (loading) return <FullPageSpinner />

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>

      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b" style={{ flexShrink: 0 }}>
        <BackButton href="/" />
        <span className="font-semibold text-base">Cash Drawer</span>
      </div>

      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}
      >

        {/* ── Hero Card ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(150deg, #fb923c 0%, #f97316 45%, #ea580c 100%)' }}
        >
          <div className="flex flex-col px-5 pt-4 pb-5">
            <div className="text-sm font-medium text-white/90">Current Cash</div>
            <div className="text-xs text-white/60 mb-3">Today • Live Cash Drawer</div>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold tracking-tight text-white leading-none tabular-nums">
                {hidden ? 'RM *****' : (heroValue !== null ? fmtAmount(heroValue) : '—')}
              </div>
              <button
                type="button"
                onClick={toggleHidden}
                aria-label={hidden ? 'Show amounts' : 'Hide amounts'}
                className="flex-shrink-0 flex items-center justify-center w-10 h-10 -mr-2 opacity-70 hover:opacity-100 transition-opacity"
              >
                {hidden
                  ? <EyeOff size={20} stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} />
                  : <Eye size={20} stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} />
                }
              </button>
            </div>
            {heroBadge && (
              <div className="flex justify-end mt-4">
                <span className="bg-white/20 text-white text-xs font-medium rounded-full px-3 py-1">
                  {heroBadge}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Today's Cash ── */}
        <div className="bg-white rounded-2xl shadow-sm px-4">
          <SectionTitle
            label="Today's Cash"
            action={
              <div className="flex items-center gap-3">
                {canImport && (
                  <button
                    onClick={() => setImportSheetOpen(true)}
                    className="text-[11px] font-medium text-orange-500"
                  >
                    Import
                  </button>
                )}
                {canImport && selectedSession && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-[11px] text-red-400 font-medium"
                  >
                    Delete
                  </button>
                )}
              </div>
            }
          />

          {/* Counter selector */}
          {todaySessions.length > 1 && (
            <div className="flex gap-2 flex-wrap pb-3">
              {todaySessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSession(s)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedSession?.id === s.id
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {s.counter}
                </button>
              ))}
            </div>
          )}

          {selectedSession ? (
            <>
              <Row label="Cash Drawer"     value={selectedSession.counter} />
              <Row label="Cashier on Duty" value={selectedSession.cashierOnDutyName ?? '—'} dim={!selectedSession.cashierOnDutyName} />
              <Row label="Opened By"       value={selectedSession.openedBy ?? '—'} dim={!selectedSession.openedBy} />
              <Row label="Closed By"       value={selectedSession.closedBy ?? '—'} dim={!selectedSession.closedBy} />
              <Row label="Business Date"   value={fmtDate(selectedSession.businessDate)} />
              <Row label="Status"          value={selectedSession.closeTime ? 'Closed' : 'Open'} />
              <Row label="Open Time"       value={fmtTime(selectedSession.openTime)} dim={!selectedSession.openTime} />
              <Row label="Opening Float" value={selectedSession.openingFloat != null ? fmtAmount(selectedSession.openingFloat) : '—'} dim={selectedSession.openingFloat == null} />
              <Row label="Cash Sales"    value={selectedSession.cashSales != null ? fmtAmount(selectedSession.cashSales) : '—'} dim={selectedSession.cashSales == null} />
              <Row label="Pay In"        value={selectedSession.payIn != null ? fmtAmount(selectedSession.payIn) : '—'} dim={selectedSession.payIn == null} />
              <Row label="Pay Out"       value={selectedSession.payOut != null ? fmtAmount(selectedSession.payOut) : '—'} dim={selectedSession.payOut == null} />
              {selectedSession.closeTime === null
                ? (() => {
                    const cc = computeCurrentCash(selectedSession)
                    return (
                      <Row
                        label="Current Cash"
                        value={cc != null ? fmtAmount(cc) : '—'}
                        highlight={cc !== null}
                      />
                    )
                  })()
                : (
                    <Row
                      label="Closing Float"
                      value={selectedSession.closingFloat != null ? fmtAmount(selectedSession.closingFloat) : '—'}
                      highlight={selectedSession.closingFloat !== null}
                    />
                  )
              }

              {/* Payment breakdown */}
              <div className="h-px bg-gray-100 -mx-4 my-1" />
              <Row label="Cash"       value={selectedSession.cashSales != null ? fmtAmount(selectedSession.cashSales) : '—'} dim={selectedSession.cashSales == null} />
              <Row label="Alipay"     value={selectedSession.alipay != null ? fmtAmount(selectedSession.alipay) : '—'} dim={selectedSession.alipay == null} />
              <Row label="WeChat"     value={selectedSession.wechat != null ? fmtAmount(selectedSession.wechat) : '—'} dim={selectedSession.wechat == null} />
              <Row label="Touch'n Go" value={selectedSession.touchngo != null ? fmtAmount(selectedSession.touchngo) : '—'} dim={selectedSession.touchngo == null} />
              <Row label="DuitNow"    value={selectedSession.duitnow != null ? fmtAmount(selectedSession.duitnow) : '—'} dim={selectedSession.duitnow == null} />
              <Row label="Maybank QR" value={selectedSession.maybankQr != null ? fmtAmount(selectedSession.maybankQr) : '—'} dim={selectedSession.maybankQr == null} noBorder />
            </>
          ) : (
            <>
              <EmptyState message="No session imported for today." />
              {feedMePayments && feedMePayments.length > 0 && (
                <>
                  <div className="h-px bg-gray-100 -mx-4 mb-1" />
                  {feedMePayments.map((p, i) => (
                    <Row
                      key={p.method}
                      label={methodLabel(p.method)}
                      value={fmtAmount(p.amount)}
                      noBorder={i === feedMePayments.length - 1}
                    />
                  ))}
                </>
              )}
              {feedMeCashSales !== null && (
                <div className="text-[11px] text-gray-400 text-center pb-1">
                  From FeedMe POS
                </div>
              )}
            </>
          )}
          <div className="pb-2" />
        </div>

        {/* ── Last Closed Session ── */}
        <div className="bg-white rounded-2xl shadow-sm px-4">
          <SectionTitle label="Last Closed Session" />
          {lastClosedSession ? (
            <>
              <Row label="Cash Drawer"     value={lastClosedSession.counter} />
              <Row label="Cashier on Duty" value={lastClosedSession.cashierOnDutyName ?? '—'} dim={!lastClosedSession.cashierOnDutyName} />
              <Row label="Business Date"   value={fmtDate(lastClosedSession.businessDate)} />
              <Row label="Opened By"       value={lastClosedSession.openedBy ?? '—'} dim={!lastClosedSession.openedBy} />
              <Row label="Closed By"       value={lastClosedSession.closedBy ?? '—'} dim={!lastClosedSession.closedBy} />
              <Row label="Open Time"     value={fmtTime(lastClosedSession.openTime)} dim={!lastClosedSession.openTime} />
              <Row label="Close Time"    value={fmtTime(lastClosedSession.closeTime)} dim={!lastClosedSession.closeTime} />
              <Row label="Opening Float" value={lastClosedSession.openingFloat != null ? fmtAmount(lastClosedSession.openingFloat) : '—'} dim={lastClosedSession.openingFloat == null} />
              <Row label="Cash Sales"    value={lastClosedSession.cashSales != null ? fmtAmount(lastClosedSession.cashSales) : '—'} dim={lastClosedSession.cashSales == null} />
              <Row label="Pay In"        value={lastClosedSession.payIn != null ? fmtAmount(lastClosedSession.payIn) : '—'} dim={lastClosedSession.payIn == null} />
              <Row label="Pay Out"       value={lastClosedSession.payOut != null ? fmtAmount(lastClosedSession.payOut) : '—'} dim={lastClosedSession.payOut == null} />
              <Row label="Closing Float" value={lastClosedSession.closingFloat != null ? fmtAmount(lastClosedSession.closingFloat) : '—'} dim={lastClosedSession.closingFloat == null} />
              <div className="h-px bg-gray-100 -mx-4 my-1" />
              {(() => {
                const expected = computeCurrentCash(lastClosedSession)
                return (
                  <Row
                    label="Expected Cash"
                    value={expected != null ? fmtAmount(expected) : '—'}
                    highlight={expected !== null}
                    noBorder
                  />
                )
              })()}
            </>
          ) : (
            <EmptyState message="No closed session found." />
          )}
          <div className="pb-2" />
        </div>

        {/* ── Cash Adjustments ── */}
        <div className="bg-white rounded-2xl shadow-sm px-4">
          <SectionTitle
            label="Cash Adjustments"
            action={
              canAdjust ? (
                <button
                  onClick={() => setAddAdjSheetOpen(true)}
                  className="text-[11px] font-medium text-orange-500"
                >
                  + Add
                </button>
              ) : undefined
            }
          />
          <div className="text-[11px] text-gray-400 pb-2">
            Tracked for visibility — not included in drawer balance
          </div>
          {adjustments.length === 0 ? (
            <EmptyState message="No adjustments today." />
          ) : (
            adjustments.map((adj, i) => (
              <div
                key={adj.id}
                className={`flex items-center justify-between py-2.5 ${i < adjustments.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AdjTypeBadge type={adj.adjustmentType} />
                  <div className="text-sm text-gray-700 truncate">
                    {adj.referenceNo ? `Ref #${adj.referenceNo}` : adj.category ?? adj.note ?? '—'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-medium text-gray-700 tabular-nums">
                    -{fmtAmount(adj.amount)}
                  </span>
                  {canAdjust && (
                    <button
                      onClick={() => handleSoftDeleteAdjustment(adj.id)}
                      className="text-gray-300 hover:text-red-400 text-base leading-none px-1"
                      aria-label="Remove adjustment"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
          <div className="pb-2" />
        </div>

      </div>

      {/* ── Delete Session Confirm Dialog ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 pb-8 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3">
            <div className="font-semibold text-gray-900">Delete this session?</div>
            <div className="text-sm text-gray-500">
              This will permanently remove the imported data for {selectedSession?.counter} on{' '}
              {selectedSession ? fmtDate(selectedSession.businessDate) : ''}. You can re-import it afterwards.
            </div>
            {deleteError && <div className="text-sm text-red-500">{deleteError}</div>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null) }}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSession}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ImportSessionSheet
        isOpen={importSheetOpen}
        onClose={() => setImportSheetOpen(false)}
        onImported={() => { void refresh() }}
      />

      <AddAdjustmentSheet
        isOpen={addAdjSheetOpen}
        businessDate={businessDate}
        sessionId={selectedSession?.id ?? null}
        onClose={() => setAddAdjSheetOpen(false)}
        onSaved={() => { void refresh() }}
      />

    </div>
  )
}
