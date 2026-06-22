'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import BackButton from '../../../../components/BackButton'
import { CenteredSpinner } from '../../../../components/Spinner'
import { supabase } from '@/lib/supabase/client'
import { splitCustomerMeals, groupRecordsByMonth } from '@/lib/customerOrderHistory'
import { getDeliveredDates } from '@/lib/customerCalendarStatus'
import { todayLocalStr } from '@/lib/dateUtils'
import MealRow, { type MealRowOrder } from '../MealRow'

export default function CustomerHistoryPage({
  customerId,
}: {
  customerId?: number | string
} = {}) {
  const params = useParams<{ id?: string }>()
  const id = customerId !== undefined ? String(customerId) : (params.id ?? '')
  const [name, setName] = useState('')
  const [history, setHistory] = useState<MealRowOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const custRes = await supabase.from('bento_customers').select('id,name,used_portions').eq('id', id).single()
      const cust = custRes.data as { id: number; name: string; used_portions: number } | null
      if (!cust) { if (active) setLoading(false); return }

      const [ordersRes, daysRes] = await Promise.all([
        supabase
          .from('bento_orders')
          .select('id,date,menu_type,quantity,status,amount')
          .ilike('customer_name', cust.name)
          .order('date', { ascending: false }),
        supabase
          .from('bento_subscription_days')
          .select('date,status,order_id')
          .eq('customer_id', cust.id),
      ])
      if (!active) return

      const orders = (ordersRes.data || []) as MealRowOrder[]
      const days = (daysRes.data || []) as { date: string; status: string; order_id: number | null }[]
      const today = todayLocalStr()
      const deliveredDates = getDeliveredDates(days, cust.used_portions, today)
      const split = splitCustomerMeals(orders, days, today, deliveredDates)
      setName(cust.name)
      setHistory(split.history)
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [id])

  const groups = groupRecordsByMonth(history)

  return (
    <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b" style={{ flexShrink: 0 }}>
        <BackButton href={`/bento/customers/${id}`} />
        <div>
          <span className="font-semibold text-base">Delivery History</span>
          {name && <span className="ml-2 text-xs text-gray-400">{name}</span>}
        </div>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}
      >
        {loading ? (
          <CenteredSpinner />
        ) : history.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-16">No past deliveries yet</div>
        ) : (
          groups.map(group => (
            <div key={group.key}>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                {group.label} ({group.items.length})
              </div>
              <div className="space-y-2">
                {group.items.map(o => <MealRow key={o.id} order={o} />)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
