'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'
import { useStaff } from '../components/StaffProvider'
import { fetchReceivablesAction, type Receivable } from './actions'
import { supabase } from '@/lib/supabase/client'
import ReceivableDetail from './ReceivableDetail'
import { FullPageSpinner } from '../components/Spinner'
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

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`
}

type BentoOrderLite = { id: number; customer_name: string | null; date: string; items: string | null; amount: number | null; quantity: number | null }
type BentoOwed = { customer: string; amount: number; orders: BentoOrderLite[] }

function groupByDate(orders: BentoOrderLite[]): { date: string; total: number; orders: BentoOrderLite[] }[] {
  const map = new Map<string, { date: string; total: number; orders: BentoOrderLite[] }>()
  for (const o of orders) {
    const g = map.get(o.date) ?? { date: o.date, total: 0, orders: [] }
    g.total += Number(o.amount || 0)
    g.orders.push(o)
    map.set(o.date, g)
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
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
  // Completed-but-unpaid bento orders grouped by customer (money owed for meals
  // already delivered, e.g. postpaid schools). Display-only — settle by marking
  // the bento order Paid. Tap a customer to see the individual orders.
  const [bentoOwed, setBentoOwed] = useState<BentoOwed[]>([])
  const [bentoDetail, setBentoDetail] = useState<BentoOwed | null>(null)

  const load = useCallback(async () => {
    const [res, bento] = await Promise.all([
      fetchReceivablesAction(),
      supabase.from('bento_orders')
        .select('id, customer_name, date, items, amount, quantity')
        .eq('status', 'completed').eq('paid', false).order('date', { ascending: false }),
    ])
    if (res.ok) {
      setItems(res.data.receivables)
      setCanWrite(res.data.canWrite)
    }
    const byCust = new Map<string, BentoOwed>()
    for (const o of (bento.data ?? []) as BentoOrderLite[]) {
      const name = o.customer_name?.trim() || 'Unknown'
      const e = byCust.get(name) ?? { customer: name, amount: 0, orders: [] }
      e.amount += Number(o.amount || 0)
      e.orders.push(o)
      byCust.set(name, e)
    }
    setBentoOwed([...byCust.values()].sort((a, b) => b.amount - a.amount))
    setLoading(false)
  }, [])

  useEffect(() => {
    async function init() { await load() }
    init()
  }, [load])

  const bentoTotal = bentoOwed.reduce((s, b) => s + b.amount, 0)
  const totalBalance = items.filter(r => r.status !== 'paid').reduce((s, r) => s + r.balance, 0) + bentoTotal
  const openCount = items.filter(r => r.status !== 'paid').length + bentoOwed.length

  function openEdit(item: Receivable) {
    setSelected(null)
    setEditTarget(item)
    setShowForm(true)
  }

  const rowBg = (i: number) => i % 2 === 1 ? '#f9fafb' : '#ffffff'

  if (loading) return <FullPageSpinner />

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
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="text-3xl font-bold text-gray-900">{fmt(totalBalance)}</div>
            <div className="text-sm text-gray-400 mt-1">
              {openCount === 0 ? 'No outstanding receivables' : `${openCount} outstanding receivable${openCount !== 1 ? 's' : ''}`}
            </div>
          </div>

          {items.length === 0 && bentoOwed.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm text-sm text-gray-400">
              No receivables yet.
            </div>
          ) : (
            <>
            {bentoOwed.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 px-1">🍱 Bento (unpaid · delivered)</div>
                <div className="rounded-2xl overflow-hidden shadow-sm mb-4">
                  {bentoOwed.map((b, i) => (
                    <button key={b.customer} type="button" onClick={() => setBentoDetail(b)}
                      className="w-full text-left active:opacity-75"
                      style={{ background: rowBg(i), padding: '16px', minHeight: 64, display: 'block' }}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold text-gray-900 truncate" style={{ fontSize: 16 }}>{b.customer}</span>
                        <span className="tabular-nums font-bold flex-shrink-0" style={{ fontSize: 15, color: '#f97316' }}>{fmt(b.amount)}</span>
                      </div>
                      <div className="mt-1.5 text-[12px] text-gray-400">
                        {b.orders.length} delivered order{b.orders.length !== 1 ? 's' : ''} · tap to view
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {items.length > 0 && (
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
            </>
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

        {/* Bento debtor detail — one row per delivered unpaid order */}
        {bentoDetail && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 flex flex-col justify-end" style={{ zIndex: 2147483647, background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setBentoDetail(null)}>
            <div className="w-full flex flex-col items-center">
              <button
                type="button"
                aria-label="Close bento receivable detail"
                onClick={(e) => { e.stopPropagation(); setBentoDetail(null) }}
                className="mb-3 w-11 h-11 rounded-full flex items-center justify-center shadow-lg active:opacity-80"
                style={{
                  background: '#4b5563',
                  color: '#fff',
                  opacity: 1,
                  WebkitAppearance: 'none',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.28)',
                }}
              >
                <span className="text-2xl leading-none" aria-hidden="true">×</span>
              </button>
              <div className="w-full bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '85vh', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 20px)' }}
                onClick={e => e.stopPropagation()}>
                <div className="px-4 pt-5 pb-3 border-b border-gray-100 flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-base text-gray-900">{bentoDetail.customer}</div>
                    <div className="text-sm text-gray-400 mt-0.5">{bentoDetail.orders.length} unpaid · delivered</div>
                  </div>
                  <div className="text-lg font-bold text-right" style={{ color: '#f97316' }}>{fmt(bentoDetail.amount)}</div>
                </div>
                <div className="px-4 py-2 overflow-y-auto">
                  {groupByDate(bentoDetail.orders).map(g => (
                    <div key={g.date} className="mb-3">
                      <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-gray-100">
                        <span className="text-xs font-bold text-gray-600">{fmtDate(g.date)}</span>
                        <span className="tabular-nums text-xs font-semibold text-gray-400 flex-shrink-0">{fmt(g.total)}</span>
                      </div>
                      {g.orders.map(o => (
                        <div key={o.id} className="flex items-baseline justify-between gap-3 py-2 pl-3 border-l-2 border-gray-100 ml-0.5">
                          <span className="text-sm text-gray-700 flex-1">{o.items || '—'}{o.quantity ? ` ×${o.quantity}` : ''}</span>
                          <span className="tabular-nums font-semibold text-gray-900 flex-shrink-0">{fmt(Number(o.amount || 0))}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="px-4 pt-2 text-[11px] text-gray-400">Mark each order Paid in Bento to settle.</div>
              </div>
            </div>
          </div>,
          document.body,
        )}
      </main>
    </PageTransition>
  )
}
