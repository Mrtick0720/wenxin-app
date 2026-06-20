'use client'

import { useState, useEffect, useCallback } from 'react'
import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'
import { useStaff } from '../components/StaffProvider'
import { fetchPayablesAction, type Payable } from './actions'
import PayableDetail from './PayableDetail'
import { usePurchaseRealtime } from '../purchase/usePurchaseRealtime'
import { todayLocalStr } from '@/lib/dateUtils'

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  outstanding: { label: 'Outstanding', bg: 'bg-orange-100', text: 'text-orange-700' },
  partial:     { label: 'Partial',     bg: 'bg-blue-100',   text: 'text-blue-700'   },
  paid:        { label: 'Paid',        bg: 'bg-green-100',  text: 'text-green-700'  },
  overdue:     { label: 'Overdue',     bg: 'bg-red-100',    text: 'text-red-700'    },
}

function fmt(n: number) {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Module-level cache — populated by the Payables page and reused on next mount.
// No TTL check at import time; stale data is corrected by the background refresh.
type PayablesCache = { items: Payable[]; canWrite: boolean }
let payablesCache: PayablesCache | null = null

export default function PayablesClient() {
  const staff = useStaff()
  const role = staff?.role ?? 'other'

  const [items, setItems] = useState<Payable[]>(payablesCache?.items ?? [])
  const [canWrite, setCanWrite] = useState(payablesCache?.canWrite ?? false)
  const [loading, setLoading] = useState(!payablesCache)
  const [selected, setSelected] = useState<Payable | null>(null)

  const load = useCallback(async () => {
    const res = await fetchPayablesAction()
    if (res.ok) {
      setItems(res.data.payables)
      setCanWrite(res.data.canWrite)
      payablesCache = { items: res.data.payables, canWrite: res.data.canWrite }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    async function refresh() {
      if (!payablesCache) await load()
      else { load().catch(() => {}) }
    }
    refresh()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime — refresh when purchase_items payment_status changes
  usePurchaseRealtime(() => load())

  const today = todayLocalStr()
  const totalBalance = items.filter(p => p.status !== 'paid').reduce((s, p) => s + p.balance, 0)
  const dueTodayCount = items.filter(p => p.status !== 'paid' && p.due_date === today).length

  function handlePaid(id: number) {
    setItems((current) => {
      const next = current.filter((item) => item.id !== id)
      payablesCache = { items: next, canWrite }
      return next
    })
    setSelected(null)
    load().catch(() => {})
  }

  const rowBg = (i: number) => i % 2 === 1 ? '#f9fafb' : '#ffffff'

  if (role === 'kitchen') {
    return (
      <PageTransition>
        <main className="bg-gray-50 min-h-screen">
          <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-10">
            <BackButton href="/" />
            <span className="font-semibold text-base">Payables</span>
          </div>
          <div className="p-8 text-center text-sm text-gray-400">Access denied.</div>
        </main>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <main className="bg-gray-50 w-full mx-auto min-h-screen">
        <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <BackButton href="/" />
            <span className="font-semibold text-base">Payables</span>
          </div>
          <div className="w-9" />
        </div>

        <div className="px-4 py-4 pb-28 space-y-4">
          {!loading && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="text-3xl font-bold text-gray-900">{fmt(totalBalance)}</div>
              <div className="text-sm mt-1" style={{ color: dueTodayCount > 0 ? '#f97316' : '#9ca3af' }}>
                {dueTodayCount > 0
                  ? `${dueTodayCount} due today`
                  : 'No payables due today'}
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm text-sm text-gray-400">
              No payables yet.
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden shadow-sm">
              {items.map((p, i) => {
                const st = statusConfig[p.status] ?? statusConfig.outstanding
                const isDueToday = p.due_date === today && p.status !== 'paid'
                return (
                  <button key={p.id} type="button" onClick={() => setSelected(p)}
                    className="w-full text-left active:opacity-75"
                    style={{ background: rowBg(i), padding: '16px', minHeight: 72, display: 'block' }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-gray-900 truncate" style={{ fontSize: 16 }}>{p.supplier_name}</span>
                      <span className="tabular-nums font-bold flex-shrink-0"
                        style={{ fontSize: 15, color: isDueToday ? '#f97316' : '#374151' }}>
                        {fmt(p.balance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <span className={`text-[11px] font-semibold rounded-full ${st.bg} ${st.text}`}
                        style={{ paddingTop: 2, paddingBottom: 2, paddingLeft: 8, paddingRight: 8 }}>
                        {st.label}
                      </span>
                      <span style={{ fontSize: 12, color: isDueToday ? '#f97316' : '#9ca3af', fontWeight: isDueToday ? 600 : 400 }}>
                        {p.due_date ? (isDueToday ? 'Due today' : `Due ${p.due_date}`) : 'No due date'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {selected && (
          <PayableDetail
            payable={selected}
            canWrite={canWrite}
            onClose={() => setSelected(null)}
            onPaid={handlePaid}
          />
        )}
      </main>
    </PageTransition>
  )
}
