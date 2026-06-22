'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import BackButton from '../../components/BackButton'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getMondayOfWeek } from '@/lib/dateUtils'
import { fetchWeeklyMenuAction } from '../weekly-menu/actions'

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

type DayVariant = { code: string; name: string; dish: string | null; dish_en: string | null }
type OrderItem = { variant: string; quantity: number }
type Combo = { main: string; veg: string; staple: string; qty: number }

const comboLetter = (i: number) => String.fromCharCode(65 + i)

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

  // Weekly-plan variants for the chosen date (empty ⇒ no plan ⇒ custom mode)
  const [dayVariants, setDayVariants] = useState<DayVariant[]>([])
  const [menuLoading, setMenuLoading] = useState(false)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([{ variant: '', quantity: 1 }])
  // Custom mode: a list of bento combinations (A, B, C…), each a 3-compartment
  // box with its own quantity. Tap a combo to expand and edit its compartments.
  const [combos, setCombos] = useState<Combo[]>([{ main: '', veg: '', staple: '', qty: 1 }])
  const [editingCombo, setEditingCombo] = useState<number | null>(null)
  const [areaOpen, setAreaOpen] = useState(false)

  const published = dayVariants.length > 0
  const isDelivery = form.fulfillment_type === 'delivery'

  // Load the published weekly menu for the selected date + realtime subscription.
  useEffect(() => {
    if (!form.delivery_date) { setDayVariants([]); return }
    let active = true
    setMenuLoading(true)
    const ws = getMondayOfWeek(form.delivery_date)
    const dow = dowFromDate(form.delivery_date)

    function applyMenu(data: Awaited<ReturnType<typeof fetchWeeklyMenuAction>>) {
      if (!active) return
      if (data.ok) {
        const seen = new Map<string, DayVariant>()
        for (const it of data.data.filter(i => i.day_of_week === dow)) {
          const code = it.variant_code ?? String(it.variant_id)
          if (!seen.has(code)) {
            seen.set(code, { code, name: it.variant_name ?? code, dish: it.dish_name ?? it.custom_name ?? null, dish_en: it.dish_description ?? null })
          }
        }
        setDayVariants([...seen.values()])
      } else {
        setDayVariants([])
      }
      setMenuLoading(false)
    }

    // Initial fetch (server action — does auth check)
    fetchWeeklyMenuAction(ws).then(applyMenu)

    // Realtime: silent client-side refresh — no server roundtrip, no loading state
    const channel = supabase
      .channel('weekly-menu-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bento_weekly_menu_assignments', filter: `week_start=eq.${ws}` },
        async () => {
          const { data } = await supabase
            .from('bento_weekly_menu_assignments')
            .select('*, bento_menu_variants(code, name), bento_proteins(name, description), bento_vegetables(name, description), bento_staples(name, description)')
            .eq('week_start', ws).eq('day_of_week', dow).order('variant_id')
          if (!active || !data) return
          const seen = new Map<string, DayVariant>()
          for (const r of data as Record<string, unknown>[]) {
            const v = r.bento_menu_variants as Record<string, unknown> | null
            const protein = r.bento_proteins as Record<string, unknown> | null
            const vegetable = r.bento_vegetables as Record<string, unknown> | null
            const staple = r.bento_staples as Record<string, unknown> | null
            const code = (v?.code as string) ?? String(r.variant_id)
            if (!seen.has(code)) {
              const parts = [protein?.name, vegetable?.name, staple?.name].filter(Boolean)
              const descrParts = [protein?.description, vegetable?.description, staple?.description].filter(Boolean)
              seen.set(code, {
                code, name: (v?.name as string) ?? code,
                dish: parts.length > 0 ? parts.join(' + ') : null,
                dish_en: descrParts.length > 0 ? descrParts.join(' + ') : null,
              })
            }
          }
          setDayVariants([...seen.values()])
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [form.delivery_date])

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

  // Custom combos
  function addCombo() { setCombos(prev => { setEditingCombo(prev.length); return [...prev, { main: '', veg: '', staple: '', qty: 1 }] }) }
  function removeCombo(idx: number) {
    setCombos(prev => {
      const next = prev.filter((_, i) => i !== idx)
      return next.length ? next : [{ main: '', veg: '', staple: '', qty: 1 }]
    })
    setEditingCombo(null)
  }
  function setComboField(idx: number, field: keyof Combo, value: string) {
    setCombos(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c))
  }
  function adjustComboQty(idx: number, delta: number) {
    setCombos(prev => prev.map((c, i) => i === idx ? { ...c, qty: Math.max(1, c.qty + delta) } : c))
  }

  const totalQty = published ? orderItems.reduce((s, i) => s + i.quantity, 0) : combos.reduce((s, c) => s + c.qty, 0)
  const unitPrice = parseFloat(form.unit_price) || 0
  const total = unitPrice * totalQty

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customer_name.trim()) { setError('Customer name is required.'); return }
    if (published && !orderItems.every(i => i.variant)) { setError('Please choose a menu for each item.'); return }
    if (!published && !combos.every(c => c.main.trim())) { setError('Please name the main dish for each bento.'); return }
    if (!form.unit_price || unitPrice <= 0) { setError('Unit price is required.'); return }

    const variantName = (code: string) => dayVariants.find(v => v.code === code)?.name ?? code
    const comboText = (c: Combo) => {
      const sides = [c.veg.trim(), c.staple.trim()].filter(Boolean).join(' / ')
      return `${c.main.trim()}${sides ? ` (${sides})` : ''} x${c.qty}`
    }
    const itemsText = published
      ? orderItems.map(i => `${variantName(i.variant)} x${i.quantity}`).join(', ')
      : combos.map((c, i) => `${comboLetter(i)}. ${comboText(c)}`).join('; ')
    const menuType = published ? (orderItems[0]?.variant ?? '') : 'custom'
    const firstCombo = combos[0]

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
        // Custom bento: full multi-combo breakdown lives in `items`; the first
        // combo's compartments are mirrored here for the single-box kitchen view.
        bento_items:             null,
        compartment_a:           published ? null : (firstCombo?.main || null),
        compartment_b:           published ? null : (firstCombo?.veg || null),
        compartment_c:           published ? null : (firstCombo?.staple || null),
        ready_by:                form.ready_by || null,
        note:                    form.note,
        amount:                  total,
        quantity:                totalQty,
        paid:                    form.payment_status === 'paid',
        status:                  'pending',
        // Payment
        payment_status:          form.payment_status,
        payment_method:          form.payment_method || null,
        amount_paid:             parseFloat(form.amount_paid) || 0,
        payment_note:            form.payment_note,
      })
      if (err) {
        setError(err.message || 'Failed to create order.')
        setLoading(false)
        return
      }
      // Member deduction: count this manual order against the member's package.
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

        {/* ── Meal selection: weekly plan variants OR custom ABC ── */}
        <div className="pt-2 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3 mt-3">
            <label className="text-sm text-gray-600 font-medium">
              {published ? 'Items *' : 'Custom Bento *'}
            </label>
            {!menuLoading && (
              <button type="button" onClick={published ? addItem : addCombo}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xl leading-none active:opacity-70"
                style={{ background: '#f97316' }} aria-label={published ? 'Add item' : 'Add bento'}>+</button>
            )}
          </div>

          {menuLoading ? (
            <div className="h-20 rounded-2xl bg-white animate-pulse" />
          ) : published ? (
            <>
              <p className="text-[11px] text-gray-400 mb-1.5">Weekly menu is published for this day — choose from the menu.</p>
              <div className="space-y-2">
                {orderItems.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-xl px-2.5 pt-2 pb-2.5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Item #{idx + 1}</span>
                      {orderItems.length > 1 && (
                        <button type="button" onClick={() => removeItem(idx)}
                          className="text-gray-300 active:text-red-400 p-0.5 -mr-0.5" aria-label="Remove item">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="mb-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(dayVariants.length, 3)}, minmax(0, 1fr))` }}>
                      {dayVariants.map(v => (
                        <button key={v.code} type="button" onClick={() => setItemVariant(idx, v.code)}
                          className={`py-1 px-0.5 rounded-lg text-[11px] border transition-colors leading-tight ${
                            item.variant === v.code ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'
                          }`}>
                          <span className={`block font-medium truncate`}>{v.dish_en || v.dish || v.name}</span>
                          {v.dish_en && v.dish && <span className={`block text-[9px] mt-0.5 truncate ${item.variant === v.code ? 'text-orange-100' : 'text-gray-400'}`}>{v.dish}</span>}
                        </button>
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
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-2">No weekly menu for this day — build custom bentos. Tap a bento to edit its 3 compartments; add more with +.</p>
              <div className="space-y-2">
                {combos.map((c, idx) => (
                  <div key={idx} className="bg-white rounded-2xl shadow-sm flex items-center gap-3 px-3 py-3">
                    <button type="button" onClick={() => setEditingCombo(idx)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <span className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: '#f97316' }}>{comboLetter(idx)}</span>
                      <span className={`flex-1 min-w-0 truncate text-sm ${c.main.trim() ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                        {c.main.trim() || 'Tap to set main dish'}
                      </span>
                    </button>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button type="button" onClick={() => adjustComboQty(idx, -1)}
                        className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 text-base leading-none active:bg-gray-200">−</button>
                      <span className="text-sm font-semibold w-5 text-center tabular-nums">{c.qty}</span>
                      <button type="button" onClick={() => adjustComboQty(idx, 1)}
                        className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 text-base leading-none active:bg-gray-200">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
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

      {/* ── Combo edit sheet ── */}
      {editingCombo !== null && combos[editingCombo] && createPortal(
        (() => {
          const ec = editingCombo
          const c = combos[ec]
          const fields = [
            { field: 'main' as const,   label: 'Meat / main dish',  placeholder: 'e.g. Salted egg yolk chicken' },
            { field: 'veg' as const,    label: 'Vegetable / side',  placeholder: 'e.g. Greens, fruit platter' },
            { field: 'staple' as const, label: 'Staple',            placeholder: 'e.g. Rice, noodles, dumpling' },
          ]
          return (
            <div className="fixed inset-0 flex flex-col justify-end" style={{ zIndex: 2147483647, background: 'rgba(0,0,0,0.4)' }}
              onClick={() => setEditingCombo(null)}>
              <div className="bg-white rounded-t-3xl px-4 pt-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 20px)' }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-semibold text-base text-gray-900">Bento {comboLetter(ec)}</span>
                  <button type="button" onClick={() => setEditingCombo(null)} className="text-gray-400 text-2xl leading-none active:opacity-70">×</button>
                </div>

                <div className="space-y-3">
                  {fields.map(f => (
                    <div key={f.field}>
                      <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
                      <input type="text" placeholder={f.placeholder}
                        value={c[f.field]} onChange={e => setComboField(ec, f.field, e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400"
                        style={{ fontSize: 16 }} autoFocus={f.field === 'main'} />
                    </div>
                  ))}
                </div>

                <button type="button" onClick={() => setEditingCombo(null)}
                  className="w-full mt-4 py-3 rounded-2xl text-sm font-semibold text-white active:opacity-80" style={{ background: '#f97316' }}>
                  Done
                </button>
                <button type="button" onClick={() => removeCombo(ec)}
                  className="w-full mt-2 py-3 rounded-2xl text-sm font-semibold text-red-400 bg-red-50 active:opacity-80">
                  Delete
                </button>
              </div>
            </div>
          )
        })(),
        document.body
      )}
    </div>
  )
}
