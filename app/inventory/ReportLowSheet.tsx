'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createLowStockReportAction } from './report-actions'
import type { LowStockReportInput } from '@/lib/inventory/types'
import { SheetActionFooter } from '@/components/ui/SheetActionFooter'
import { useGlobalToast } from '@/app/components/GlobalToast'

type ReportType = 'running_low' | 'out_of_stock' | 'needed_tomorrow' | 'unusual_usage' | 'other'
type Urgency = 'normal' | 'urgent'

type Props = {
  isOpen: boolean
  item: { id: number; name: string; category: string } | undefined
  onClose: () => void
  onSaved: () => void
}

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  running_low: 'Running Low',
  out_of_stock: 'Out of Stock',
  needed_tomorrow: 'Needed Tomorrow',
  unusual_usage: 'Unusual Usage',
  other: 'Other',
}

const REPORT_TYPES = Object.keys(REPORT_TYPE_LABELS) as ReportType[]

export default function ReportLowSheet({ isOpen, item, onClose, onSaved }: Props) {
  const { showToast } = useGlobalToast()
  const [reportType, setReportType] = useState<ReportType>('running_low')
  const [urgency, setUrgency] = useState<Urgency>('normal')
  const [note, setNote] = useState('')
  const [suggestedQuantity, setSuggestedQuantity] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setReportType('running_low')
      setUrgency('normal')
      setNote('')
      setSuggestedQuantity('')
      setError(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  async function handleSubmit() {
    if (!item || !reportType || submitting) return
    setSubmitting(true)
    setError(null)

    const input: LowStockReportInput = {
      itemId: item.id,
      reportType,
      urgency,
      note: note.trim() || undefined,
      suggestedQuantity: suggestedQuantity.trim() ? Number(suggestedQuantity.trim()) : undefined,
    }

    // Optimistic: show success + close immediately
    showToast('Report submitted')
    onSaved()
    onClose()

    const result = await createLowStockReportAction(input)
    if (!result.ok) {
      showToast(result.error ?? 'Failed to submit report', 'error')
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[500] bg-white flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="text-gray-500 text-lg leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          aria-label="Close"
        >
          ✕
        </button>
        <span className="font-semibold text-base flex-1">
          Report Low — {item?.name}
        </span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-5 pb-6 space-y-6">

        {/* WHAT'S HAPPENING */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">What&apos;s Happening</h3>
          <div className="flex flex-wrap gap-2">
            {REPORT_TYPES.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setReportType(type)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  reportType === type
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {REPORT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </section>

        {/* URGENCY */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Urgency</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setUrgency('normal')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                urgency === 'normal'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => setUrgency('urgent')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                urgency === 'urgent'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Urgent 🚨
            </button>
          </div>
        </section>

        {/* NOTE */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Note <span className="font-normal normal-case text-gray-400">(optional)</span></h3>
          <textarea
            rows={3}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Optional note…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 resize-none"
          />
        </section>

        {/* SUGGESTED QUANTITY */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Suggested Quantity <span className="font-normal normal-case text-gray-400">(optional)</span></h3>
          <label className="text-xs text-gray-500 block">Suggested restock qty</label>
          <input
            type="number"
            value={suggestedQuantity}
            onChange={e => setSuggestedQuantity(e.target.value)}
            placeholder="—"
            min={0}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
          />
        </section>

      </div>

      {/* Save bar */}
      <SheetActionFooter className="border-t">
        {error && (
          <p className="text-sm text-red-500 text-center mb-2">{error}</p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!reportType || submitting}
          className="w-full bg-orange-500 text-white font-semibold rounded-2xl py-3.5 text-base disabled:opacity-50 active:bg-orange-600 transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit Report'}
        </button>
      </SheetActionFooter>

    </div>,
    document.body,
  )
}
