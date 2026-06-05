'use client'

import { useState } from 'react'
import Link from 'next/link'

type InventoryItem = {
  id: number
  name: string
  category: string
  stock: number
  unit: string
  threshold: number
  status: 'ok' | 'low' | 'out'
}

const initialItems: InventoryItem[] = [
  // Food
  { id: 1, name: 'Bok Choy', category: 'food', stock: 3, unit: 'kg', threshold: 5, status: 'low' },
  { id: 2, name: 'Chicken Thigh', category: 'food', stock: 12, unit: 'kg', threshold: 5, status: 'ok' },
  { id: 3, name: 'White Rice', category: 'food', stock: 25, unit: 'kg', threshold: 10, status: 'ok' },
  { id: 4, name: 'Cooking Oil', category: 'food', stock: 2, unit: 'bottles', threshold: 3, status: 'low' },
  { id: 5, name: 'Soy Sauce', category: 'food', stock: 0, unit: 'bottles', threshold: 2, status: 'out' },
  { id: 6, name: 'Pork Ribs', category: 'food', stock: 6, unit: 'kg', threshold: 4, status: 'ok' },
  // Supplies
  { id: 7, name: 'Takeaway Box (L)', category: 'supplies', stock: 45, unit: 'pcs', threshold: 50, status: 'low' },
  { id: 8, name: 'Napkins', category: 'supplies', stock: 8, unit: 'packs', threshold: 5, status: 'ok' },
  { id: 9, name: 'Trash Bags', category: 'supplies', stock: 1, unit: 'rolls', threshold: 3, status: 'low' },
  { id: 10, name: 'Dish Soap', category: 'supplies', stock: 4, unit: 'bottles', threshold: 2, status: 'ok' },
]

const statusConfig: Record<string, { label: string; color: string }> = {
  ok: { label: 'OK', color: 'bg-green-100 text-green-600' },
  low: { label: 'Low', color: 'bg-orange-100 text-orange-600' },
  out: { label: 'Out', color: 'bg-red-100 text-red-600' },
}

export default function InventoryPage() {
  const [items] = useState(initialItems)
  const [activeTab, setActiveTab] = useState<'food' | 'supplies'>('food')

  const filtered = items.filter(i => i.category === activeTab)
  const lowCount = items.filter(i => i.status !== 'ok').length

  return (
    <main className="min-h-screen bg-gray-50 w-full mx-auto">
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center text-gray-500"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></Link>
          <span className="font-semibold text-base">Inventory</span>
        </div>
        <span className="text-xs text-orange-500 font-medium">{lowCount} items low</span>
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500 mb-3">Stock Overview</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{items.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">Total Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{items.filter(i => i.status === 'low').length}</div>
              <div className="text-xs text-gray-400 mt-0.5">Low Stock</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{items.filter(i => i.status === 'out').length}</div>
              <div className="text-xs text-gray-400 mt-0.5">Out of Stock</div>
            </div>
          </div>
        </div>

        <div className="flex bg-white rounded-2xl p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('food')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'food' ? 'bg-orange-500 text-white' : 'text-gray-500'
            }`}
          >
            🥬 Food
          </button>
          <button
            onClick={() => setActiveTab('supplies')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'supplies' ? 'bg-orange-500 text-white' : 'text-gray-500'
            }`}
          >
            📦 Supplies
          </button>
        </div>

        <div className="space-y-2">
          {filtered.map((item) => {
            const status = statusConfig[item.status] || statusConfig.ok
            return (
              <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{item.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Stock: {item.stock} {item.unit} · Min: {item.threshold} {item.unit}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ml-3 flex-shrink-0 ${status.color}`}>
                  {status.label}
                </span>
              </div>
            )
          })}
        </div>

        <div className="bg-blue-50 rounded-2xl p-4">
          <div className="text-xs text-blue-500">Inventory data is currently using sample data. Real data will appear after Supabase integration.</div>
        </div>
      </div>
    </main>
  )
}
