'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import BackButton from '../../components/BackButton'
import { useNavigation } from '../../components/NavigationStack'

const NewBentoOrder = lazy(() => import('@/app/bento/new/page'))
import { FullPageSpinner } from '../../components/Spinner'
import { supabase } from '@/lib/supabase/client'
import {
  groupUnpaidOrdersByCustomerAndDate,
  type DailyBill,
  type UnpaidOrder,
} from './dailyBills'

const Z_MAX = 2147483647

const MENU_TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  signature: 'Signature',
  vegetarian: 'Vegetarian',
  '清单': 'Standard',
  '风味': 'Signature',
  '素食': 'Vegetarian',
}

function formatDate(dateStr: string, includeYear = false) {
  const date = new Date(`${dateStr}T00:00:00`)
  const formatted = date.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
  })
  return formatted
}

function money(amount: number): string {
  return `RM ${amount.toFixed(2)}`
}

export default function UnpaidPage() {
  const { push } = useNavigation()
  const [orders, setOrders] = useState<UnpaidOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [payingBillKey, setPayingBillKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null)
  const [selectedBill, setSelectedBill] = useState<DailyBill | null>(null)

  const loadUnpaid = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('bento_orders')
      .select('id, customer_name, phone, address, area, menu_type, items, note, amount, quantity, paid, status, date')
      .eq('paid', false)
      .neq('status', 'canceled')
      .order('date', { ascending: false })

    if (loadError) setError(loadError.message || 'Failed to load unpaid bills.')
    setOrders((data ?? []) as UnpaidOrder[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadUnpaid()
  }, [loadUnpaid])

  const customerGroups = useMemo(
    () => groupUnpaidOrdersByCustomerAndDate(orders),
    [orders],
  )
  const selectedCustomer = customerGroups.find(
    (customer) => customer.key === selectedCustomerKey,
  ) ?? null
  const total = customerGroups.reduce((sum, customer) => sum + customer.total, 0)

  useEffect(() => {
    if (selectedCustomerKey && !selectedCustomer) setSelectedCustomerKey(null)
  }, [selectedCustomer, selectedCustomerKey])

  async function markBillPaid(bill: DailyBill) {
    setPayingBillKey(bill.key)
    setError(null)

    try {
      const results = await Promise.all(
        bill.orders.map((order) =>
          supabase
            .from('bento_orders')
            .update({
              paid: true,
              payment_status: 'paid',
              amount_paid: Number(order.amount || 0),
            })
            .eq('id', order.id),
        ),
      )
      const failed = results.find((result) => result.error)
      if (failed?.error) {
        setError(failed.error.message || 'Failed to mark this bill as paid.')
        setPayingBillKey(null)
        return
      }

      const paidIds = new Set(bill.orderIds)
      setOrders((current) => current.filter((order) => !paidIds.has(order.id)))
      setSelectedBill(null)
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setPayingBillKey(null)
    }
  }

  function goBack() {
    setSelectedCustomerKey(null)
    setError(null)
  }

  return (
    <main className="h-dvh min-h-0 bg-gray-50 w-full flex flex-col overflow-hidden">
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          {selectedCustomer ? (
            <button
              type="button"
              onClick={goBack}
              aria-label="Back to unpaid customers"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:opacity-70"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          ) : (
            <BackButton href="/bento" />
          )}
          <div>
            <div className="font-semibold text-base">
              {selectedCustomer?.customerName ?? 'Unpaid Orders'}
            </div>
            {selectedCustomer && (
              <div className="text-xs text-gray-400">
                {selectedCustomer.bills.length} unpaid bill{selectedCustomer.bills.length === 1 ? '' : 's'}
              </div>
            )}
          </div>
        </div>
        {(selectedCustomer ? selectedCustomer.total : total) > 0 && (
          <span className="text-sm text-red-500 font-semibold">
            {money(selectedCustomer?.total ?? total)}
          </span>
        )}
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3"
        style={{
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
        }}
      >
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        {loading && <FullPageSpinner />}

        {!loading && customerGroups.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            <div className="text-4xl mb-3">🎉</div>
            <div className="font-medium text-gray-500">All bills are paid</div>
          </div>
        )}

        {!loading && !selectedCustomer && customerGroups.map((customer) => (
          <button
            key={customer.key}
            type="button"
            onClick={() => { setSelectedCustomerKey(customer.key); setError(null) }}
            className="w-full bg-white rounded-2xl shadow-sm px-4 py-4 text-left active:opacity-75"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 truncate">{customer.customerName}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {customer.bills.length} unpaid bill{customer.bills.length === 1 ? '' : 's'}
                  {customer.phone ? ` · ${customer.phone}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-semibold text-orange-600">{money(customer.total)}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          </button>
        ))}

        {!loading && selectedCustomer?.bills.map((bill) => (
          <button
            key={bill.key}
            type="button"
            onClick={() => { setSelectedBill(bill); setError(null) }}
            className="w-full bg-white rounded-2xl shadow-sm px-4 py-4 text-left active:opacity-75"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-gray-900">{formatDate(bill.date, true)}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {bill.orderCount} order{bill.orderCount === 1 ? '' : 's'} · tap to view bill
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-orange-600">{money(bill.total)}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedBill && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 flex flex-col justify-end"
          style={{ zIndex: Z_MAX, background: 'rgba(0,0,0,0.4)' }}
          onClick={() => { if (!payingBillKey) setSelectedBill(null) }}
        >
          <div
            className="bg-white rounded-t-3xl flex flex-col"
            style={{
              maxHeight: '88vh',
              paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 20px)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-4 pt-5 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-lg text-gray-900">{selectedBill.customerName}</div>
                <div className="text-sm text-gray-400 mt-0.5">{formatDate(selectedBill.date, true)}</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-lg font-bold text-orange-600">{money(selectedBill.total)}</div>
                <button
                  type="button"
                  aria-label="Close bill detail"
                  disabled={Boolean(payingBillKey)}
                  onClick={() => setSelectedBill(null)}
                  className="text-gray-400 text-2xl leading-none active:opacity-70"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="px-4 py-2 overflow-y-auto min-h-0">
              {selectedBill.orders.map((order) => (
                <div key={order.id} className="py-3 border-b border-gray-100 last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-gray-800">
                        {order.items || 'Bento order'}
                        {(order.quantity ?? 0) > 1 ? ` ×${order.quantity}` : ''}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {order.menu_type && (
                          <span className="text-[11px] bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full">
                            {MENU_TYPE_LABELS[order.menu_type] || order.menu_type}
                          </span>
                        )}
                        {order.note && <span className="text-xs text-orange-500 truncate">{order.note}</span>}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                      {money(Number(order.amount || 0))}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="mx-4 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="px-4 pt-3">
              <button
                type="button"
                onClick={() => markBillPaid(selectedBill)}
                disabled={payingBillKey === selectedBill.key}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-white active:opacity-85"
                style={{ background: payingBillKey === selectedBill.key ? '#9ca3af' : '#22c55e' }}
              >
                {payingBillKey === selectedBill.key
                  ? 'Updating…'
                  : `✓ Mark All Paid ${money(selectedBill.total)}`}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      <button
        onClick={() => push('/bento/new', <Suspense fallback={null}><NewBentoOrder /></Suspense>)}
        aria-label="New order"
        className="fixed z-[290] w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:opacity-80"
        style={{ background: '#f97316', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)', left: '50%', transform: 'translateX(-50%)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </main>
  )
}
