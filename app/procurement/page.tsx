'use client'

import { useState } from 'react'
import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'

// Placeholder data — will be replaced with Supabase `procurement_items` table
type Item = {
  id: number
  name: string
  category: string
  quantity: string
  unit: string
  status: 'pending' | 'ordered' | 'received'
  supplier?: string
  note?: string
}

const initialItems: Item[] = [
  // Food Ingredients
  { id: 1, name: 'Bok Choy', category: 'ingredients', quantity: '5', unit: 'kg', status: 'pending', supplier: 'Likas Market', note: 'For daily stir-fry' },
  { id: 2, name: 'Chicken Thigh', category: 'ingredients', quantity: '10', unit: 'kg', status: 'ordered', supplier: 'KK Meat Supply' },
  { id: 3, name: 'White Pomfret', category: 'ingredients', quantity: '3', unit: 'kg', status: 'pending', supplier: 'Fish Market KK' },
  { id: 4, name: 'Soy Sauce (Light)', category: 'ingredients', quantity: '2', unit: 'bottles', status: 'pending', supplier: 'Tong Hing' },
  { id: 5, name: 'Pork Ribs', category: 'ingredients', quantity: '8', unit: 'kg', status: 'received', supplier: 'KK Meat Supply' },
  // Supplies
  { id: 6, name: 'Takeaway Box (Large)', category: 'supplies', quantity: '100', unit: 'pcs', status: 'pending', supplier: 'PackIt KK' },
  { id: 7, name: 'Bleach', category: 'supplies', quantity: '2', unit: 'bottles', status: 'pending' },
  { id: 8, name: 'Trash Bags (XL)', category: 'supplies', quantity: '3', unit: 'rolls', status: 'ordered', supplier: 'PackIt KK' },
  { id: 9, name: 'Napkins', category: 'supplies', quantity: '10', unit: 'packs', status: 'pending' },
  { id: 10, name: 'Dish Soap', category: 'supplies', quantity: '1', unit: 'bottle', status: 'pending' },
]

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-orange-100 text-orange-600' },
  ordered: { label: 'Ordered', color: 'bg-blue-100 text-blue-600' },
  received: { label: 'Received', color: 'bg-green-100 text-green-600' },
}

export default function ProcurementPage() {
  const [items, setItems] = useState(initialItems)
  const [activeTab, setActiveTab] = useState<'ingredients' | 'supplies'>('ingredients')

  function toggleStatus(id: number) {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const next: Record<string, Item['status']> = {
        pending: 'ordered',
        ordered: 'received',
        received: 'pending',
      }
      return { ...item, status: next[item.status] }
    }))
  }

  const filtered = items.filter(i => i.category === activeTab)
  const ingredients = items.filter(i => i.category === 'ingredients')
  const supplies = items.filter(i => i.category === 'supplies')
  const pendingTotal = items.filter(i => i.status === 'pending').length

  return (
    <PageTransition>
    <main className="bg-gray-50 w-full mx-auto">
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <BackButton href="/" />
          <span className="font-semibold text-base">Procurement</span>
        </div>
        <span className="text-xs text-orange-500 font-medium">{pendingTotal} pending</span>
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        {/* Summary */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500 mb-3">Overview</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center bg-orange-50 rounded-xl py-3">
              <div className="text-xl font-bold text-orange-500">{ingredients.filter(i => i.status === 'pending').length}</div>
              <div className="text-xs text-gray-400 mt-0.5">Ingredients Pending</div>
            </div>
            <div className="text-center bg-blue-50 rounded-xl py-3">
              <div className="text-xl font-bold text-blue-500">{supplies.filter(i => i.status === 'pending').length}</div>
              <div className="text-xs text-gray-400 mt-0.5">Supplies Pending</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('ingredients')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'ingredients' ? 'bg-orange-500 text-white' : 'text-gray-500'
            }`}
          >
            🥬 Food Ingredients
          </button>
          <button
            onClick={() => setActiveTab('supplies')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'supplies' ? 'bg-orange-500 text-white' : 'text-gray-500'
            }`}
          >
            📦 Supplies
          </button>
        </div>

        {/* Item List */}
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">
            {activeTab === 'ingredients' ? 'Food Ingredients' : 'Supplies'}
            <span className="text-gray-400 font-normal ml-1">({filtered.length})</span>
          </div>
          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="text-center text-gray-400 py-8">No items</div>
            )}
            {filtered.map((item) => {
              const status = statusConfig[item.status] || statusConfig.pending
              return (
                <button
                  key={item.id}
                  onClick={() => toggleStatus(item.id)}
                  className="w-full text-left bg-white rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900 text-sm">{item.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{item.quantity} {item.unit}</span>
                    {item.supplier && <span>· {item.supplier}</span>}
                  </div>
                  {item.note && (
                    <div className="mt-1.5 text-xs text-gray-400">{item.note}</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="bg-blue-50 rounded-2xl p-4">
          <div className="text-xs text-blue-500">Tap an item to cycle status: Pending → Ordered → Received. Data is currently placeholder — Supabase integration coming soon.</div>
        </div>
      </div>
    </main>
    </PageTransition>
  )
}
