'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import MoneyInput from '@/app/components/MoneyInput'
import { importCashDrawerSessionAction, fetchActiveStaffAction } from './actions'
import type { ImportSessionInput } from '@/lib/cashDrawer/types'
import { SheetActionFooter } from '@/components/ui/SheetActionFooter'
import { useGlobalToast } from '@/app/components/GlobalToast'

type Step = 1 | 2 | 3 | 4 | 5

type StaffOption = { id: string; displayName: string }

type FormState = {
  businessDate: string
  counter: string
  cashierOnDutyStaffId: string
  outletName: string
  openTime: string
  closeTime: string
  openedBy: string
  closedBy: string
  openingFloat: string
  closingFloat: string
  cashSales: string
  payIn: string
  payOut: string
  alipay: string
  duitnow: string
  maybankQr: string
  touchngo: string
  wechat: string
}

function today(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuching', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function emptyForm(): FormState {
  return {
    businessDate: today(),
    counter: 'Main',
    cashierOnDutyStaffId: '',
    outletName: '文心砂锅',
    openTime: '', closeTime: '', openedBy: '', closedBy: '',
    openingFloat: '', closingFloat: '',
    cashSales: '', payIn: '', payOut: '',
    alipay: '', duitnow: '', maybankQr: '', touchngo: '', wechat: '',
  }
}

function parseNum(s: string): number | null {
  const v = parseFloat(s.trim())
  return isNaN(v) ? null : v
}

function safeIso(s: string): string | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function fmtReviewNum(s: string): string {
  const v = parseNum(s)
  return v != null ? `RM ${v.toFixed(2)}` : '—'
}

function buildInput(f: FormState): ImportSessionInput {
  return {
    businessDate:           f.businessDate,
    counter:                f.counter.trim() || 'Main',
    cashierOnDutyStaffId:   f.cashierOnDutyStaffId || null,
    outletName:             f.outletName.trim() || null,
    openTime:     safeIso(f.openTime),
    closeTime:    safeIso(f.closeTime),
    openedBy:     f.openedBy.trim()  || null,
    closedBy:     f.closedBy.trim()  || null,
    openingFloat: parseNum(f.openingFloat),
    closingFloat: parseNum(f.closingFloat),
    cashSales:    parseNum(f.cashSales),
    payIn:        parseNum(f.payIn),
    payOut:       parseNum(f.payOut),
    alipay:       parseNum(f.alipay),
    duitnow:      parseNum(f.duitnow),
    maybankQr:    parseNum(f.maybankQr),
    touchngo:     parseNum(f.touchngo),
    wechat:       parseNum(f.wechat),
  }
}

