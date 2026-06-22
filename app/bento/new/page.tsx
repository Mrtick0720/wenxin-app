'use client'

import { useState, useEffect, useRef } from 'react'
import BackButton from '../../components/BackButton'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const AREAS = ['Likas', 'Luyang', 'Lintas', 'Karamunsing']

const PAYMENT_STATUSES = [
  { value: 'unpaid',  label: 'Unpaid' },
  { value: 'paid',    label: 'Paid' },
  { value: 'partial', label: 'Partial' },
]

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'qr',            label: 'QR' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other',         label: 'Other' },
]

type OrderItem = { variant: string; quantity: number }
type Component = { id: number; name: string; description: string | null; is_active: boolean }
type CustomItem = { protein_id: number | null; vegetable_id: number | null; staple_id: number | null; qty: number }

type CustomerOpt = {
  id: number
  name: string
  phone: string | null
  total_portions: number
  used_portions: number
  active: boolean
  package_mode?: string
}
const isMemberOpt = (c: CustomerOpt) => c.active && c.total_portions > 0 && c.package_mode !== 'postpaid'
const isPostpaidOpt = (c: CustomerOpt) => c.package_mode === 'postpaid'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// day_of_week convention: Monday = 0 … Sunday = 6 (matches weekly-menu page).
function dowFromDate(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  return (d.getDay() + 6) % 7
}

const INPUT = 'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400'
const INPUT_SM = 'w-full min-w-0 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400'

