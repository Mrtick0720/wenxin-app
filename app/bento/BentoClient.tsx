'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import DatePicker from '../components/DatePicker'

type Order = {
  id: number
  customer_name: string
  phone: string
  address: string
  area: string
  menu_type: string
  items: string
  note: string
  amount: number
  paid: boolean
  status: string
  date: string
  time_slot?: string
}

const AREAS = ['全部', 'Likas', 'Luyang', 'Lintas']
const MENU_TYPES = ['全部', '清单', '风味', '素食']
const TIME_SLOTS = ['全部', '午餐', '晚餐']

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekday}`
}

export default function BentoClient({ initialOrders }: { initialOrders: Order[] }) {
  const today = new Date().toISOString().split('T')[0]
  const [orders, setOrders] = useState(initialOrders)
  const [loading, setLoading] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState(today)
  const [filterArea, setFilterArea] = useState('全部')
  const [filterType, setFilterType] = useState('全部')
  const [filterTime, setFilterTime] = useState('全部')
  const [fetching, setFetching] = useState(false)

  const isToday = selectedDate === today
  const headerTitle = isToday ? 'Bento 今日进度' : `Bento ${formatDate(selectedDate)}`

  const loadOrders = useCallback(async (date: string) => {
    setFetching(true)
    const { data } = await supabase
      .from('bento_orders')
      .select('*')
      .eq('date', date)
      .order('id', { ascending: true })
    setOrders(data || [])
    setFetching(false)
  }, [])

  async function handleDateChange(date: string) {
    setSelectedDate(date)
    await loadOrders(date)
  }

  async function toggleStatus(order: Order) {
    const newStatus = order.status === 'completed' ? 'pending' : 'completed'
    setLoading(order.id)
    await supabase.from('bento_orders').update({ status: newStatus }).eq('id', order.id)
    setOrders(orders.map(o => o.id === order.id ? { ...o, status: newStatus } : o))
    setLoading(null)
  }

  async function togglePaid(order: Order) {
    const newPaid = !order.paid
    setLoading(order.id)
    await supabase.from('bento_orders').update({ paid: newPaid }).eq('id', order.id)
    setOrders(orders.map(o => o.id === order.id ? { ...o, paid: newPaid } : o))
    setLoading(null)
  }

  const filtered = orders.filter(o => {
    const areaMatch = filterArea === '全部' || o.area === filterArea
    const typeMatch = filterType === '全部' || o.menu_type === filterType
    const timeMatch = filterTime === '全部' || o.time_slot === filterTime
    return areaMatch && typeMatch && timeMatch
  })

  const total = orders.length
  const completed = orders.filter(o => o.status === 'completed').length
  const pending = orders.filter(o => o.status === 'pending').length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <>
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-500 text-xl">←</Link>
          <span className="font-semibold text-base">{headerTitle}</span>
        </div>
        <Link href="/bento/new" className="bg-orange-500 text-white text-sm px-3 py-1.5 rounded-full">
          + 新增
        </Link>
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        {/* 概况卡片 + 日期选择 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <DatePicker selectedDate={selectedDate} onDateChange={handleDateChange} />
          <div className="border-t border-gray-100 mt-3 pt-3">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{total}</div>
                <div className="text-xs text-gray-400 mt-0.5">总订单</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{completed}</div>
                <div className="text-xs text-gray-400 mt-0.5">已完成</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">{pending}</div>
                <div className="text-xs text-gray-400 mt-0.5">待处理</div>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="text-xs text-gray-400 mt-1 text-right">完成 {percent}%</div>
          </div>
        </div>

        {/* 快速入口 */}
        <div className="flex gap-2">
          <Link href="/bento/unpaid" className="flex-1 bg-white rounded-xl p-3 shadow-sm flex items-center gap-2 border border-gray-100">
            <span className="text-xl">💰</span>
            <div>
              <div className="text-xs font-medium text-gray-700">未付款</div>
              <div className="text-xs text-gray-400">后付费客户</div>
            </div>
          </Link>
          <Link href="/bento/weekly-menu" className="flex-1 bg-white rounded-xl p-3 shadow-sm flex items-center gap-2 border border-gray-100">
            <span className="text-xl">📋</span>
            <div>
              <div className="text-xs font-medium text-gray-700">周菜单</div>
              <div className="text-xs text-gray-400">本周菜品</div>
            </div>
          </Link>
        </div>

        {/* 筛选 - 下拉 */}
        <div className="flex gap-2">
          <select
            value={filterArea}
            onChange={e => setFilterArea(e.target.value)}
            className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 outline-none"
          >
            {AREAS.map(a => <option key={a} value={a}>{a === '全部' ? '全部地区' : a}</option>)}
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 outline-none"
          >
            {MENU_TYPES.map(t => <option key={t} value={t}>{t === '全部' ? '全部类型' : t}</option>)}
          </select>
          <select
            value={filterTime}
            onChange={e => setFilterTime(e.target.value)}
            className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 outline-none"
          >
            {TIME_SLOTS.map(t => <option key={t} value={t}>{t === '全部' ? '全时段' : t}</option>)}
          </select>
        </div>

        {/* 订单列表 */}
        <div className="text-sm font-semibold text-gray-700">
          订单列表 {filtered.length > 0 && <span className="text-gray-400 font-normal">({filtered.length} 单)</span>}
        </div>

        {fetching && <div className="text-center text-gray-400 py-4">加载中...</div>}

        <div className="space-y-3">
          {!fetching && filtered.length === 0 && (
            <div className="text-center text-gray-400 py-8">暂无订单</div>
          )}
          {!fetching && filtered.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{order.customer_name}</span>
                  {order.menu_type && (
                    <span className="text-xs bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full">{order.menu_type}</span>
                  )}
                </div>
                <button
                  onClick={() => togglePaid(order)}
                  disabled={loading === order.id}
                  className={`text-xs px-2 py-1 rounded-full border ${
                    order.paid
                      ? 'bg-green-100 text-green-600 border-green-200'
                      : 'bg-red-50 text-red-500 border-red-200'
                  }`}
                >
                  {order.paid ? '✓ 已付款' : '未付款'}
                </button>
              </div>
              {order.area && <div className="text-xs text-gray-400 mb-1">📍 {order.area}</div>}
              <div className="text-sm text-gray-600 mb-1">📦 {order.items}</div>
              {order.note && <div className="text-sm text-orange-500 mb-1">📝 {order.note}</div>}
              <div className="text-sm text-gray-400 mb-1">{order.address}</div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-400">📞 {order.phone}</span>
                <span className="font-semibold text-gray-900">RM {order.amount}</span>
              </div>
              {isToday && (
                <button
                  onClick={() => toggleStatus(order)}
                  disabled={loading === order.id}
                  className={`mt-3 w-full py-2 rounded-xl text-sm font-medium ${
                    order.status === 'completed'
                      ? 'bg-gray-100 text-gray-500'
                      : 'bg-orange-500 text-white'
                  }`}
                >
                  {loading === order.id ? '更新中...' : order.status === 'completed' ? '✓ 已完成' : '标记完成'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
