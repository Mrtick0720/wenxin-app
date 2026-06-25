'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BackButton from '@/app/components/BackButton'
import PageTransition from '@/app/components/PageTransition'
import type { CashDrawerSession, CashAdjustment } from '@/lib/cashDrawer/types'
import { deleteCashDrawerSessionAction, softDeleteCashAdjustmentAction } from './actions'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function computeCurrentCash(s: CashDrawerSession): number | null {
  if (s.openingFloat == null || s.cashSales == null || s.payIn == null || s.payOut == null) return null
  return s.openingFloat + s.cashSales + s.payIn - s.payOut
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

type Payment = { method: string; amount: number; percentage: number }

type Props = {
  sessions: CashDrawerSession[]
  adjustments: CashAdjustment[]
  feedMeCashSales: number | null
  feedMePayments: Payment[] | null
  businessDate: string
  canImport: boolean
  canAdjust: boolean
}

export default function CashierClient({
  sessions,
  adjustments,
  feedMeCashSales,
  feedMePayments,
  businessDate,
  canImport,
  canAdjust,
}: Props) {
  const router = useRouter()
  const [activeSession, setActiveSession] = useState<CashDrawerSession | null>(sessions[0] ?? null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [importSheetOpen, setImportSheetOpen] = useState(false)
  const [addAdjSheetOpen, setAddAdjSheetOpen] = useState(false)

  // Hero Card
  const hasSession = activeSession !== null
  const heroTitle  = hasSession ? 'Current Cash' : 'Cash Sales Today'
  const heroValue  = hasSession ? computeCurrentCash(activeSession) : feedMeCashSales
  const heroSource = hasSession ? 'FeedMe Import' : (feedMeCashSales !== null ? 'FeedMe POS' : null)
  const heroBadge  = hasSession
    ? (activeSession.closeTime ? 'Closed' : 'Open')
    : (feedMeCashSales !== null ? 'Live' : null)
  const heroDisplay = heroValue !== null ? fmtAmount(heroValue) : '—'

  async function handleDeleteSession() {
    if (!activeSession || deleting) return
    setDeleting(true)
    setDeleteError(null)
    const result = await deleteCashDrawerSessionAction(activeSession.id)
    if (result.ok) {
      setShowDeleteConfirm(false)
      router.refresh()
    } else {
      setDeleteError(result.error)
      setDeleting(false)
    }
  }

  async function handleSoftDeleteAdjustment(id: number) {
    const result = await softDeleteCashAdjustmentAction(id)
    if (result.ok) router.refresh()
  }

  // Payments to display
  const sessionPayments: { label: string; value: string }[] = activeSession
    ? [
        { label: 'Cash',       value: activeSession.cashSales != null ? fmtAmount(activeSession.cashSales) : '—' },
        { label: 'Alipay',     value: activeSession.alipay    != null ? fmtAmount(activeSession.alipay)    : '—' },
        { label: 'DuitNow',    value: activeSession.duitnow   != null ? fmtAmount(activeSession.duitnow)   : '—' },
        { label: 'Maybank QR', value: activeSession.maybankQr != null ? fmtAmount(activeSession.maybankQr) : '—' },
        { label: "Touch'n Go", value: activeSession.touchngo  != null ? fmtAmount(activeSession.touchngo)  : '—' },
        { label: 'WeChat',     value: activeSession.wechat    != null ? fmtAmount(activeSession.wechat)    : '—' },
      ]
    : []

  return (
    <PageTransition>
      <main className="min-h-screen bg-gray-50">

        {/* Header */}
        <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-10">
          <BackButton href="/" />
          <span className="font-semibold text-base">Cash Drawer</span>
        </div>

        <div className="px-4 py-4 pb-8 space-y-4">

          {/* ── Counter Selector ── */}
          {sessions.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSession(s)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeSession?.id === s.id
                      ? 'bg-orange-500 text-white'
                      : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                >
                  {s.counter}
                </button>
              ))}
            </div>
          )}

          {/* ── Hero Card ── */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(150deg, #fb923c 0%, #f97316 45%, #ea580c 100%)' }}
          >
            <div className="flex flex-col px-5 pt-4 pb-5">
              <div className="text-sm font-medium text-white/90 mb-2">{heroTitle}</div>
              <div className="text-3xl font-bold tracking-tight text-white leading-none tabular-nums">
                {heroDisplay}
              </div>
              <div className="flex items-end justify-between mt-4">
                <div>
                  {heroSource && (
                    <>
                      <div className="text-[10px] text-orange-100/70 uppercase tracking-wide">Source</div>
                      <div className="text-base font-bold text-white leading-tight">{heroSource}</div>
                    </>
                  )}
                </div>
                {heroBadge && (
                  <span className="bg-white/20 text-white text-xs font-medium rounded-full px-3 py-1">
                    {heroBadge}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Import Cash Drawer button ── */}
          {canImport && (
            <button
              onClick={() => setImportSheetOpen(true)}
              className="w-full bg-white rounded-2xl shadow-sm px-4 py-3.5 text-sm font-medium text-orange-600 text-left flex items-center justify-between"
            >
              <span>Import Cash Drawer</span>
              <span className="text-gray-300">›</span>
            </button>
          )}

          {/* ── Drawer Session ── */}
          <div className="bg-white rounded-2xl shadow-sm px-4">
            <SectionTitle
              label="Drawer Session"
              action={
                canImport && activeSession ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-[11px] text-red-400 font-medium"
                  >
                    Delete session
                  </button>
                ) : undefined
              }
            />
            {activeSession ? (
              <>
                <Row label="Business Date" value={fmtDate(activeSession.businessDate)} />
                <Row label="Counter"       value={activeSession.counter} />
                <Row label="Status"        value={activeSession.closeTime ? 'Closed' : 'Open'} />
                <Row label="Opened By"     value={activeSession.openedBy ?? '—'} dim={!activeSession.openedBy} />
                <Row label="Closed By"     value={activeSession.closedBy ?? '—'} dim={!activeSession.closedBy} />
                <Row label="Open Time"     value={fmtTime(activeSession.openTime)}  dim={!activeSession.openTime} />
                <Row label="Close Time"    value={fmtTime(activeSession.closeTime)} dim={!activeSession.closeTime} noBorder />
              </>
            ) : (
              <EmptyState message="No session imported for today." />
            )}
            <div className="pb-2" />
          </div>

          {/* ── Cash Summary ── */}
          <div className="bg-white rounded-2xl shadow-sm px-4">
            <SectionTitle label="Cash Summary" />
            <Row label="Opening Float" value={activeSession?.openingFloat != null ? fmtAmount(activeSession.openingFloat) : '—'} dim={!activeSession?.openingFloat} />
            <Row label="Cash Sales"    value={activeSession?.cashSales != null ? fmtAmount(activeSession.cashSales) : (feedMeCashSales != null ? fmtAmount(feedMeCashSales) : '—')} dim={activeSession?.cashSales == null && feedMeCashSales == null} />
            <Row label="Pay In"        value={activeSession?.payIn    != null ? fmtAmount(activeSession.payIn)    : '—'} dim={!activeSession?.payIn} />
            <Row label="Pay Out"       value={activeSession?.payOut   != null ? fmtAmount(activeSession.payOut)   : '—'} dim={!activeSession?.payOut} />
            <Row label="Closing Float" value={activeSession?.closingFloat != null ? fmtAmount(activeSession.closingFloat) : '—'} dim={!activeSession?.closingFloat} />
            <div className="h-px bg-gray-100 -mx-4 my-1" />
            <Row
              label="Expected Cash"
              value={activeSession ? (computeCurrentCash(activeSession) != null ? fmtAmount(computeCurrentCash(activeSession)!) : '—') : '—'}
              highlight={activeSession !== null && computeCurrentCash(activeSession) !== null}
              noBorder
            />
            <div className="pb-2" />
          </div>

          {/* ── Payments ── */}
          <div className="bg-white rounded-2xl shadow-sm px-4">
            <SectionTitle label="Payments" />
            {activeSession ? (
              <>
                {sessionPayments.map((p, i) => (
                  <Row key={p.label} label={p.label} value={p.value} noBorder={i === sessionPayments.length - 1} />
                ))}
              </>
            ) : feedMePayments && feedMePayments.length > 0 ? (
              <>
                {feedMePayments.map((p, i) => (
                  <Row key={p.method} label={methodLabel(p.method)} value={fmtAmount(p.amount)} noBorder={i === feedMePayments.length - 1} />
                ))}
              </>
            ) : (
              <EmptyState message="Payment breakdown not available." />
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
                This will permanently remove the imported FeedMe data for {activeSession?.counter} on {activeSession ? fmtDate(activeSession.businessDate) : ''}. You can re-import it afterwards.
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

      </main>
    </PageTransition>
  )
}
