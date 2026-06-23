'use client'

import { useState, useEffect } from 'react'
import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'
import { supabase } from '@/lib/supabase/client'
import { FullPageSpinner } from '../components/Spinner'

type Supplier = { name: string; purchases: number; total: number; lastDate: string }

type Row = { supplier: string | null; total_price: number | null; date: string | null }

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('purchase_items')
      .select('supplier, total_price, date')
      .then(({ data }) => {
        const map: Record<string, Supplier> = {}
        for (const row of (data || []) as Row[]) {
          const name = (row.supplier || '').trim()
          if (!name) continue
          if (!map[name]) map[name] = { name, purchases: 0, total: 0, lastDate: '' }
          map[name].purchases += 1
          map[name].total += row.total_price ?? 0
          if ((row.date || '') > map[name].lastDate) map[name].lastDate = row.date || ''
        }
        setSuppliers(Object.values(map).sort((a, b) => b.total - a.total))
        setLoading(false)
      })
  }, [])

  if (loading) return <FullPageSpinner />

  return (
    <PageTransition>
      <main className="bg-gray-50 w-full mx-auto min-h-screen">
        <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <BackButton href="/" />
            <span className="font-semibold text-base">Suppliers</span>
          </div>
          {!loading && <span className="text-xs text-gray-400">{suppliers.length} suppliers</span>}
        </div>

        <div className="px-4 py-4 pb-8 space-y-3">
          {suppliers.length === 0 && (
            <div className="text-center text-gray-400 py-10 px-6 text-sm">
              No suppliers yet. Suppliers appear here automatically once you record purchases with a supplier name.
            </div>
          )}

          {suppliers.map((s) => (
            <div key={s.name} className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 text-sm truncate">{s.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {s.purchases} purchase{s.purchases === 1 ? '' : 's'} · last {s.lastDate || '—'}
                </div>
              </div>
              <div className="text-sm font-bold text-gray-700 flex-shrink-0 ml-3">
                RM {Math.round(s.total).toLocaleString()}
              </div>
            </div>
          ))}

          {!loading && suppliers.length > 0 && (
            <div className="text-[11px] text-gray-400 px-1 pt-1">
              Derived from purchase records. Total = recorded spend per supplier.
            </div>
          )}
        </div>
      </main>
    </PageTransition>
  )
}
