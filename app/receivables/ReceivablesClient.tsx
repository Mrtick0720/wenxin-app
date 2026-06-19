'use client'

import { useState, useEffect, useCallback } from 'react'
import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'
import { useStaff } from '../components/StaffProvider'
import { fetchReceivablesAction, type Receivable } from './actions'
import ReceivableDetail from './ReceivableDetail'
import ReceivableForm from './ReceivableForm'

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  outstanding: { label: 'Outstanding', bg: 'bg-orange-100', text: 'text-orange-700' },
  partial:     { label: 'Partial',     bg: 'bg-blue-100',   text: 'text-blue-700'   },
  paid:        { label: 'Paid',        bg: 'bg-green-100',  text: 'text-green-700'  },
  overdue:     { label: 'Overdue',     bg: 'bg-red-100',    text: 'text-red-700'    },
}

function fmt(n: number) {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ReceivablesClient() {
  const staff = useStaff()
  const role = staff?.role ?? 'other'

  const [items, setItems] = useState<Receivable[]>([])
  const [canWrite, setCanWrite] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Receivable | null>(null)
  const [editTarget, setEditTarget] = useState<Receivable | undefined>(undefined)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    const res = await fetchReceivablesAction()
    if (res.ok) {
      setItems(res.data.receivables)
      setCanWrite(res.data.canWrite)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    async function init() { await load() }
    init()
  }, [load])

  const totalBalance = items.filter(r => r.status !== 'paid').reduce((s, r) => s + r.balance, 0)
  const openCount = items.filter(r => r.status !== 'paid').length

  function openEdit(item: Receivable) {
    setSelected(null)
    setEditTarget(item)
    setShowForm(true)
  }

  const rowBg = (i: number) => i % 2 === 1 ? '#f9fafb' : '#ffffff'

  if (role === 'kitchen') {
    return (
      <PageTransition>
        <main className="bg-gray-50 min-h-screen">
          <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-10">
            <BackButton href="/" />
            <span className="font-semibold text-base">Receivables</span>
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
            <span className="font-semibold text-base">Receivables</span>
          </div>
          {canWrite && (
            <button type="button" onClick={() => { setEditTarget(undefined); setShowForm(true) }}
              aria-label="Add receivable"
              className="w-9 h-9 flex items-center justify-center rounded-full active:opacity-80"
              style={{ background: '#f97316' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}
        </div>

        <div className="px-4 py-4 pb-28 space-y-4">
          {!loading && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="text-3xl font-bold text-gray-900">{fmt(totalBalance)}</div>
              <div className="text-sm text-gray-400 mt-1">
                {openCount === 0 ? 'No outstanding receivables' : `${openCount} outstanding receivable${openCount !== 1 ? 's' : ''}`}
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm text-sm text-gray-400">
              No receivables yet.
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden shadow-sm">
              {items.map((r, i) => {
                const st = statusConfig[r.status] ?? statusConfig.outstanding
                return (
                  <button key={r.id} type="button" onClick={() => setSelected(r)}
                    className="w-full text-left active:opacity-75"
                    style={{ background: rowBg(i), padding: '16px', minHeight: 72, display: 'block' }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-gray-900 truncate" style={{ fontSize: 16 }}>{r.customer_name}</span>
                      <span className="tabular-nums font-bold flex-shrink-0" style={{ fontSize: 15, color: '#f97316' }}>{fmt(r.balance)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <span className={`text-[11px] font-semibold rounded-full ${st.bg} ${st.text}`}
                        style={{ paddingTop: 2, paddingBottom: 2, paddingLeft: 8, paddingRight: 8 }}>
                        {st.label}
                      </span>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>{r.due_date ? `Due ${r.due_date}` : 'No due date'}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {selected && (
          <ReceivableDetail
            receivable={selected}
            canWrite={canWrite}
            onClose={() => setSelected(null)}
            onEdit={() => openEdit(selected)}
            onChanged={load}
          />
        )}

        {showForm && (
          <ReceivableForm
            edit={editTarget}
            onClose={() => { setShowForm(false); setEditTarget(undefined) }}
            onSaved={load}
          />
        )}
      </main>
    </PageTransition>
  )
}
