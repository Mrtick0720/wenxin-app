'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { todayLocalStr, addDays } from '@/lib/dateUtils'
import Link from 'next/link'
import DatePicker from '../components/DatePicker'

type PurchaseItem = {
  id: number
  date: string
  name: string
  category: string
  unit: string
  quantity: number
  unit_price: number
  total_price: number
  supplier: string
  note: string
  status: 'pending' | 'ordered' | 'receiving' | 'received'
  ordered_at: string | null
  received_at: string | null
  received_by: string | null
  actual_unit_price: number | null
  actual_total_price: number | null
}

type StatusTab = 'pending' | 'ordered' | 'receiving' | 'received'

const STATUS_TABS: { key: StatusTab; label: string; color: string; bg: string }[] = [
  { key: 'pending',   label: '待采购', color: '#f97316', bg: '#fff7ed' },
  { key: 'ordered',   label: '已下单', color: '#3b82f6', bg: '#eff6ff' },
  { key: 'receiving', label: '待验收', color: '#8b5cf6', bg: '#f5f3ff' },
  { key: 'received',  label: '已收货', color: '#22c55e', bg: '#f0fdf4' },
]

const CATEGORIES = ['肉类', '海鲜', '蔬菜', '调料', '主食', '耗材', '其他']
const UNITS = ['kg', 'g', '个', '包', '箱', '瓶', '袋', '条', '份']

const STATUS_NEXT: Record<StatusTab, StatusTab | null> = {
  pending: 'ordered',
  ordered: 'receiving',
  receiving: 'received',
  received: null,
}

