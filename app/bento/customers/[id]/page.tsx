'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '../../../components/BackButton'
import { supabase } from '@/lib/supabase'

type Customer = {
  id: number
  name: string
  phone: string
  subscription_type: string
  delivery_method: string
  delivery_address: string
  area: string
  menu_preference: string
  taste_notes: string
  start_date: string
  total_portions: number
  used_portions: number
  note: string
  active: boolean
}

type Order = {
  id: number
  date: string
  menu_type: string
  quantity?: number
  status: string
  amount: number
}

const SUB_COLORS: Record<string, { color: string; bg: string }> = {
  weekly:  { color: '#f97316', bg: '#fff7ed' },
  monthly: { color: '#3b82f6', bg: '#eff6ff' },
  school:  { color: '#8b5cf6', bg: '#faf5ff' },
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getEndDate(startDate: string, subType: string, totalPortions: number): string | null {
  if (!startDate || totalPortions <= 0) return null
  const d = new Date(startDate + 'T00:00:00')
  if (subType === 'weekly') {
    d.setDate(d.getDate() + Math.ceil(totalPortions / 5) * 7)
  } else if (subType === 'monthly') {
    const months = Math.ceil(totalPortions / 22)
    d.setMonth(d.getMonth() + months)
  } else {
    d.setDate(d.getDate() + totalPortions)
  }
  return d.toISOString().split('T')[0]
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [editing, setEditing] = useState(false)
  const [usedEdit, setUsedEdit] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [custRes, ordersRes] = await Promise.all([
      supabase.from('bento_customers').select('*').eq('id', id).single(),
      supabase.from('bento_orders').select('id,date,menu_type,quantity,status,amount')
        .ilike('customer_name', `%${id}%`).order('date', { ascending: false }),
    ])
    const cust = custRes.data as Customer
    setCustomer(cust)
    if (cust) {
      // Match orders by customer name
      const { data: nameOrders } = await supabase
        .from('bento_orders')
        .select('id,date,menu_type,quantity,status,amount')
        .ilike('customer_name', cust.name)
        .order('date', { ascending: false })
      setOrders((nameOrders || []) as Order[])
      setUsedEdit(String(cust.used_portions))
      if (cust.start_date) {
        const d = new Date(cust.start_date + 'T00:00:00')
        setCalYear(d.getFullYear())
        setCalMonth(d.getMonth())
      }
    }
    setLoading(false)
    void ordersRes
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  async function updateUsed() {
    if (!customer) return
    setSaving(true)
    const used = parseInt(usedEdit) || 0
    await supabase.from('bento_customers').update({ used_portions: used }).eq('id', id)
    setCustomer(c => c ? { ...c, used_portions: used } : c)
    setEditing(false)
    setSaving(false)
  }

  async function toggleActive() {
    if (!customer) return
    const newActive = !customer.active
    await supabase.from('bento_customers').update({ active: newActive }).eq('id', id)
    setCustomer(c => c ? { ...c, active: newActive } : c)
  }

  if (loading) return (
    <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  if (!customer) return (
    <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div className="text-gray-400">Customer not found</div>
    </div>
  )

  const colors = SUB_COLORS[customer.subscription_type] ?? SUB_COLORS.monthly
  const remaining = customer.total_portions - customer.used_portions
  const pct = customer.total_portions > 0 ? Math.round((customer.used_portions / customer.total_portions) * 100) : 0
  const endDate = getEndDate(customer.start_date, customer.subscription_type, customer.total_portions)

  // Calendar: order dates set
  const orderDates = new Set(orders.map(o => o.date))

  // Calendar rendering
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const startDateStr = customer.start_date
  const endDateStr = endDate

  return (
    <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <BackButton href="/bento/customers" />
          <div>
            <span className="font-semibold text-base">{customer.name}</span>
            <span className="ml-2 text-xs font-mono text-gray-400">C{String(customer.id).padStart(3, '0')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/bento/customers/${id}/edit`} className="text-xs px-3 py-1 rounded-full border font-medium text-orange-500 border-orange-200 bg-orange-50">
            Edit
          </Link>
          <button onClick={toggleActive} className={`text-xs px-3 py-1 rounded-full border font-medium ${customer.active ? 'text-green-500 border-green-200 bg-green-50' : 'text-gray-400 border-gray-200 bg-gray-50'}`}>
            {customer.active ? 'Active' : 'Inactive'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Profile card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-lg font-bold text-gray-900">{customer.name}</div>
              {customer.phone && <div className="text-sm text-gray-400 mt-0.5">📞 {customer.phone}</div>}
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: colors.bg, color: colors.color }}>
              {customer.subscription_type.charAt(0).toUpperCase() + customer.subscription_type.slice(1)}
            </span>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">{customer.delivery_method === 'delivery' ? '🚚' : '🏪'}</span>
              <span className="text-gray-600">{customer.delivery_method === 'delivery' ? `Delivery${customer.area ? ` · ${customer.area}` : ''}` : 'Pickup'}</span>
            </div>
            {customer.delivery_address && <div className="text-gray-400 text-xs ml-6">{customer.delivery_address}</div>}
            {customer.menu_preference && <div className="flex items-center gap-2"><span className="text-gray-400">🍱</span><span className="text-gray-600">{customer.menu_preference}</span></div>}
            {customer.taste_notes && (
              <div className="flex items-start gap-2 bg-orange-50 rounded-xl px-3 py-2 mt-2">
                <span>📝</span>
                <span className="text-orange-600 text-sm">{customer.taste_notes}</span>
              </div>
            )}
            {customer.note && <div className="text-xs text-gray-400 mt-1">{customer.note}</div>}
          </div>
        </div>

        {/* Subscription tracker */}
        {customer.total_portions > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700">Subscription</span>
              <button onClick={() => setEditing(e => !e)} className="text-xs text-orange-500">Edit used</button>
            </div>

            <div className="flex items-center gap-4 mb-3">
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: colors.color }}>{remaining}</div>
                <div className="text-xs text-gray-400 mt-0.5">Remaining</div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{customer.used_portions} used</span>
                  <span>{customer.total_portions} total</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 80 ? '#ef4444' : colors.color }} />
                </div>
              </div>
            </div>

            {editing && (
              <div className="flex items-center gap-2 mb-3">
                <input type="number" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400" style={{ fontSize: 16 }}
                  value={usedEdit} onChange={e => setUsedEdit(e.target.value)} />
                <button onClick={updateUsed} disabled={saving} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium">
                  {saving ? '...' : 'Save'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              {customer.start_date && (
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <div className="text-gray-400 mb-0.5">Start</div>
                  <div className="font-medium text-gray-700">{formatDate(customer.start_date)}</div>
                </div>
              )}
              {endDateStr && (
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <div className="text-gray-400 mb-0.5">Est. End</div>
                  <div className={`font-medium ${new Date(endDateStr) < new Date() ? 'text-red-500' : 'text-gray-700'}`}>{formatDate(endDateStr)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calendar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-lg">‹</button>
            <span className="text-sm font-semibold text-gray-800">{MONTHS[calMonth]} {calYear}</span>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-lg">›</button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const hasOrder = orderDates.has(dateStr)
              const isStart = dateStr === startDateStr
              const isEnd = dateStr === endDateStr
              const today = new Date().toISOString().split('T')[0]
              const isToday = dateStr === today
              return (
                <div key={day} className="flex justify-center py-0.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm relative
                    ${isStart || isEnd ? 'ring-2' : ''}
                    ${hasOrder ? 'font-bold' : ''}`}
                    style={{
                      background: hasOrder ? colors.color : isToday ? '#f3f4f6' : 'transparent',
                      color: hasOrder ? '#fff' : isToday ? colors.color : '#374151',
                      outline: (isStart || isEnd) ? `2px solid ${colors.color}` : undefined,
                    }}>
                    {day}
                    {(isStart || isEnd) && !hasOrder && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: colors.color }} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ background: colors.color }}/> Order day</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full border-2" style={{ borderColor: colors.color }}/> Start/End</div>
          </div>
        </div>

        {/* Recent orders */}
        {orders.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">Order History ({orders.length})</div>
            <div className="space-y-2">
              {orders.slice(0, 20).map(o => (
                <div key={o.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{o.date}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{o.menu_type}{(o.quantity ?? 1) > 1 ? ` ×${o.quantity}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${o.status === 'completed' ? 'bg-green-50 text-green-500' : 'bg-orange-50 text-orange-500'}`}>
                      {o.status === 'completed' ? 'Done' : 'Pending'}
                    </span>
                    <span className="text-sm font-medium text-gray-700">RM {o.amount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pb-8" />
      </div>
    </div>
  )
}
