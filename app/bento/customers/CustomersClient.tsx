'use client'

import { lazy, Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import BackButton from '../../components/BackButton'
import { supabase } from '@/lib/supabase/client'
import { useStaff } from '@/app/components/StaffProvider'
import { useNavigation } from '../../components/NavigationStack'
import { FullPageSpinner } from '@/app/components/Spinner'
import { getCurrentPackageUsage, type CustomerOrderForUsage } from '@/lib/customerPackageUsage'

const loadCustomerDetailPage = () => import('@/app/bento/customers/[id]/page')
const CustomerDetailPage = lazy(loadCustomerDetailPage)
const loadNewCustomerPage = () => import('@/app/bento/customers/new/page')
const NewCustomerPage = lazy(loadNewCustomerPage)
const detailFallback = <div style={{ position: 'fixed', inset: 0, background: '#f9fafb' }} />

export type Customer = {
  id: number
  name: string
  phone: string
  subscription_type: string
  delivery_method: string
  delivery_address: string
  area: string
  delivery_frequency: 'daily' | 'weekdays'
  menu_preference: string
  taste_notes: string
  start_date: string
  total_portions: number
  used_portions: number
  opening_offset?: number
  package_mode?: string
  note: string
  active: boolean
}

export default function CustomersClient() {
  const staff = useStaff()
  const router = useRouter()
  const { push, currentPath } = useNavigation()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<CustomerOrderForUsage[]>([])
  const [today, setToday] = useState('')
  const [loading, setLoading] = useState(true)

  // Role gate — equivalent to requireRole('owner','manager','front_desk')
  useEffect(() => {
    if (staff && staff.role !== 'owner' && staff.role !== 'manager' && staff.role !== 'front_desk') {
      router.push('/access-denied')
    }
  }, [staff, router])

  // Fetch customers — RLS on bento_customers enforces the same access control
  const loadCustomers = useCallback(async () => {
    const currentDay = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuching' })
    const [custRes, ordRes] = await Promise.all([
      supabase.from('bento_customers').select('*').order('name'),
      supabase.from('bento_orders').select('customer_name,date,quantity,status'),
    ])
    setCustomers((custRes.data || []) as Customer[])
    setOrders((ordRes.data || []) as CustomerOrderForUsage[])
    setToday(currentDay)
    setLoading(false)
  }, [])

  // Stack pages stay mounted underneath their detail page. Refetch when this
  // layer becomes current again so renewals, edits, and status changes appear.
  useEffect(() => {
    // The state updates happen after the Supabase requests resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (currentPath === '/bento/customers') void loadCustomers()
  }, [currentPath, loadCustomers])

  useEffect(() => {
    void loadCustomerDetailPage()
  }, [])

  // Customers run portion PACKAGES — group by status, not by weekly/monthly.
  const activeList = customers.filter(c => c.active)
  const completedList = customers.filter(c => !c.active)

  function CustomerCard({ c, done }: { c: Customer; done: boolean }) {
    // Mirror the detail page: "used" = real delivered portions (non-cancelled
    // orders on/before today), measured against the opening balance (purchased −
    // overuse offset). Overuse shows explicitly instead of a negative "left".
    const used = getCurrentPackageUsage(orders, c.name, c.start_date || '0000-01-01', today)
    const openingBalance = Math.max(c.total_portions - (c.opening_offset ?? 0), 0)
    const remaining = Math.max(openingBalance - used, 0)
    const overused = Math.max(used - openingBalance, 0)
    const pct = openingBalance > 0 ? Math.min(Math.round((used / openingBalance) * 100), 100) : 100
    const accent = done ? '#9ca3af' : '#f97316'
    return (
      <button type="button" onClick={() => push(
        `/bento/customers/${c.id}`,
        <Suspense fallback={detailFallback}><CustomerDetailPage customerId={c.id} initialCustomer={c} /></Suspense>,
      )} className="block w-full text-left bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{c.name}</span>
            <span className="text-xs font-mono text-gray-400">C{String(c.id).padStart(3, '0')}</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-500">
            {c.delivery_method === 'delivery' ? '🚚 Delivery' : '🏪 Pickup'}
          </span>
        </div>
        {c.taste_notes && <div className="text-xs text-orange-500 mb-1">📝 {c.taste_notes}</div>}
        {c.menu_preference && <div className="text-xs text-gray-400 mb-1">🍱 Prefers: {c.menu_preference}</div>}
        {c.total_portions > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{used} used</span>
              <span className={!done && (overused > 0 || remaining <= 3) ? 'text-red-500 font-medium' : 'text-gray-400'}>
                {done ? 'Completed' : overused > 0 ? `Overused ${overused}` : `${remaining} left`}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: done ? '#9ca3af' : (overused > 0 || remaining === 0 || pct >= 80) ? '#ef4444' : accent }} />
            </div>
          </div>
        )}
      </button>
    )
  }

  if (loading) {
    return <FullPageSpinner />
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b" style={{ flexShrink: 0 }}>
        <BackButton href="/bento" />
        <span className="font-semibold text-base">Customers</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 144px)' }}>
        {/* Summary — by status */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl p-3 text-center" style={{ background: '#fff7ed' }}>
            <div className="text-xl font-bold" style={{ color: '#f97316' }}>{activeList.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Active</div>
          </div>
          <div className="rounded-2xl p-3 text-center" style={{ background: '#f3f4f6' }}>
            <div className="text-xl font-bold text-gray-500">{completedList.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Completed</div>
          </div>
        </div>

        {customers.length === 0 && (
          <div className="text-center text-gray-400 py-16">
            <div className="text-4xl mb-3">👥</div>
            <div className="text-sm">No customers yet</div>
            <button type="button" onClick={() => push('/bento/customers/new', <Suspense fallback={detailFallback}><NewCustomerPage onSaved={loadCustomers} /></Suspense>)} className="mt-3 inline-block text-sm text-orange-500">+ Add first customer</button>
          </div>
        )}

        {activeList.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2 px-1 text-orange-500">In progress</div>
            <div className="space-y-2">
              {activeList.map(c => <CustomerCard key={c.id} c={c} done={false} />)}
            </div>
          </div>
        )}

        {completedList.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2 px-1 text-gray-400">Completed</div>
            <div className="space-y-2">
              {completedList.map(c => <CustomerCard key={c.id} c={c} done={true} />)}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => push('/bento/customers/new', <Suspense fallback={detailFallback}><NewCustomerPage onSaved={loadCustomers} /></Suspense>)}
        aria-label="New customer"
        className="fixed z-[290] w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:opacity-80"
        style={{ background: '#f97316', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)', left: '50%', transform: 'translateX(-50%)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  )
}