const STATUS_NEXT_LABEL: Record<StatusTab, string> = {
  pending: '标记已下单',
  ordered: '确认待验收',
  receiving: '确认收货',
  received: '',
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[d.getMonth()]} ${d.getDate()} ${weekdays[d.getDay()]}`
}

function fmtAmt(n: number | null | undefined) {
  if (n == null) return '—'
  return `RM ${Number(n).toFixed(2)}`
}

const emptyForm = {
  name: '', category: '蔬菜', unit: 'kg',
  quantity: '', unit_price: '', supplier: '', note: '',
}

export default function PurchaseClient({
  initialItems, initialDate,
}: {
  initialItems: PurchaseItem[]
  initialDate: string
}) {
  const today = todayLocalStr()
  const [items, setItems] = useState(initialItems)
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [activeTab, setActiveTab] = useState<StatusTab>('pending')
  const [fetching, setFetching] = useState(false)
  const [loading, setLoading] = useState<number | null>(null)
  const cache = useRef<Record<string, PurchaseItem[]>>({ [initialDate]: initialItems })

  // Add panel
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  // Receive confirm panel
  const [confirmItem, setConfirmItem] = useState<PurchaseItem | null>(null)
  const [actualPrice, setActualPrice] = useState('')
  const [receivedBy, setReceivedBy] = useState('')
  const [confirming, setConfirming] = useState(false)

  const fetchDate = useCallback(async (date: string): Promise<PurchaseItem[]> => {
    const { data } = await supabase
      .from('purchase_items')
      .select('*')
      .eq('date', date)
      .order('id', { ascending: true })
    const result = (data || []) as PurchaseItem[]
    cache.current[date] = result
    return result
  }, [])

  async function handleDateChange(date: string) {
    setSelectedDate(date)
    if (cache.current[date] !== undefined) {
      setItems(cache.current[date])
    } else {
      setFetching(true)
      setItems(await fetchDate(date))
      setFetching(false)
    }
  }

  const filtered = items.filter(i => i.status === activeTab)

  // Stats
  const totalAmount = items
    .filter(i => i.status === 'received')
    .reduce((s, i) => s + (i.actual_total_price ?? i.total_price ?? 0), 0)
  const pendingAmt = items
    .filter(i => i.status !== 'received')
    .reduce((s, i) => s + (i.total_price ?? 0), 0)
  const counts = {
    pending: items.filter(i => i.status === 'pending').length,
    ordered: items.filter(i => i.status === 'ordered').length,
    receiving: items.filter(i => i.status === 'receiving').length,
    received: items.filter(i => i.status === 'received').length,
  }

  async function advanceStatus(item: PurchaseItem) {
    const next = STATUS_NEXT[item.status]
    if (!next) return
    if (next === 'received') {
      // Open confirm panel instead
      setConfirmItem(item)
      setActualPrice(item.unit_price ? String(item.unit_price) : '')
      setReceivedBy('')
      return
    }
    setLoading(item.id)
    const update: Partial<PurchaseItem> = { status: next }
    if (next === 'ordered') update.ordered_at = new Date().toISOString()
    await supabase.from('purchase_items').update(update).eq('id', item.id)
    const updated = items.map(i => i.id === item.id ? { ...i, ...update } : i)
    setItems(updated)
    cache.current[selectedDate] = updated
    setLoading(null)
  }

  async function confirmReceive() {
    if (!confirmItem) return
    setConfirming(true)
    const qty = confirmItem.quantity ?? 0
    const ap = parseFloat(actualPrice) || (confirmItem.unit_price ?? 0)
    const update = {
      status: 'received' as StatusTab,
      received_at: new Date().toISOString(),
      received_by: receivedBy || null,
      actual_unit_price: ap,
      actual_total_price: ap * qty,
    }
    await supabase.from('purchase_items').update(update).eq('id', confirmItem.id)
    const updated = items.map(i => i.id === confirmItem.id ? { ...i, ...update } : i)
    setItems(updated)
    cache.current[selectedDate] = updated
    setConfirming(false)
    setConfirmItem(null)
  }

  async function handleAdd() {
    if (!form.name.trim()) return
    setSaving(true)
    const qty = parseFloat(form.quantity) || 0
    const up = parseFloat(form.unit_price) || 0
    const row = {
      date: selectedDate,
      name: form.name.trim(),
      category: form.category,
      unit: form.unit,
      quantity: qty,
      unit_price: up,
      total_price: qty * up,
      supplier: form.supplier.trim() || null,
      note: form.note.trim() || null,
      status: 'pending',
    }
    const { data } = await supabase.from('purchase_items').insert(row).select().single()
    if (data) {
      const updated = [...items, data as PurchaseItem]
      setItems(updated)
      cache.current[selectedDate] = updated
    }
    setForm(emptyForm)
    setSaving(false)
    setShowAdd(false)
    setActiveTab('pending')
  }

  async function deleteItem(item: PurchaseItem) {
    if (!confirm(`删除「${item.name}」？`)) return
    await supabase.from('purchase_items').delete().eq('id', item.id)
    const updated = items.filter(i => i.id !== item.id)
    setItems(updated)
    cache.current[selectedDate] = updated
  }

  const isToday = selectedDate === today

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>

      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-500 text-xl">←</Link>
          <span className="font-semibold text-base tracking-wide">Purchase</span>
        </div>
        <button
          onClick={() => { setShowAdd(true); setForm(emptyForm) }}
          className="bg-orange-500 text-white text-sm px-3 py-1.5 rounded-full"
        >
          + 新增
        </button>
      </div>

      {/* DatePicker */}
      <div className="bg-white px-4 pt-4 pb-3 border-b" style={{ flexShrink: 0 }}>
        <DatePicker selectedDate={selectedDate} onDateChange={handleDateChange} />
      </div>

      {/* Stats */}
      <div className="bg-white px-4 py-3 border-b" style={{ flexShrink: 0 }}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-xs text-gray-400">{formatDate(selectedDate)} 采购</div>
            <div className="text-2xl font-bold text-gray-900 mt-0.5">
              {fmtAmt(totalAmount + pendingAmt)}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              已收 {fmtAmt(totalAmount)} · 待付 {fmtAmt(pendingAmt)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right">
            {STATUS_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className="text-xs"
                style={{ color: counts[t.key] > 0 ? t.color : '#9ca3af' }}
              >
                <span className="font-bold text-sm">{counts[t.key]}</span>
                <span className="ml-1">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="bg-white border-b flex" style={{ flexShrink: 0 }}>
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className="flex-1 py-2.5 text-sm font-medium relative"
            style={{ color: activeTab === t.key ? t.color : '#9ca3af' }}
          >
            {t.label}
            {counts[t.key] > 0 && (
              <span
                className="ml-1 text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: t.bg, color: t.color }}
              >
                {counts[t.key]}
              </span>
            )}
            {activeTab === t.key && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ background: t.color }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Item List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-8">
        {fetching && <div className="text-center text-gray-400 py-8">加载中...</div>}
        {!fetching && filtered.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            <div className="text-4xl mb-3">
              {activeTab === 'pending' ? '🛒' : activeTab === 'ordered' ? '📋' : activeTab === 'receiving' ? '📦' : '✅'}
            </div>
            <div className="text-sm">暂无{STATUS_TABS.find(t => t.key === activeTab)?.label}项目</div>
          </div>
        )}
        {!fetching && filtered.map(item => {
          const tab = STATUS_TABS.find(t => t.key === item.status)!
          const next = STATUS_NEXT[item.status]
          return (
            <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{item.name}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: tab.bg, color: tab.color }}
                    >
                      {tab.label}
                    </span>
                    {item.category && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {item.category}
                      </span>
                    )}
                  </div>
                </div>
                {item.status === 'pending' && (
                  <button
                    onClick={() => deleteItem(item)}
                    className="text-gray-300 text-lg leading-none px-1"
                  >×</button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600 mb-3">
                <div>
                  <span className="text-gray-400 text-xs">数量</span>
                  <div className="font-medium">{item.quantity} {item.unit}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">单价</span>
                  <div className="font-medium">{fmtAmt(item.unit_price)}/{item.unit}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">预计总价</span>
                  <div className="font-medium">{fmtAmt(item.total_price)}</div>
                </div>
                {item.status === 'received' && (
                  <div>
                    <span className="text-gray-400 text-xs">实际总价</span>
                    <div className="font-medium text-green-600">{fmtAmt(item.actual_total_price)}</div>
                  </div>
                )}
              </div>

              {item.supplier && (
                <div className="text-xs text-gray-400 mb-1">🏪 {item.supplier}</div>
              )}
              {item.note && (
                <div className="text-xs text-orange-500 mb-1">📝 {item.note}</div>
              )}
              {item.status === 'received' && item.received_at && (
                <div className="text-xs text-gray-400 mb-1">
                  ✅ {new Date(item.received_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {item.received_by && ` · ${item.received_by}`}
                </div>
              )}

              {next && isToday && (
                <button
                  onClick={() => advanceStatus(item)}
                  disabled={loading === item.id}
                  className="mt-2 w-full py-2 rounded-xl text-sm font-medium"
                  style={{
                    background: tab.bg,
                    color: tab.color,
                    opacity: loading === item.id ? 0.6 : 1,
                  }}
                >
                  {loading === item.id ? '更新中...' : STATUS_NEXT_LABEL[item.status]}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Add Panel */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowAdd(false)}
        >
          <div
            className="bg-white rounded-t-3xl px-4 pt-5 pb-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-base">添加采购项目</span>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 text-lg">×</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">物品名称 *</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                  placeholder="如：鸡腿肉"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">类别</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400 bg-white"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">单位</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400 bg-white"
                    value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">数量</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                    placeholder="0"
                    type="number"
                    inputMode="decimal"
                    value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">单价 (RM)</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                    placeholder="0.00"
                    type="number"
                    inputMode="decimal"
                    value={form.unit_price}
                    onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                  />
                </div>
              </div>

              {form.quantity && form.unit_price && (
                <div className="text-xs text-gray-500 text-right">
                  预计总价：RM {(parseFloat(form.quantity) * parseFloat(form.unit_price) || 0).toFixed(2)}
                </div>
              )}

              <div>
                <label className="text-xs text-gray-400 mb-1 block">供应商</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                  placeholder="如：KK Meat Supply"
                  value={form.supplier}
                  onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">备注</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                  placeholder="如：Bento 用"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                />
              </div>

              <button
                onClick={handleAdd}
                disabled={saving || !form.name.trim()}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-white mt-1"
                style={{ background: form.name.trim() ? '#f97316' : '#d1d5db' }}
              >
                {saving ? '保存中...' : '添加到待采购'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Confirm Panel */}
      {confirmItem && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setConfirmItem(null)}
        >
          <div
            className="bg-white rounded-t-3xl px-4 pt-5 pb-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-base">确认收货</span>
              <button onClick={() => setConfirmItem(null)} className="text-gray-400 text-lg">×</button>
            </div>

            <div className="bg-gray-50 rounded-2xl p-3 mb-4 text-sm">
              <div className="font-medium text-gray-900 mb-1">{confirmItem.name}</div>
              <div className="text-gray-500">
                预计：{confirmItem.quantity} {confirmItem.unit} × RM {confirmItem.unit_price} = {fmtAmt(confirmItem.total_price)}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">实际单价 (RM/{confirmItem.unit})</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-400"
                  type="number"
                  inputMode="decimal"
                  value={actualPrice}
                  onChange={e => setActualPrice(e.target.value)}
                />
                {actualPrice && (
                  <div className="text-xs text-gray-400 mt-1 text-right">
                    实际总价：RM {((parseFloat(actualPrice) || 0) * (confirmItem.quantity || 0)).toFixed(2)}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">收货人</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-400"
                  placeholder="可选"
                  value={receivedBy}
                  onChange={e => setReceivedBy(e.target.value)}
                />
              </div>

              <button
                onClick={confirmReceive}
                disabled={confirming}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-white"
                style={{ background: '#22c55e' }}
              >
                {confirming ? '确认中...' : '✓ 确认收货'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
