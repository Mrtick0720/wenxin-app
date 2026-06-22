'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useNavigation } from '../../../../components/NavigationStack'
import { updateOrderAction } from '../../actions'
import { DatePickerField, TimePickerField } from '@/app/components/DateTimePickerFields'
import { buildStructuredMenu, type ProductionLine } from '@/lib/bentoProduction'

const INPUT = 'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400'

type BentoVariant = { id: number; code: string; name: string }
type Component    = { id: number; name: string; description: string | null; is_active: boolean }
type CustomCombo  = { protein_id: number | null; vegetable_id: number | null; staple_id: number | null; qty: number }

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

type Props = {
  orderId?: number
  order?: Record<string, unknown>  // pre-fetched from BentoClient
}

export default function EditOrderPage({ orderId: propOrderId, order: preloadedOrder }: Props = {}) {
  const router = useRouter()
  const { pop } = useNavigation()
  const rawParams = useParams()
  const orderId = propOrderId ?? parseInt((rawParams.id as string) || '0', 10)

  const [loading, setLoading] = useState(!preloadedOrder)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Holds variantQtys parsed from bento_items on initial load — restored after weekly menu loads
  const pendingQtysRef = useRef<Record<number, number> | null>(null)
  const originalDateRef = useRef('')
  const completedLineKeysRef = useRef<string[]>([])

  // Proteins / vegetables / staples for custom combos
  const [proteins,   setProteins]   = useState<Component[]>([])
  const [vegetables, setVegetables] = useState<Component[]>([])
  const [staples,    setStaples]    = useState<Component[]>([])

  // Weekly menu
  const [allVariants,          setAllVariants]          = useState<BentoVariant[]>([])
  const [assignedVariantIds,   setAssignedVariantIds]   = useState<number[] | null>(null)
  const [variantCompartments,  setVariantCompartments]  = useState<Record<number, { a: string|null; b: string|null; c: string|null }>>({})
  const [variantQtys,          setVariantQtys]          = useState<Record<number, number>>({})
  const [customCombos,       setCustomCombos]       = useState<CustomCombo[]>([])

  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    fulfillment_type: 'delivery',
    delivery_date: '',
    order_time: '',
    area: '',
    address: '',
    menu_type: '',          // selected variant code
    unit_price: '',
    note: '',
    payment_status: 'unpaid',
    payment_method: '',
    amount_paid: '0',
    payment_note: '',
  })

  // Load order data
  useEffect(() => {
    let active = true

    function applyOrder(o: Record<string, unknown>) {
      if (!active) return
      setForm({
        customer_name: (o.customer_name as string) ?? '',
        phone: (o.phone as string) ?? '',
        fulfillment_type: (o.fulfillment_type as string) ?? 'delivery',
        delivery_date: (o.date as string) ?? '',
        order_time: (o.delivery_or_pickup_time as string) ?? '',
        area: (o.area as string) ?? '',
        address: (o.address as string) ?? '',
        menu_type: (o.menu_type as string) ?? '',
        unit_price: o.quantity ? String(((o.amount as number) || 0) / (o.quantity as number)) : '',
        note: (o.note as string) ?? '',
        payment_status: (o.payment_status as string) ?? ((o.paid as boolean) ? 'paid' : 'unpaid'),
        payment_method: (o.payment_method as string) ?? '',
        amount_paid: String(o.amount_paid ?? (o.paid ? (o.amount ?? 0) : 0)),
        payment_note: (o.payment_note as string) ?? '',
      })
      originalDateRef.current = (o.date as string) ?? ''
      // Restore structured menu selections if available
      const raw = o.bento_items as string | null | undefined
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as {
            variants?: { id: number; qty: number }[]
            combos?: CustomCombo[]
            completed_line_keys?: string[]
          }
          if (parsed.variants?.length) {
            const qtys: Record<number, number> = {}
            for (const v of parsed.variants) qtys[v.id] = v.qty
            // Don't set immediately — the delivery_date effect will clear it.
            // Store here; the effect will restore after weekly menu loads.
            pendingQtysRef.current = qtys
          }
          if (parsed.combos?.length) setCustomCombos(parsed.combos)
          completedLineKeysRef.current = parsed.completed_line_keys ?? []
        } catch { /* ignore malformed */ }
      }
      setLoading(false)
    }

    if (preloadedOrder) {
      applyOrder(preloadedOrder)
    } else {
      supabase.from('bento_orders').select('*').eq('id', orderId).single().then(({ data }) => {
        if (!data) { setError('Order not found'); setLoading(false); return }
        applyOrder(data as Record<string, unknown>)
      })
    }

    return () => { active = false }
  }, [orderId, preloadedOrder])

  useEffect(() => {
    Promise.all([
      supabase.from('bento_proteins').select('id,name,description,is_active').eq('is_active', true).order('name'),
      supabase.from('bento_vegetables').select('id,name,description,is_active').eq('is_active', true).order('name'),
      supabase.from('bento_staples').select('id,name,description,is_active').eq('is_active', true).order('name'),
      supabase.from('bento_menu_variants').select('id,code,name').eq('is_active', true).order('display_order'),
    ]).then(([p, v, s, mv]) => {
      setProteins((p.data || []) as Component[])
      setVegetables((v.data || []) as Component[])
      setStaples((s.data || []) as Component[])
      setAllVariants((mv.data || []) as BentoVariant[])
    })
  }, [])

  useEffect(() => {
    if (!form.delivery_date) return
    setAssignedVariantIds(null)
    setVariantCompartments({})
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
        // Restore saved selections from bento_items on initial load; clear on date change
        if (pendingQtysRef.current) {
          setVariantQtys(pendingQtysRef.current)
          pendingQtysRef.current = null
        } else {
          setVariantQtys({})
        }
      })
  }, [form.delivery_date])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSave() {
    if (!form.customer_name.trim()) { setError('Customer name is required.'); return }
    if (!form.unit_price || unitPrice <= 0) { setError('Unit price is required.'); return }

    const activeVariantSubmit = activeVariants.filter(v => (variantQtys[v.id] ?? 0) > 0)
    const activeCustomCombos  = customCombos.filter(c => c.protein_id || c.vegetable_id || c.staple_id)
    if (activeVariantSubmit.length === 0 && activeCustomCombos.length === 0) {
      setError('Please add at least one menu item.'); return
    }

    setSaving(true); setError(null)

    const parts: string[] = []
    for (const v of activeVariantSubmit) {
      parts.push(`${v.name} x${variantQtys[v.id]}`)
    }
    for (const c of activeCustomCombos) {
      const protein = proteins.find(p => p.id === c.protein_id)
      const veg     = vegetables.find(v => v.id === c.vegetable_id)
      const staple  = staples.find(s => s.id === c.staple_id)
      const label   = [
        protein?.description || protein?.name,
        veg?.description || veg?.name,
        staple?.description || staple?.name,
      ].filter(Boolean).join(' / ') || 'Custom'
      parts.push(`${label} x${c.qty}`)
    }

    const itemsText = parts.join(', ')
    const menuType  = activeVariantSubmit.length > 0 ? activeVariantSubmit[0].code : 'custom'
    const amount    = (parseFloat(form.unit_price) || 0) * totalQty

    const firstCustom  = activeCustomCombos[0]
    const firstProtein = firstCustom ? proteins.find(p => p.id === firstCustom.protein_id) : null
    const firstVeg     = firstCustom ? vegetables.find(v => v.id === firstCustom.vegetable_id) : null
    const firstStaple  = firstCustom ? staples.find(s => s.id === firstCustom.staple_id) : null
    const firstVariantComp = activeVariantSubmit.length > 0 ? (variantCompartments[activeVariantSubmit[0].id] ?? null) : null
    const compA = firstVariantComp?.a ?? firstProtein?.description ?? firstProtein?.name ?? null
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
        label: [protein?.description || protein?.name, veg?.description || veg?.description || veg?.name, staple?.description || staple?.description || staple?.name].filter(Boolean).join(' / ') || 'Custom',
        compartment_a: protein?.description || protein?.name || null,
        compartment_b: veg?.description || veg?.description || veg?.name || null,
        compartment_c: staple?.description || staple?.description || staple?.name || null,
        qty: c.qty,
      })
    }
    const structuredMenu = buildStructuredMenu({
      variants: activeVariantSubmit.map(v => ({ id: v.id, qty: variantQtys[v.id] })),
      combos: activeCustomCombos,
      productionLines,
      completedLineKeys: completedLineKeysRef.current,
    })
    const retainedCompletedKeys = completedLineKeysRef.current.filter(key =>
      productionLines.some(line => line.key === key)
    )
    const allProductionDone = productionLines.length > 0 &&
      productionLines.every(line => retainedCompletedKeys.includes(line.key))

    const payload: Record<string, unknown> = {
      customer_name:           form.customer_name.trim(),
      phone:                   form.phone || null,
      fulfillment_type:        form.fulfillment_type,
      date:                    form.delivery_date,
      delivery_or_pickup_time: form.order_time || null,
      area:                    form.fulfillment_type === 'delivery' ? (form.area || null) : null,
      address:                 form.fulfillment_type === 'delivery' ? (form.address || null) : null,
      menu_type:               menuType,
      items:                   itemsText,
      bento_items:             structuredMenu,
      compartment_a:           compA,
      compartment_b:           compB,
      compartment_c:           compC,
      quantity:                totalQty,
      amount,
      note:                    form.note || null,
      paid:                    form.payment_status === 'paid',
      payment_status:          form.payment_status,
      payment_method:          form.payment_method || null,
      amount_paid:             parseFloat(form.amount_paid) || 0,
      payment_note:            form.payment_note || '',
      status:                  allProductionDone ? 'completed' : 'pending',
    }

    const res = await updateOrderAction(orderId, payload)
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    window.dispatchEvent(new CustomEvent('bento-order-updated', {
      detail: {
        dates: [originalDateRef.current, form.delivery_date].filter(Boolean),
        order: { id: orderId, ...payload, ...(res.data as Record<string, unknown>) },
      },
    }))
    router.refresh()
    setTimeout(() => { pop() }, 100)
  }

  const isDelivery     = form.fulfillment_type === 'delivery'
  const unitPrice      = parseFloat(form.unit_price) || 0
  const activeVariants = assignedVariantIds === null
    ? []
    : allVariants.filter(v => assignedVariantIds.includes(v.id))
  const hasWeeklyMenu  = assignedVariantIds !== null && assignedVariantIds.length > 0
  const variantTotal   = activeVariants.reduce((s, v) => s + (variantQtys[v.id] ?? 0), 0)
  const customTotal    = customCombos.reduce((s, c) => s + c.qty, 0)
  const totalQty       = variantTotal + customTotal
  const total          = unitPrice * totalQty

  if (loading) return <main className="bg-gray-50 w-full mx-auto" style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}><div className="flex-1 flex items-center justify-center"><div className="text-gray-400">Loading…</div></div></main>

  return (
    <main className="bg-gray-50 w-full mx-auto" style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b flex-shrink-0">
        <button onClick={() => pop()} className="text-gray-400 active:text-gray-600">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="font-semibold text-base">Edit Order #{orderId}</span>
      </div>

      <div className="px-4 py-4 space-y-4 flex-1 overflow-y-auto overflow-x-hidden" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}>
        {/* Customer */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Customer Name *</label>
          <input name="customer_name" placeholder="Customer name" value={form.customer_name} onChange={handleChange} className={INPUT} />
        </div>
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Phone</label>
          <input name="phone" type="tel" placeholder="0123456789" value={form.phone} onChange={handleChange} className={INPUT} />
        </div>

        {/* Fulfillment */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Fulfillment</label>
          <div className="flex gap-2">
            {(['delivery', 'pickup'] as const).map(ft => (
              <button key={ft} type="button" onClick={() => setForm(prev => ({ ...prev, fulfillment_type: ft }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border capitalize ${
                  form.fulfillment_type === ft ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'
                }`}>{ft}</button>
            ))}
          </div>
        </div>

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <label className="text-sm text-gray-600 mb-1 block">Date</label>
            <DatePickerField
              ariaLabel="Order date"
              value={form.delivery_date}
              onChange={value => setForm(prev => ({ ...prev, delivery_date: value }))}
            />
          </div>
          <div className="min-w-0">
            <label className="text-sm text-gray-600 mb-1 block">{isDelivery ? 'Delivery' : 'Pickup'} Time</label>
            <TimePickerField
              ariaLabel={isDelivery ? 'Delivery time' : 'Pickup time'}
              title={isDelivery ? 'Delivery Time' : 'Pickup Time'}
              value={form.order_time}
              onChange={value => setForm(prev => ({ ...prev, order_time: value }))}
            />
          </div>
        </div>

        {/* Delivery fields */}
        {isDelivery && (
          <>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Area</label>
              <select name="area" value={form.area} onChange={handleChange}
                className={`${INPUT} text-gray-700`}>
                <option value="">Select…</option>
                {['Likas','Luyang','Lintas','Karamunsing'].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Address</label>
              <input name="address" placeholder="Address" value={form.address} onChange={handleChange} className={INPUT} />
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
                    <div key={v.id} className="bg-white rounded-xl px-3 py-2.5 flex items-center justify-between shadow-sm overflow-hidden">
                      <span className="text-sm font-medium text-gray-800 truncate min-w-0 mr-2">{v.name}</span>
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

        {/* ── Pricing ── */}
        <div className="pt-2 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Unit Price (RM)</label>
              <input name="unit_price" type="number" inputMode="decimal" placeholder="13.00"
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

        {/* Note */}
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Note</label>
          <textarea name="note" placeholder="Note…" value={form.note} onChange={handleChange} rows={2}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400 resize-none" />
        </div>

        {/* Payment */}
        <div className="pt-2 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 mt-3">Payment</div>
          <div className="mb-4">
            <label className="text-sm text-gray-600 mb-2 block">Status</label>
            <div className="flex gap-2">
              {(['unpaid','paid','partial'] as const).map(s => (
                <button key={s} type="button" onClick={() => setForm(prev => ({
                  ...prev, payment_status: s,
                  amount_paid: s === 'paid' ? String(total) : s === 'unpaid' ? '0' : prev.amount_paid,
                }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border capitalize ${
                    form.payment_status === s
                      ? s === 'paid' ? 'bg-green-500 text-white border-green-500' : s === 'partial' ? 'bg-blue-500 text-white border-blue-500' : 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}>{s}</button>
              ))}
            </div>
          </div>
          {(form.payment_status === 'paid' || form.payment_status === 'partial') && (
            <>
              <div className="mb-4">
                <label className="text-sm text-gray-600 mb-2 block">Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {['cash','qr','bank_transfer','other'].map(m => (
                    <button key={m} type="button" onClick={() => setForm(prev => ({ ...prev, payment_method: m }))}
                      className={`py-2.5 rounded-xl text-sm border capitalize ${
                        form.payment_method === m ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'
                      }`}>{m.replace('_',' ')}</button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="text-sm text-gray-600 mb-1 block">Amount Paid (RM)</label>
                <input name="amount_paid" type="number" placeholder="0.00" value={form.amount_paid} onChange={handleChange} className={INPUT} />
              </div>
            </>
          )}
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Payment Note</label>
            <input name="payment_note" placeholder="Note…" value={form.payment_note} onChange={handleChange} className={INPUT} />
          </div>
        </div>

        {/* Save */}
        {error && (
          <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
            {error}
          </div>
        )}
        <button type="button" onClick={handleSave} disabled={saving}
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium text-sm active:opacity-80 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </main>
  )
}

const PROTEIN_GROUPS: { label: string; keywords: string[] }[] = [
  { label: 'Chicken',       keywords: ['chicken'] },
  { label: 'Beef',          keywords: ['beef'] },
  { label: 'Pork',          keywords: ['pork'] },
  { label: 'Fish & Seafood',keywords: ['fish', 'shrimp', 'prawn', 'seafood', 'crab', 'squid'] },
  { label: 'Tofu & Veg',   keywords: ['tofu', 'mushroom', 'vegetarian', 'veg'] },
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
  label: string
  items: Component[]
  value: number | null
  onChange: (id: number | null) => void
  groupable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const selected = items.find(c => c.id === value)
  const displayName = (c: Component) => c.description ? `${c.description} — ${c.name}` : c.name

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
        <div className="fixed inset-0 z-[500] flex items-start justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)', paddingTop: '10vh' }} onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl w-full flex flex-col shadow-xl" style={{ maxHeight: '55vh' }} onClick={e => e.stopPropagation()}>
            <div className="px-4 pt-3 pb-2 border-b border-gray-100 flex items-center gap-2">
              <div className="text-sm font-semibold text-gray-700 flex-1">{label}</div>
              <button type="button" onClick={() => { setOpen(false); setSearch('') }} className="text-gray-400 text-lg leading-none px-1">✕</button>
            </div>
            <div className="px-4 py-2 border-b border-gray-100">
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
            </div>
            <div className="flex-1 min-h-0" style={{ overflowY: 'scroll', WebkitOverflowScrolling: 'touch' }}>
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