function expectedCash(f: FormState): string {
  const of_ = parseNum(f.openingFloat)
  const cs  = parseNum(f.cashSales)
  const pi  = parseNum(f.payIn)
  const po  = parseNum(f.payOut)
  if (of_ == null || cs == null || pi == null || po == null) return '—'
  const v = of_ + cs + pi - po
  return `RM ${v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function validateStep1(f: FormState): string | null {
  if (!f.businessDate) return 'Please select a business date'
  if (f.businessDate > today()) return 'Business date cannot be in the future'
  if (!f.counter.trim()) return 'Counter name is required'
  return null
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
}

export default function ImportSessionSheet({ isOpen, onClose, onImported }: Props) {
  const { showToast } = useGlobalToast()
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [stepError, setStepError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [staffList, setStaffList] = useState<StaffOption[]>([])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    fetchActiveStaffAction().then(res => {
      if (res.ok) setStaffList(res.data)
    })
  }, [])

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setForm(emptyForm())
      setStepError(null)
      setError(null)
    }
  }, [isOpen])

  function set(key: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
    setStepError(null)
  }

  function handleNext() {
    if (step === 1) {
      const err = validateStep1(form)
      if (err) { setStepError(err); return }
    }
    setStepError(null)
    setStep(s => (s + 1) as Step)
  }

  async function handleImport() {
    if (submitting) return
    setSubmitting(true)
    setError(null)

    // Optimistic: show success + close immediately
    showToast('Session imported')
    onImported()
    onClose()

    const result = await importCashDrawerSessionAction(buildInput(form))
    if (!result.ok) {
      showToast(result.error, 'error')
      onImported()  // refetch to rollback
    }
  }

  if (!mounted || !isOpen) return null

  const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400'
  const labelClass = 'block text-xs text-gray-500 mb-1'

  const stepTitles: Record<Step, string> = {
    1: 'Session Details',
    2: 'Drawer Session',
    3: 'Payment Summary',
    4: 'Review',
    5: 'Import',
  }

  const content = (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Sheet Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <button onClick={onClose} className="text-sm text-gray-500">Cancel</button>
        <span className="font-semibold text-sm">Import Cash Drawer</span>
        <span className="text-xs text-gray-400">Step {step}/5</span>
      </div>

      {/* Step progress bars */}
      <div className="flex gap-1 px-4 pt-3">
        {([1,2,3,4,5] as Step[]).map(s => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-orange-400' : 'bg-gray-100'}`}
          />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="text-base font-semibold text-gray-900 mb-1">{stepTitles[step]}</div>

        {/* Step 1: Session Details */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-xs text-gray-400 mb-3">Import your FeedMe POS report for this business day.</div>
            <div>
              <label className={labelClass}>Business Date</label>
              <input type="date" value={form.businessDate} onChange={e => set('businessDate', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Cash Drawer / Counter</label>
              <input type="text" placeholder="Main" value={form.counter} onChange={e => set('counter', e.target.value)} className={inputClass} />
              <div className="text-[10px] text-gray-400 mt-1">Usually &quot;Main&quot;. Only change if importing a second physical drawer.</div>
            </div>
            <div>
              <label className={labelClass}>Cashier on Duty <span className="text-gray-300">(optional)</span></label>
              <select
                value={form.cashierOnDutyStaffId}
                onChange={e => set('cashierOnDutyStaffId', e.target.value)}
                className={inputClass}
                style={{ appearance: 'none' }}
              >
                <option value="">— Not specified —</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.displayName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Outlet Name</label>
              <input type="text" value={form.outletName} onChange={e => set('outletName', e.target.value)} className={inputClass} />
            </div>
            {stepError && (
              <div className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{stepError}</div>
            )}
          </div>
        )}

        {/* Step 2: Drawer Session */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Open Time</label>
                <input type="datetime-local" value={form.openTime} onChange={e => set('openTime', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Close Time</label>
                <input type="datetime-local" value={form.closeTime} onChange={e => set('closeTime', e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Opened By</label>
                <input type="text" value={form.openedBy} onChange={e => set('openedBy', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Closed By</label>
                <input type="text" value={form.closedBy} onChange={e => set('closedBy', e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Opening Float (RM)</label>
                <MoneyInput
                  value={parseNum(form.openingFloat)}
                  onChange={v => set('openingFloat', v !== null ? v.toFixed(2) : '')}
                  nullable
                  max="cash"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Closing Float (RM)</label>
                <MoneyInput
                  value={parseNum(form.closingFloat)}
                  onChange={v => set('closingFloat', v !== null ? v.toFixed(2) : '')}
                  nullable
                  max="cash"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Payment Summary */}
        {step === 3 && (
          <div className="space-y-4">
            {[
              { key: 'cashSales' as const,  label: 'Cash Sales (RM)' },
              { key: 'payIn' as const,       label: 'Pay In (RM)' },
              { key: 'payOut' as const,      label: 'Pay Out (RM)' },
              { key: 'alipay' as const,      label: 'Alipay (RM)' },
              { key: 'duitnow' as const,     label: 'DuitNow (RM)' },
              { key: 'maybankQr' as const,   label: 'Maybank QR (RM)' },
              { key: 'touchngo' as const,    label: "Touch'n Go (RM)" },
              { key: 'wechat' as const,      label: 'WeChat (RM)' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className={labelClass}>{label} <span className="text-gray-300">(optional)</span></label>
                <MoneyInput
                  value={parseNum(form[key])}
                  onChange={v => set(key, v !== null ? v.toFixed(2) : '')}
                  nullable
                  max="cash"
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-2">Session Details</div>
              <ReviewRow label="Date"             value={form.businessDate} onEdit={() => setStep(1)} />
              <ReviewRow label="Cash Drawer"      value={form.counter || 'Main'} onEdit={() => setStep(1)} />
              <ReviewRow label="Cashier on Duty"  value={staffList.find(s => s.id === form.cashierOnDutyStaffId)?.displayName ?? '—'} onEdit={() => setStep(1)} />
              <ReviewRow label="Outlet"           value={form.outletName || '—'} onEdit={() => setStep(1)} />
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-2">Drawer Session</div>
              <ReviewRow label="Open Time"     value={form.openTime  ? new Date(form.openTime).toLocaleString('en-MY')  : '—'} onEdit={() => setStep(2)} />
              <ReviewRow label="Close Time"    value={form.closeTime ? new Date(form.closeTime).toLocaleString('en-MY') : '—'} onEdit={() => setStep(2)} />
              <ReviewRow label="Opened By"     value={form.openedBy  || '—'} onEdit={() => setStep(2)} />
              <ReviewRow label="Closed By"     value={form.closedBy  || '—'} onEdit={() => setStep(2)} />
              <ReviewRow label="Opening Float" value={fmtReviewNum(form.openingFloat)} onEdit={() => setStep(2)} />
              <ReviewRow label="Closing Float" value={fmtReviewNum(form.closingFloat)} onEdit={() => setStep(2)} />
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-2">Payments</div>
              <ReviewRow label="Cash Sales"  value={fmtReviewNum(form.cashSales)}  onEdit={() => setStep(3)} />
              <ReviewRow label="Pay In"      value={fmtReviewNum(form.payIn)}      onEdit={() => setStep(3)} />
              <ReviewRow label="Pay Out"     value={fmtReviewNum(form.payOut)}     onEdit={() => setStep(3)} />
              <ReviewRow label="Alipay"      value={fmtReviewNum(form.alipay)}     onEdit={() => setStep(3)} />
              <ReviewRow label="DuitNow"     value={fmtReviewNum(form.duitnow)}    onEdit={() => setStep(3)} />
              <ReviewRow label="Maybank QR"  value={fmtReviewNum(form.maybankQr)}  onEdit={() => setStep(3)} />
              <ReviewRow label="Touch'n Go"  value={fmtReviewNum(form.touchngo)}   onEdit={() => setStep(3)} />
              <ReviewRow label="WeChat"      value={fmtReviewNum(form.wechat)}     onEdit={() => setStep(3)} />
            </div>
            <div className="bg-orange-50 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">Expected Cash</span>
                <span className="text-sm font-semibold text-gray-800 tabular-nums">{expectedCash(form)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Import confirmation text only — button lives in the footer below */}
        {step === 5 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              All values have been reviewed. Tap Import to save this Cash Drawer session for {form.businessDate} / {form.counter || 'Main'}.
            </p>
          </div>
        )}
      </div>

      {/* Unified footer — keyboard-aware for all steps */}
      <SheetActionFooter className="border-t border-gray-50">
        {step === 5 ? (
          <>
            {error && (
              <div className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2 mb-3">{error}</div>
            )}
            <button
              onClick={handleImport}
              disabled={submitting}
              className="w-full bg-orange-500 text-white font-semibold py-3.5 rounded-2xl disabled:opacity-50"
            >
              {submitting ? 'Importing…' : 'Import'}
            </button>
          </>
        ) : (
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => { setStep(s => (s - 1) as Step); setStepError(null) }}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-medium text-gray-600"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex-1 py-3 rounded-2xl bg-orange-500 text-white text-sm font-semibold"
            >
              {step === 4 ? 'Confirm' : 'Next'}
            </button>
          </div>
        )}
      </SheetActionFooter>
    </div>
  )

  return createPortal(content, document.body)
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-800 tabular-nums">{value}</span>
        <button onClick={onEdit} className="text-[10px] text-orange-500 font-medium px-2 py-1 -mr-2">Edit</button>
      </div>
    </div>
  )
}
