'use client'

import { useState, useEffect, useRef } from 'react'
import BackButton from '../../components/BackButton'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useNavigation } from '@/app/components/NavigationStack'
import { DatePickerField, TimePickerField } from '@/app/components/DateTimePickerFields'
import { buildStructuredMenu, type ProductionLine } from '@/lib/bentoProduction'

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

type BentoVariant = { id: number; code: string; name: string }
type Component    = { id: number; name: string; description: string | null; is_active: boolean }
type CustomCombo  = { protein_id: number | null; vegetable_id: number | null; staple_id: number | null; qty: number }

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

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const INPUT = 'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400'

export default function NewBentoOrder() {
  const router = useRouter()
  const { pop } = useNavigation()
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
  const [allVariants, setAllVariants]               = useState<BentoVariant[]>([])
  const [assignedVariantIds, setAssignedVariantIds] = useState<number[] | null>(null)
  const [variantCompartments, setVariantCompartments] = useState<Record<number, { a: string|null; b: string|null; c: string|null }>>({})
  const [variantQtys, setVariantQtys]               = useState<Record<number, number>>({})
  const [customCombos, setCustomCombos]             = useState<CustomCombo[]>([])
  const [areaOpen, setAreaOpen] = useState(false)

  const isDelivery = form.fulfillment_type === 'delivery'

  useEffect(() => {
    supabase
      .from('bento_menu_variants')
      .select('id,code,name')
      .eq('is_active', true)
      .order('display_order')
      .then(({ data }) => setAllVariants((data ?? []) as BentoVariant[]))
  }, [])

  useEffect(() => {
    if (!form.delivery_date) return
    setAssignedVariantIds(null)
    setVariantCompartments({})
    setVariantQtys({})
    const dow       = dowFromDate(form.delivery_date)
    const weekStart = getWeekStart(form.delivery_date)
    supabase
      .from('bento_weekly_menu_assignments')
      .select('variant_id, bento_proteins(name,description), bento_vegetables(name,description), bento_staples(name,description)')
      .eq('week_start', weekStart)
      .eq('day_of_week', dow)
      .then(({ data, error }) => {
        if (error) return
        const rows = (data ?? []) as unknown as Array<{
          variant_id: number
          bento_proteins:   { name: string; description: string | null } | null
          bento_vegetables: { name: string; description: string | null } | null
          bento_staples:    { name: string; description: string | null } | null
        }>
        setAssignedVariantIds(rows.map(r => r.variant_id))
        const comps: Record<number, { a: string|null; b: string|null; c: string|null }> = {}
        for (const r of rows) {
          comps[r.variant_id] = {
            a: r.bento_proteins?.description   || r.bento_proteins?.name   || null,
            b: r.bento_vegetables?.description || r.bento_vegetables?.name || null,
            c: r.bento_staples?.description    || r.bento_staples?.name    || null,
          }
        }
        setVariantCompartments(comps)
      })
  }, [form.delivery_date])

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

  const activeVariants   = assignedVariantIds === null
    ? []
    : allVariants.filter(v => assignedVariantIds.includes(v.id))
  const hasWeeklyMenu    = assignedVariantIds !== null && assignedVariantIds.length > 0
  const variantTotal     = activeVariants.reduce((s, v) => s + (variantQtys[v.id] ?? 0), 0)
  const customTotal      = customCombos.reduce((s, c) => s + c.qty, 0)
  const totalQty         = variantTotal + customTotal
  const unitPrice = parseFloat(form.unit_price) || 0
  const total = unitPrice * totalQty

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customer_name.trim()) { setError('Customer name is required.'); return }
    if (!form.unit_price || unitPrice <= 0) { setError('Unit price is required.'); return }

    const activeVariantSubmit = activeVariants.filter(v => (variantQtys[v.id] ?? 0) > 0)
    const activeCustomCombos  = customCombos.filter(c => c.protein_id || c.vegetable_id || c.staple_id)
    if (activeVariantSubmit.length === 0 && activeCustomCombos.length === 0) {
      setError('Please add at least one menu item.'); return
    }

    const parts: string[] = []
    for (const v of activeVariantSubmit) {
      parts.push(`${v.name} x${variantQtys[v.id]}`)
    }
    for (const c of activeCustomCombos) {
      const protein = proteins.find(p => p.id === c.protein_id)
      const veg     = vegetables.find(v => v.id === c.vegetable_id)
      const staple  = staples.find(s => s.id === c.staple_id)
      const label   = [
        protein?.name,
        veg?.name,
        staple?.name,
      ].filter(Boolean).join(' / ') || 'Custom'
      parts.push(`${label} x${c.qty}`)
    }

    const itemsText = parts.join(', ')
    const menuType  = activeVariantSubmit.length > 0 ? activeVariantSubmit[0].code : 'custom'

    // compartment_a/b/c: prefer first variant's weekly-menu dishes, fall back to first custom combo
    const firstVariantComp = activeVariantSubmit.length > 0 ? (variantCompartments[activeVariantSubmit[0].id] ?? null) : null
    const firstCustom  = activeCustomCombos[0]
    const firstProtein = firstCustom ? proteins.find(p => p.id === firstCustom.protein_id) : null
    const firstVeg     = firstCustom ? vegetables.find(v => v.id === firstCustom.vegetable_id) : null
    const firstStaple  = firstCustom ? staples.find(s => s.id === firstCustom.staple_id) : null
    const compA = firstVariantComp?.a ?? firstProtein?.name ?? null
    const compB = firstVariantComp?.b ?? firstVeg?.description     ?? firstVeg?.name     ?? null
    const compC = firstVariantComp?.c ?? firstStaple?.description  ?? firstStaple?.name  ?? null

    const productionLines: ProductionLine[] = activeVariantSubmit.map(v => {
      const compartments = variantCompartments[v.id]
      return {
        key: `variant:${v.id}`,
        label: v.name,
        compartment_a: compartments?.a ?? null,
        compartment_b: compartments?.b ?? null,
        compartment_c: compartments?.c ?? null,
        qty: variantQtys[v.id],
      }
    })
    for (const c of activeCustomCombos) {
      const protein = proteins.find(p => p.id === c.protein_id)
      const veg = vegetables.find(v => v.id === c.vegetable_id)
      const staple = staples.find(s => s.id === c.staple_id)
      productionLines.push({
        key: `custom:${c.protein_id ?? 0}:${c.vegetable_id ?? 0}:${c.staple_id ?? 0}`,
        label: [protein?.name, veg?.description || veg?.name, staple?.description || staple?.name].filter(Boolean).join(' / ') || 'Custom',
        compartment_a: protein?.name || null,
        compartment_b: veg?.description || veg?.name || null,
        compartment_c: staple?.description || staple?.name || null,
        qty: c.qty,
      })
    }
    const structuredMenu = buildStructuredMenu({
      variants: activeVariantSubmit.map(v => ({ id: v.id, qty: variantQtys[v.id] })),
      combos: activeCustomCombos,
      productionLines,
    })

    setLoading(true)
    setError(null)
    try {
      const { data: savedOrder, error: err } = await supabase.from('bento_orders').insert({
        date:                    form.delivery_date,
        customer_name:           form.customer_name.trim(),
        phone:                   form.phone,
        fulfillment_type:        form.fulfillment_type,
        address:                 isDelivery ? (form.address || null) : null,
        area:                    isDelivery ? (form.area || null) : null,
        delivery_or_pickup_time: form.order_time || null,
        menu_type:               menuType,
        items:                   itemsText,
        bento_items:             structuredMenu,
        compartment_a:           compA,
        compartment_b:           compB,
        compartment_c:           compC,
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
      }).select('*').single()
      if (err) {
        setError(err.message || 'Failed to create order.')
        setLoading(false)
        return
      }
      if (selectedCustomer && isMemberOpt(selectedCustomer) && deductPackage) {
        const nextUsed = Math.min(selectedCustomer.total_portions, selectedCustomer.used_portions + totalQty)
        await supabase.from('bento_customers').update({ used_portions: nextUsed }).eq('id', selectedCustomer.id)
      }
      window.dispatchEvent(new CustomEvent('bento-order-updated', {
        detail: { date: form.delivery_date, order: savedOrder },
      }))
      router.refresh()
      setTimeout(() => { pop() }, 100)
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
          <DatePickerField
            ariaLabel={isDelivery ? 'Delivery date' : 'Pickup date'}
            value={form.delivery_date}
            onChange={value => setForm(prev => ({ ...prev, delivery_date: value }))}
          />
        </div>

        {/* ── Single time (delivery or pickup) ── */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">{timeLabel}</label>
          <TimePickerField
            ariaLabel={timeLabel}
            title={timeLabel}
            value={form.order_time}
            onChange={value => setForm(prev => ({ ...prev, order_time: value }))}
          />
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

        {/* ── Menu ── */}
        <div className="pt-2 border-t border-gray-200">
          <label className="text-sm text-gray-600 mb-2 block font-medium">Menu *</label>

          {/* Layer 1 — Weekly menu variants */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Weekly menu</span>
            </div>
            {assignedVariantIds === null ? (
              <div className="text-xs text-gray-400 px-1">Loading…</div>
            ) : !hasWeeklyMenu ? (
              <div className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
                No weekly menu set for this day — use custom combos below.
              </div>
            ) : (
              <div className="space-y-2">
                {activeVariants.map(v => {
                  const qty = variantQtys[v.id] ?? 0
                  return (
                    <div key={v.id} className="bg-white rounded-xl px-3 py-2.5 flex items-center justify-between shadow-sm">
                      <span className="text-sm font-medium text-gray-800">{v.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setVariantQtys(prev => ({ ...prev, [v.id]: Math.max(0, (prev[v.id] ?? 0) - 1) }))}
                          className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm leading-none active:bg-gray-200"
                        >−</button>
                        <span className="text-sm font-semibold w-6 text-center tabular-nums">{qty}</span>
                        <button
                          type="button"
                          onClick={() => setVariantQtys(prev => ({ ...prev, [v.id]: (prev[v.id] ?? 0) + 1 }))}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm leading-none active:opacity-70"
                          style={{ background: '#f97316' }}
                        >+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Layer 2 — Custom combos */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Custom combos</span>
            <button
              type="button"
              onClick={() => setCustomCombos(prev => [...prev, { protein_id: null, vegetable_id: null, staple_id: null, qty: 1 }])}
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm leading-none active:opacity-70"
              style={{ background: '#9ca3af' }}
              aria-label="Add combo"
            >+</button>
          </div>
          <div className="space-y-2">
            {customCombos.map((c, idx) => (
              <div key={idx} className="bg-white rounded-xl px-3 pt-2 pb-2.5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Combo #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => setCustomCombos(prev => prev.filter((_, i) => i !== idx))}
                    className="text-gray-300 active:text-red-400 p-0.5 -mr-0.5"
                    aria-label="Remove combo"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <ComponentSelect
                  label="荤菜"
                  items={proteins}
                  value={c.protein_id}
                  onChange={val => setCustomCombos(prev => prev.map((x, i) => i === idx ? { ...x, protein_id: val } : x))}
                  groupable
                />
                <ComponentSelect
                  label="素菜"
                  items={vegetables}
                  value={c.vegetable_id}
                  onChange={val => setCustomCombos(prev => prev.map((x, i) => i === idx ? { ...x, vegetable_id: val } : x))}
                />
                <ComponentSelect
                  label="主食"
                  items={staples}
                  value={c.staple_id}
                  onChange={val => setCustomCombos(prev => prev.map((x, i) => i === idx ? { ...x, staple_id: val } : x))}
                />
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-gray-400">Qty</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCustomCombos(prev => prev.map((x, i) => i === idx ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}
                      className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm leading-none active:bg-gray-200"
                    >−</button>
                    <span className="text-xs font-semibold w-5 text-center tabular-nums">{c.qty}</span>
                    <button
                      type="button"
                      onClick={() => setCustomCombos(prev => prev.map((x, i) => i === idx ? { ...x, qty: x.qty + 1 } : x))}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm leading-none active:opacity-70"
                      style={{ background: '#f97316' }}
                    >+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Ready by (kitchen) ── */}
        <div style={{ maxWidth: '50%' }}>
          <label className="text-xs text-gray-500 mb-1 block">Ready by (kitchen)</label>
          <TimePickerField
            ariaLabel="Ready by kitchen time"
            title="Ready by"
            value={form.ready_by}
            onChange={value => setForm(prev => ({ ...prev, ready_by: value }))}
          />
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
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
          </div>
        )}
        <button type="submit" disabled={loading}
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium text-sm active:opacity-80">
          {loading ? 'Submitting...' : 'Create Order'}
        </button>
      </form>

    </div>
  )
}

// ── Searchable component picker ──
const PROTEIN_GROUPS: { label: string; keywords: string[] }[] = [
  { label: 'Chicken', keywords: ['chicken'] },
  { label: 'Beef',    keywords: ['beef'] },
  { label: 'Pork',    keywords: ['pork'] },
  { label: 'Fish & Seafood', keywords: ['fish', 'shrimp', 'prawn', 'seafood', 'luffa shrimp', 'crab', 'squid'] },
  { label: 'Tofu & Veg', keywords: ['tofu', 'mushroom', 'vegetarian', 'veg'] },
]
function proteinGroup(name: string): string {
  const lower = name.toLowerCase()
  for (const g of PROTEIN_GROUPS) {
    if (g.keywords.some(k => lower.includes(k))) return g.label
  }
  return 'Others'
}
function groupItems(items: Component[]): { group: string; items: Component[] }[] {
  const map = new Map<string, Component[]>()
  for (const item of items) {
    const g = proteinGroup(item.description || item.name)
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(item)
  }
  const order = [...PROTEIN_GROUPS.map(g => g.label), 'Others']
  return order.filter(g => map.has(g)).map(g => ({ group: g, items: map.get(g)! }))
}

function ComponentSelect({ label, items, value, onChange, groupable = false }: {
  label: string; items: Component[]; value: number | null; onChange: (id: number | null) => void; groupable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const selected = items.find(c => c.id === value)
  const displayName = (c: Component) => c.description ? `${c.name} — ${c.description}` : c.name

  const filtered = search.trim()
    ? items.filter(c => displayName(c).toLowerCase().includes(search.toLowerCase()))
    : items

  const grouped = groupable && !search.trim() ? groupItems(filtered) : [{ group: '', items: filtered }]

  return (
    <div className="flex items-center gap-2 mb-1.5 min-w-0">
      <span className="text-[11px] text-gray-400 w-10 flex-shrink-0">{label}</span>
      <button type="button" onClick={() => setOpen(true)}
        className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-left bg-white text-gray-700 flex items-center justify-between gap-1">
        <span className={selected ? 'text-gray-800' : 'text-gray-400'}>{selected ? displayName(selected) : 'Select…'}</span>
        <span className="text-gray-300 flex-shrink-0">▾</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[500] flex flex-col" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setOpen(false)}>
          <div className="mt-auto bg-white rounded-t-2xl max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-4 pt-4 pb-2 border-b border-gray-100">
              <div className="text-sm font-semibold text-gray-700 mb-2">{label}</div>
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
            </div>
            <div className="overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
              <button type="button" onClick={() => { onChange(null); setOpen(false); setSearch('') }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-400 border-b border-gray-50">
                — None
              </button>
              {grouped.map(({ group, items: gItems }) => (
                <div key={group || 'all'}>
                  {group && <div className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">{group}</div>}
                  {gItems.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => { onChange(c.id); setOpen(false); setSearch('') }}
                      className={`w-full px-4 py-2.5 text-left text-sm border-b border-gray-50 ${value === c.id ? 'text-orange-500 font-medium bg-orange-50' : 'text-gray-800'}`}>
                      {displayName(c)}
                    </button>
                  ))}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-gray-400">No results</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
