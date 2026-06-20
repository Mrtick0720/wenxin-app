'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Payable } from './actions'
import PaymentModal from './PaymentModal'

const Z = 2147483647

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  outstanding: { label: 'Outstanding', bg: 'bg-orange-100', text: 'text-orange-700' },
  partial:     { label: 'Partial',     bg: 'bg-blue-100',   text: 'text-blue-700'   },
  paid:        { label: 'Paid',        bg: 'bg-green-100',  text: 'text-green-700'  },
  overdue:     { label: 'Overdue',     bg: 'bg-red-100',    text: 'text-red-700'    },
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right max-w-[60%]">{value}</span>
    </div>
  )
}

function fmt(amount: number) {
  return `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function PayableDetail({
  payable,
  canWrite,
  onClose,
  onPaid,
}: {
  payable: Payable
  canWrite: boolean
  onClose: () => void
  onPaid: (id: number) => void
}) {
  const [showPayment, setShowPayment] = useState(false)
  const st = statusConfig[payable.status] ?? statusConfig.outstanding
  const isPaid = payable.status === 'paid'

  const content = (
    <div className="fixed flex flex-col justify-end"
      style={{ inset: 0, zIndex: Z, background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}>
      <div className="bg-white rounded-t-3xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-50">
          <div className="min-w-0">
            <div className="font-semibold text-xl text-gray-900 truncate">{payable.supplier_name}</div>
            <div className="text-[13px] text-gray-400 mt-0.5">Payable #{payable.id}</div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ml-3 ${st.bg} ${st.text}`}>
            {st.label}
          </span>
        </div>

        <div className="px-5 pt-2">
          <Row label="Original Amount" value={fmt(payable.original_amount)} />
          <Row label="Paid Amount" value={fmt(payable.paid_amount)} />
          <Row label="Balance" value={fmt(payable.balance)} />
          <Row label="Due Date" value={payable.due_date ?? '—'} />
          {payable.notes && (
            <div className="py-2.5 border-b border-gray-50">
              <div className="text-xs text-gray-400 mb-1">Notes</div>
              <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{payable.notes}</div>
            </div>
          )}
        </div>

        <div className="px-5 pt-4 space-y-2">
          {canWrite && !isPaid && (
            <button type="button" onClick={() => setShowPayment(true)}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-white active:opacity-90"
              style={{ background: '#22c55e' }}>
              Mark Paid
            </button>
          )}
          {isPaid && (
            <div className="w-full py-3 rounded-2xl text-sm font-medium text-center bg-green-50 text-green-700">
              Fully paid
            </div>
          )}
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          payableId={payable.id}
          amount={payable.balance}
          onClose={() => setShowPayment(false)}
          onPaid={onPaid}
        />
      )}
    </div>
  )
  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