export default function NewBentoOrder() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    customer_name:    '',
    phone:            '',
    fulfillment_type: 'delivery',
    delivery_date:    todayStr(),
    order_time:       '',
    area:             '',
    address:          '',
    // Custom (no weekly plan) bento compartments
    ready_by:         '',
    unit_price:       '',
    note:             '',
    // Payment
    payment_status:   'unpaid',
    payment_method:   '',
    amount_paid:      '0',
    payment_note:     '',
  })

  // Customer combobox — pick a member (deducts package) or free-type a walk-in.
  const [customers, setCustomers] = useState<CustomerOpt[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOpt | null>(null)
  const [custOpen, setCustOpen] = useState(false)
  const [deductPackage, setDeductPackage] = useState(true)
  const custRef = useRef<HTMLDivElement>(null)

  // Close the customer dropdown when tapping anywhere outside it.
  useEffect(() => {
    if (!custOpen) return
    function onDown(e: MouseEvent | TouchEvent) {
      if (custRef.current && !custRef.current.contains(e.target as Node)) setCustOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [custOpen])

  useEffect(() => {
    supabase.from('bento_customers')
      .select('id, name, phone, total_portions, used_portions, active, package_mode')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setCustomers((data ?? []) as CustomerOpt[]))
  }, [])

  // Components
  const [proteins, setProteins] = useState<Component[]>([])
  const [vegetables, setVegetables] = useState<Component[]>([])
  const [staples, setStaples] = useState<Component[]>([])

  // Order items
  const [orderItems, setOrderItems] = useState<OrderItem[]>([{ variant: '', quantity: 1 }])
  const [customItems, setCustomItems] = useState<CustomItem[]>([])
  const [areaOpen, setAreaOpen] = useState(false)

  const isDelivery = form.fulfillment_type === 'delivery'

  // Load component lists
  useEffect(() => {
    Promise.all([
      supabase.from('bento_proteins').select('id,name,description,is_active').eq('is_active', true).order('name'),
      supabase.from('bento_vegetables').select('id,name,description,is_active').eq('is_active', true).order('name'),
      supabase.from('bento_staples').select('id,name,description,is_active').eq('is_active', true).order('name'),
    ]).then(([p, v, s]) => {
      setProteins((p.data || []) as Component[])
      setVegetables((v.data || []) as Component[])
      setStaples((s.data || []) as Component[])
    })
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handlePaymentStatus(status: string) {
    setForm(prev => ({
      ...prev,
      payment_status: status,
      amount_paid:
        status === 'paid'   ? String(total || 0) :
        status === 'unpaid' ? '0' :
        prev.amount_paid,
    }))
  }

  function addItem() { setOrderItems(prev => [...prev, { variant: '', quantity: 1 }]) }
  function removeItem(idx: number) { setOrderItems(prev => prev.filter((_, i) => i !== idx)) }
  function setItemVariant(idx: number, variant: string) {
    setOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, variant } : it))
  }
  function adjustQty(idx: number, delta: number) {
    setOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it))
  }

  function addCustom() { setCustomItems(prev => [...prev, { protein_id: null, vegetable_id: null, staple_id: null, qty: 1 }]) }
  function removeCustom(idx: number) { setCustomItems(prev => prev.filter((_, i) => i !== idx)) }
  function setCustomField(idx: number, field: keyof CustomItem, value: number | null) {
    setCustomItems(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c))
  }
  function adjustCustomQty(idx: number, delta: number) {
    setCustomItems(prev => prev.map((c, i) => i === idx ? { ...c, qty: Math.max(1, c.qty + delta) } : c))
  }

  const totalQty = orderItems.filter(i => i.variant).reduce((s, i) => s + i.quantity, 0) + customItems.reduce((s, c) => s + c.qty, 0)
  const unitPrice = parseFloat(form.unit_price) || 0
  const total = unitPrice * totalQty

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customer_name.trim()) { setError('Customer name is required.'); return }
    if (!form.unit_price || unitPrice <= 0) { setError('Unit price is required.'); return }

    const activeOrderItems = orderItems.filter(i => i.variant)
    const activeCustomItems = customItems.filter(c => c.protein_id || c.vegetable_id || c.staple_id)
    if (activeOrderItems.length === 0 && activeCustomItems.length === 0) {
      setError('Please add at least one menu item.'); return
    }

    // Build items text from both variant and custom items
    const parts: string[] = []

    // Variant items
    for (const item of activeOrderItems) {
      parts.push(`${item.variant === 'light' ? 'Light' : 'Flavorful'} x${item.quantity}`)
    }

    // Custom items
    for (const c of activeCustomItems) {
      const protein = proteins.find(p => p.id === c.protein_id)
      const veg = vegetables.find(v => v.id === c.vegetable_id)
      const staple = staples.find(s => s.id === c.staple_id)
      const label = [protein?.description || protein?.name, veg?.description || veg?.name, staple?.description || staple?.name].filter(Boolean).join(' / ') || 'Custom'
      parts.push(`${label} x${c.qty}`)
    }

    const itemsText = parts.join(', ')
    const menuType = activeOrderItems.length > 0 ? activeOrderItems[0].variant : 'custom'

    // Compartments from first custom item (for kitchen view)
    const firstCustom = activeCustomItems[0]
    const firstProtein = firstCustom ? proteins.find(p => p.id === firstCustom.protein_id) : null
    const firstVeg = firstCustom ? vegetables.find(v => v.id === firstCustom.vegetable_id) : null
    const firstStaple = firstCustom ? staples.find(s => s.id === firstCustom.staple_id) : null

    setLoading(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('bento_orders').insert({
        date:                    form.delivery_date,
        customer_name:           form.customer_name.trim(),
        phone:                   form.phone,
        fulfillment_type:        form.fulfillment_type,
        address:                 isDelivery ? (form.address || null) : null,
        area:                    isDelivery ? (form.area || null) : null,
        delivery_or_pickup_time: form.order_time || null,
        menu_type:               menuType,
        items:                   itemsText,
        bento_items:             null,
        compartment_a:           firstProtein?.description || firstProtein?.name || null,
        compartment_b:           firstVeg?.description || firstVeg?.name || null,
        compartment_c:           firstStaple?.description || firstStaple?.name || null,
        ready_by:                form.ready_by || null,
        note:                    form.note,
        amount:                  total,
        quantity:                totalQty,
        paid:                    form.payment_status === 'paid',
        status:                  'pending',
        payment_status:          form.payment_status,
        payment_method:          form.payment_method || null,
        amount_paid:             parseFloat(form.amount_paid) || 0,
        payment_note:            form.payment_note || '',
      })
      if (err) {
        setError(err.message || 'Failed to create order.')
        setLoading(false)
        return
      }
      if (selectedCustomer && isMemberOpt(selectedCustomer) && deductPackage) {
        const nextUsed = Math.min(selectedCustomer.total_portions, selectedCustomer.used_portions + totalQty)
        await supabase.from('bento_customers').update({ used_portions: nextUsed }).eq('id', selectedCustomer.id)
      }
      router.push('/bento')
      router.refresh()
    } catch {
      setError('Network error. Please check your connection.')
      setLoading(false)
    }
  }

  const showPaymentDetails = form.payment_status === 'paid' || form.payment_status === 'partial'
  const timeLabel = isDelivery ? 'Delivery Time' : 'Pickup Time'

  return (
    <div
      className="page-slide-in flex min-h-0 w-full max-w-full flex-col overflow-hidden"
      style={{ position: 'relative', flex: '1 1 0%', minHeight: 0, width: '100%', height: '100dvh', maxHeight: '100dvh', overflowX: 'hidden', overflowY: 'hidden', background: '#f9fafb' }}
    >
      <div className="flex-none bg-white px-4 py-3 flex items-center gap-3 border-b">
        <BackButton href="/bento" />
        <span className="font-semibold text-base">New Bento Order</span>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto px-4 py-4 space-y-4"
        style={{ flex: '1 1 0%', minHeight: 0, width: '100%', maxWidth: '100%', overflowX: 'hidden', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', touchAction: 'pan-y', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}
      >

        {/* ── Customer (member picker + free text) ── */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Customer Name *</label>
          <div className="relative" ref={custRef}>
            <input
              type="text"
              placeholder="Type a name or pick a member…"
              value={form.customer_name}
              onChange={e => {
                setForm(prev => ({ ...prev, customer_name: e.target.value }))
                setSelectedCustomer(null) // typing = walk-in until a member is picked
                setCustOpen(true)
              }}
              onFocus={() => setCustOpen(true)}
              className={`${INPUT} pr-10`}
            />
            {form.customer_name && (
              <button type="button" aria-label="Clear name"
                onClick={() => {
                  setForm(prev => ({ ...prev, customer_name: '' }))
                  setSelectedCustomer(null)
                  setCustOpen(true)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 active:bg-gray-100">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
            {custOpen && (() => {
              const q = form.customer_name.trim().toLowerCase()
              const matches = customers.filter(c => !q || c.name.toLowerCase().includes(q)).slice(0, 8)
              if (matches.length === 0) return null
              return (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden max-h-64 overflow-y-auto">
                  {matches.map(c => {
                    const member = isMemberOpt(c)
                    const postpaid = isPostpaidOpt(c)
                    const remaining = c.total_portions - c.used_portions
                    return (
                      <button key={c.id} type="button"
                        onClick={() => {
                          setForm(prev => ({
                            ...prev,
                            customer_name: c.name,
                            phone: c.phone || prev.phone,
                            payment_status: postpaid ? 'unpaid' : prev.payment_status,
                          }))
                          setSelectedCustomer(c)
                          setDeductPackage(true)
                          setCustOpen(false)
                        }}
                        className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-amber-50 active:bg-amber-50">
                        <span className="flex items-center gap-1.5 min-w-0">
                          {member && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="#EAB308" className="flex-shrink-0">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                          )}
                          {postpaid && <span className="flex-shrink-0">🏢</span>}
                          <span className="truncate text-sm font-semibold" style={{ color: member ? '#B8860B' : '#374151' }}>{c.name}</span>
                        </span>
                        {member && <span className="flex-shrink-0 text-sm font-medium text-gray-500 tabular-nums">{remaining} left</span>}
                        {postpaid && <span className="flex-shrink-0 text-[11px] text-gray-400">Postpaid</span>}
                      </button>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          {/* Member banner + deduct toggle */}
          {selectedCustomer && isMemberOpt(selectedCustomer) && (
            <div className="mt-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: '#B8860B' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#EAB308" className="flex-shrink-0">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  Member · {selectedCustomer.total_portions - selectedCustomer.used_portions} left
                </span>
                <button type="button" onClick={() => setDeductPackage(d => !d)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${deductPackage ? 'text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
                  style={deductPackage ? { background: '#B8860B' } : undefined}>
                  {deductPackage ? 'From package ✓' : 'Extra (paid)'}
                </button>
              </div>
              <div className="text-[11px] mt-1" style={{ color: deductPackage ? '#B8860B' : '#9ca3af' }}>
                {deductPackage
                  ? `Counts as ${totalQty} of this member's package meals.`
                  : 'Extra order — not deducted from the package.'}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">Phone</label>
          <input type="tel" name="phone" placeholder="Example: 0123456789"
            value={form.phone} onChange={handleChange} className={INPUT} />
        </div>

        {/* ── Fulfillment (drives which fields show below) ── */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Fulfillment *</label>
          <div className="flex gap-2">
            {(['delivery', 'pickup'] as const).map(ft => (
              <button key={ft} type="button"
                onClick={() => setForm(prev => ({ ...prev, fulfillment_type: ft }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border capitalize ${
                  form.fulfillment_type === ft
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >{ft}</button>
            ))}
          </div>
        </div>

        {/* ── Date ── */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">{isDelivery ? 'Delivery Date *' : 'Pickup Date *'}</label>
          <input type="date" name="delivery_date"
            value={form.delivery_date} onChange={handleChange} className={INPUT} />
        </div>

        {/* ── Single time (delivery or pickup) ── */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">{timeLabel}</label>
          <input type="time" name="order_time"
            value={form.order_time} onChange={handleChange} className={INPUT} />
        </div>

        {/* ── Delivery-only: Area + Address ── */}
        {isDelivery && (
          <>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Delivery Area</label>
              <div className="relative">
                <button type="button" onClick={() => setAreaOpen(o => !o)}
                  className={`${INPUT} flex items-center justify-between text-left`}>
                  <span className={form.area ? 'text-gray-800' : 'text-gray-400'}>{form.area || 'Select...'}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: areaOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {areaOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                    {AREAS.map(a => (
                      <button key={a} type="button"
                        onClick={() => { setForm(prev => ({ ...prev, area: a })); setAreaOpen(false) }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 active:bg-orange-50"
                        style={{ color: a === form.area ? '#f97316' : '#374151', fontWeight: a === form.area ? 600 : 400 }}>
                        {a}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Delivery Address</label>
              <input type="text" name="address" placeholder="Example: Jalan Gaya 12, KK"
                value={form.address} onChange={handleChange} className={INPUT} />
            </div>
          </>
        )}

        {/* ── Meal selection ── */}
        <div className="pt-2 border-t border-gray-200">
          <label className="text-sm text-gray-600 mb-2 block font-medium">Menu *</label>

          {/* Variant buttons */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Meal plan</span>
            <button type="button" onClick={addItem}
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm leading-none active:opacity-70"
              style={{ background: '#f97316' }} aria-label="Add item">+</button>
          </div>
          <div className="space-y-2 mb-4">
            {orderItems.map((item, idx) => (
              <div key={idx} className="bg-white rounded-xl px-3 pt-2 pb-2.5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Meal #{idx + 1}</span>
                  <button type="button" onClick={() => removeItem(idx)}
                    className="text-gray-300 active:text-red-400 p-0.5 -mr-0.5" aria-label="Remove item">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {[
                    { code: 'light', label: 'Light', color: '#3B82F6' },
                    { code: 'flavorful', label: 'Flavorful', color: '#F97316' },
                  ].map(v => (
                    <button key={v.code} type="button" onClick={() => setItemVariant(idx, v.code)}
                      style={item.variant === v.code ? { background: v.color, borderColor: v.color } : undefined}
                      className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                        item.variant === v.code ? 'text-white' : 'bg-white text-gray-600 border-gray-200'
                      }`}>{v.label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">Qty</span>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => adjustQty(idx, -1)}
                      className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm leading-none active:bg-gray-200">−</button>
                    <span className="text-xs font-semibold w-5 text-center tabular-nums">{item.quantity}</span>
                    <button type="button" onClick={() => adjustQty(idx, 1)}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm leading-none active:opacity-70"
                      style={{ background: '#f97316' }}>+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Custom build */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Custom</span>
            <button type="button" onClick={addCustom}
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm leading-none active:opacity-70"
              style={{ background: '#9ca3af' }} aria-label="Add custom">+</button>
          </div>
          <div className="space-y-2">
            {customItems.map((c, idx) => (
              <div key={idx} className="bg-white rounded-xl px-3 pt-2 pb-2.5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Custom #{idx + 1}</span>
                  <button type="button" onClick={() => removeCustom(idx)}
                    className="text-gray-300 active:text-red-400 p-0.5 -mr-0.5" aria-label="Remove item">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <ComponentSelect label="Protein" items={proteins} value={c.protein_id} onChange={val => setCustomField(idx, 'protein_id', val)} />
                <ComponentSelect label="Vegetable" items={vegetables} value={c.vegetable_id} onChange={val => setCustomField(idx, 'vegetable_id', val)} />
                <ComponentSelect label="Staple" items={staples} value={c.staple_id} onChange={val => setCustomField(idx, 'staple_id', val)} />
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-gray-400">Qty</span>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => adjustCustomQty(idx, -1)}
                      className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm leading-none active:bg-gray-200">−</button>
                    <span className="text-xs font-semibold w-5 text-center tabular-nums">{c.qty}</span>
                    <button type="button" onClick={() => adjustCustomQty(idx, 1)}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm leading-none active:opacity-70"
                      style={{ background: '#f97316' }}>+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Ready by (kitchen) ── */}
        <div style={{ maxWidth: '50%' }}>
          <label className="text-xs text-gray-500 mb-1 block">Ready by (kitchen)</label>
          <input type="time" name="ready_by" value={form.ready_by} onChange={handleChange} className={INPUT_SM} />
        </div>

        {/* ── Pricing: unit price × qty = total ── */}
        <div className="pt-2 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Unit Price (RM) *</label>
              <input type="number" name="unit_price" inputMode="decimal" placeholder="25.50"
                value={form.unit_price} onChange={handleChange} className={INPUT} />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Quantity</label>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600">{totalQty}</div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-500">Total</span>
            <span className="text-lg font-bold text-gray-900">RM {total.toFixed(2)}</span>
          </div>
        </div>

        {/* ── Notes ── */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Notes</label>
          <textarea name="note" placeholder="Example: No spicy, less salt"
            value={form.note} onChange={handleChange} rows={3}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400 resize-none" />
        </div>

        {/* ── Payment ── */}
        <div className="pt-2 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 mt-3">Payment</div>

          <div className="mb-4">
            <label className="text-sm text-gray-600 mb-2 block">Payment Status</label>
            <div className="flex gap-2">
              {PAYMENT_STATUSES.map(s => (
                <button key={s.value} type="button" onClick={() => handlePaymentStatus(s.value)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border ${
                    form.payment_status === s.value
                      ? s.value === 'paid'    ? 'bg-green-500 text-white border-green-500'
                        : s.value === 'partial' ? 'bg-blue-500 text-white border-blue-500'
                        :                         'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >{s.label}</button>
              ))}
            </div>
          </div>

          {showPaymentDetails && (
            <>
              <div className="mb-4">
                <label className="text-sm text-gray-600 mb-2 block">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(m => (
                    <button key={m.value} type="button"
                      onClick={() => setForm(prev => ({ ...prev, payment_method: m.value }))}
                      className={`py-2.5 rounded-xl text-sm border ${
                        form.payment_method === m.value
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >{m.label}</button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm text-gray-600 mb-1 block">
                  Amount Paid (RM){form.payment_status === 'partial' ? ' *' : ''}
                </label>
                <input type="number" name="amount_paid" placeholder="0.00"
                  value={form.amount_paid} onChange={handleChange} className={INPUT} />
                {form.payment_status === 'partial' && form.amount_paid && total > 0 &&
                  parseFloat(form.amount_paid) >= total && (
                  <p className="text-xs text-orange-500 mt-1">Amount paid should be less than total for partial payment.</p>
                )}
              </div>
            </>
          )}

          <div>
            <label className="text-sm text-gray-600 mb-1 block">Payment Note</label>
            <input type="text" name="payment_note" placeholder="Example: Will pay on delivery"
              value={form.payment_note} onChange={handleChange} className={INPUT} />
          </div>
        </div>

        {/* ── Submit ── */}
        <button type="submit" disabled={loading}
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium text-sm active:opacity-80">
          {loading ? 'Submitting...' : 'Create Order'}
        </button>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
          </div>
        )}
      </form>

    </div>
  )
}

// ── Inline component select ──
function ComponentSelect({ label, items, value, onChange }: {
  label: string; items: Component[]; value: number | null; onChange: (id: number | null) => void
}) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-[11px] text-gray-400 w-16 flex-shrink-0">{label}</span>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-orange-400 bg-white text-gray-700"
      >
        <option value="">Select…</option>
        {items.map(c => <option key={c.id} value={c.id}>{c.description || c.name}{c.description ? ` — ${c.name}` : ''}</option>)}
      </select>
    </div>
  )
}
