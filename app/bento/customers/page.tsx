import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import BackButton from '../../components/BackButton'

export const dynamic = 'force-dynamic'

export type Customer = {
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

const SUB_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  weekly:  { label: 'Weekly',  color: '#f97316', bg: '#fff7ed' },
  monthly: { label: 'Monthly', color: '#3b82f6', bg: '#eff6ff' },
  school:  { label: 'School',  color: '#8b5cf6', bg: '#faf5ff' },
}

export default async function CustomersPage() {
  const { data } = await supabase
    .from('bento_customers')
    .select('*')
    .order('name')

  const customers = (data || []) as Customer[]
  const active = customers.filter(c => c.active)
  const weekly = active.filter(c => c.subscription_type === 'weekly')
  const monthly = active.filter(c => c.subscription_type === 'monthly')
  const school = active.filter(c => c.subscription_type === 'school')

  return (
    <div className="page-slide-in" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <BackButton href="/bento" />
          <span className="font-semibold text-base">Customers</span>
        </div>
        <Link href="/bento/customers/new" className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-xl leading-none">+</Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Weekly', count: weekly.length, color: '#f97316', bg: '#fff7ed' },
            { label: 'Monthly', count: monthly.length, color: '#3b82f6', bg: '#eff6ff' },
            { label: 'School', count: school.length, color: '#8b5cf6', bg: '#faf5ff' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-3 text-center" style={{ background: s.bg }}>
              <div className="text-xl font-bold" style={{ color: s.color }}>{s.count}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {customers.length === 0 && (
          <div className="text-center text-gray-400 py-16">
            <div className="text-4xl mb-3">👥</div>
            <div className="text-sm">No customers yet</div>
            <Link href="/bento/customers/new" className="mt-3 inline-block text-sm text-orange-500">+ Add first customer</Link>
          </div>
        )}

        {/* Customer list grouped by type */}
        {[
          { key: 'weekly', list: weekly },
          { key: 'monthly', list: monthly },
          { key: 'school', list: school },
        ].filter(g => g.list.length > 0).map(({ key, list }) => {
          const meta = SUB_LABELS[key]
          return (
            <div key={key}>
              <div className="text-xs font-semibold uppercase tracking-wide mb-2 px-1" style={{ color: meta.color }}>{meta.label}</div>
              <div className="space-y-2">
                {list.map(c => {
                  const remaining = c.total_portions - c.used_portions
                  const pct = c.total_portions > 0 ? Math.round((c.used_portions / c.total_portions) * 100) : 0
                  return (
                    <Link key={c.id} href={`/bento/customers/${c.id}`} className="block bg-white rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900">{c.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>
                          {c.delivery_method === 'delivery' ? '🚚 Delivery' : '🏪 Pickup'}
                        </span>
                      </div>
                      {c.taste_notes && <div className="text-xs text-orange-500 mb-1">📝 {c.taste_notes}</div>}
                      {c.menu_preference && <div className="text-xs text-gray-400 mb-1">🍱 Prefers: {c.menu_preference}</div>}
                      {c.total_portions > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>{c.used_portions} used</span>
                            <span className={remaining <= 3 ? 'text-red-500 font-medium' : 'text-gray-400'}>{remaining} left</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 80 ? '#ef4444' : meta.color }} />
                          </div>
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
