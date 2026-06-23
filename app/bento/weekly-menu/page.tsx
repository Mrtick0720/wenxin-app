'use client'

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import BackButton from '../../components/BackButton'
import { supabase } from '@/lib/supabase/client'
import { toLocalDateStr, addDays } from '@/lib/dateUtils'
import { useStaff } from '@/app/components/StaffProvider'
import { FullPageSpinner } from '@/app/components/Spinner'

const DAYS_FULL  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function isDefaultOpen(dayIndex: number) { return dayIndex < 5 }

const VARIANT_PLACEHOLDER = ['Protein', 'Vegetable', 'Staple']

const VARIANT_COLORS: Record<string, string> = {
  light:      '#3B82F6',
  flavorful:  '#F97316',
  vegetarian: '#16A34A',
}

function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toLocalDateStr(d)
}

function addWeeks(ws: string, n: number) { return addDays(ws, n * 7) }

function formatWeekLabel(ws: string): string {
  const s = new Date(ws + 'T00:00:00')
  const e = new Date(ws + 'T00:00:00'); e.setDate(e.getDate() + 6)
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${m[s.getMonth()]} ${s.getDate()} — ${m[e.getMonth()]} ${e.getDate()}`
}

function getDateNum(weekStart: string, dayIndex: number): number {
  const d = new Date(weekStart + 'T00:00:00')
  d.setDate(d.getDate() + dayIndex)
  return d.getDate()
}

type Variant  = { id: number; code: string; name: string }
type Component = { id: number; name: string; description: string | null; is_active: boolean }
type Assignment = {
  id?: number; week_start: string; day_of_week: number; variant_id: number
  protein_id: number | null; vegetable_id: number | null; staple_id: number | null
  protein_name?: string | null; vegetable_name?: string | null; staple_name?: string | null
  protein_descr?: string | null; vegetable_descr?: string | null; staple_descr?: string | null
}

export default function WeeklyMenuPage() {
  const staff    = useStaff()
  const canEdit  = staff?.role === 'owner' || staff?.role === 'manager'

  const todayWeekStart = getWeekStart(new Date())
  const todayIndex     = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1

  const [weekStart, setWeekStart]             = useState(todayWeekStart)
  const [selectedDay, setSelectedDay]         = useState(Math.min(todayIndex, 6))
  const [variants, setVariants]               = useState<Variant[]>([])
  const [proteins, setProteins]               = useState<Component[]>([])
  const [vegetables, setVegetables]           = useState<Component[]>([])
  const [staples, setStaples]                 = useState<Component[]>([])
  // protein name → variant_code (e.g. "虾仁烩豆腐" → "light")
  const [proteinVariant, setProteinVariant]   = useState<Record<string, string>>({})
  const [assignments, setAssignments]         = useState<Assignment[]>([])
  const [dayAvailability, setDayAvailability] = useState<Record<string, boolean>>({})
  const [loading, setLoading]                 = useState(true)
  const [toggleLoading, setToggleLoading]     = useState(false)
  const [openVariant, setOpenVariant]         = useState<{ dayIndex: number; variant: Variant } | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('bento_menu_variants').select('id,code,name').eq('is_active', true).order('display_order'),
      supabase.from('bento_proteins').select('id,name,description,is_active').eq('is_active', true).order('name'),
      supabase.from('bento_vegetables').select('id,name,description,is_active').eq('is_active', true).order('name'),
      supabase.from('bento_staples').select('id,name,description,is_active').eq('is_active', true).order('name'),
      supabase.from('bento_menu_library').select('dish_name, bento_menu_variants!inner(code)'),
    ]).then(([v, p, veg, s, lib]) => {
      setVariants((v.data || []) as Variant[])
      setProteins((p.data || []) as Component[])
      setVegetables((veg.data || []) as Component[])
      setStaples((s.data || []) as Component[])
      // Build protein name → variant_code map
      const pv: Record<string, string> = {}
      for (const r of (lib.data || []) as unknown as { dish_name: string; bento_menu_variants: { code: string } }[]) {
        if (r.bento_menu_variants?.code) pv[r.dish_name] = r.bento_menu_variants.code
      }
      setProteinVariant(pv)
    })
  }, [])

  const mapAssignments = (data: Record<string, unknown>[] | null): Assignment[] =>
    ((data || []) as Record<string, unknown>[]).map(r => {
      const p = r.bento_proteins   as Record<string, unknown> | null
      const v = r.bento_vegetables as Record<string, unknown> | null
      const s = r.bento_staples    as Record<string, unknown> | null
      return {
        id: r.id as number, week_start: r.week_start as string,
        day_of_week: r.day_of_week as number, variant_id: r.variant_id as number,
        protein_id:   (r.protein_id   as number) ?? null,
        vegetable_id: (r.vegetable_id as number) ?? null,
        staple_id:    (r.staple_id    as number) ?? null,
        protein_name:   p?.name as string | undefined,
        vegetable_name: v?.name as string | undefined,
        staple_name:    s?.name as string | undefined,
        protein_descr:   (p?.description as string) ?? null,
        vegetable_descr: (v?.description as string) ?? null,
        staple_descr:    (s?.description as string) ?? null,
      }
    }) as Assignment[]

  const loadWeek = useCallback(async (ws: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('bento_weekly_menu_assignments')
      .select('*, bento_proteins(name,description), bento_vegetables(name,description), bento_staples(name,description)')
      .eq('week_start', ws)
      .order('day_of_week')
    setAssignments(mapAssignments(data))
    setLoading(false)
  }, [])

  const loadAvailability = useCallback(async (ws: string) => {
    try {
      const dates = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
      const { data } = await supabase
        .from('bento_day_availability').select('date_str,is_open').in('date_str', dates)
      if (data) {
        const map: Record<string, boolean> = {}
        ;(data as { date_str: string; is_open: boolean }[]).forEach(r => { map[r.date_str] = r.is_open })
        setDayAvailability(map)
      }
    } catch { /* table may not exist yet — defaults apply */ }
  }, [])

  useEffect(() => {
    loadWeek(weekStart)
    loadAvailability(weekStart)

    // Realtime: silent refresh — no loading spinner, only updates changed cards
    const channel = supabase
      .channel('weekly-menu-editor')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bento_weekly_menu_assignments', filter: `week_start=eq.${weekStart}` },
        async () => {
          const { data } = await supabase
            .from('bento_weekly_menu_assignments')
            .select('*, bento_proteins(name,description), bento_vegetables(name,description), bento_staples(name,description)')
            .eq('week_start', weekStart)
            .order('day_of_week')
          setAssignments(mapAssignments(data))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadWeek, loadAvailability, weekStart])

  useEffect(() => {
    setSelectedDay(weekStart === todayWeekStart ? Math.min(todayIndex, 6) : 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  const selectedDateStr = addDays(weekStart, selectedDay)
  const isDayOpen       = selectedDateStr in dayAvailability
    ? dayAvailability[selectedDateStr]
    : isDefaultOpen(selectedDay)
  const showTodayBtn    = weekStart !== todayWeekStart || selectedDay !== Math.min(todayIndex, 6)

  async function toggleDayOpen(newIsOpen: boolean) {
    if (!canEdit) return
    setToggleLoading(true)
    try {
      await supabase.from('bento_day_availability')
        .upsert([{ date_str: selectedDateStr, is_open: newIsOpen }], { onConflict: 'date_str' })
      setDayAvailability(prev => ({ ...prev, [selectedDateStr]: newIsOpen }))
    } finally { setToggleLoading(false) }
  }

  return (
    <main style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>

      {/* ── Page header ── */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b flex-shrink-0">
        <BackButton href="/bento" />
        <span className="font-semibold text-base">Weekly Menu</span>
      </div>

      {/* ── Animated week strip ── */}
      <WeekStrip
        weekStart={weekStart}
        onWeekChange={setWeekStart}
        selectedDay={selectedDay}
        onDayChange={setSelectedDay}
        todayWeekStart={todayWeekStart}
        todayIndex={todayIndex}
        dayAvailability={dayAvailability}
      />

      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="px-4 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 160px)' }}>
          {loading ? (
            <FullPageSpinner />
          ) : isDayOpen ? (
            <>
              <div className="space-y-4">
                {variants.map(v => (
                  <VariantCard
                    key={v.id}
                    variant={v}
                    assignment={assignments.find(a => a.day_of_week === selectedDay && a.variant_id === v.id)}
                    canEdit={canEdit}
                    onEdit={() => setOpenVariant({ dayIndex: selectedDay, variant: v })}
                  />
                ))}
              </div>
              {canEdit && (
                <button
                  onClick={() => toggleDayOpen(false)} disabled={toggleLoading}
                  className="mt-5 w-full py-2 text-sm text-gray-400 active:text-red-400 transition-colors"
                >
                  Close this day
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
              </div>
              <div className="text-gray-700 font-semibold text-base mb-1">No meal service</div>
              <div className="text-gray-400 text-sm mb-6">Bento delivery is closed for this day</div>
              {canEdit && (
                <button onClick={() => toggleDayOpen(true)} disabled={toggleLoading}
                  className="px-8 py-2.5 bg-orange-500 text-white rounded-2xl text-sm font-semibold active:opacity-90">
                  Open this day
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Floating Today button ── */}
      {showTodayBtn && (
        <button
          onClick={() => { setWeekStart(todayWeekStart); setSelectedDay(Math.min(todayIndex, 6)) }}
          style={{
            position: 'fixed', bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
            left: '50%', transform: 'translateX(-50%)', zIndex: 50,
            padding: '10px 40px', background: '#60a5fa', color: '#fff',
            fontSize: 14, fontWeight: 600, borderRadius: 999, border: 'none',
            boxShadow: '0 4px 16px rgba(96,165,250,0.5)', whiteSpace: 'nowrap',
          }}
        >Today</button>
      )}

      {/* ── Single-variant editor sheet ── */}
      {openVariant !== null && (
        <VariantEditorSheet
          variant={openVariant.variant}
          dayName={DAYS_FULL[openVariant.dayIndex]}
          dayIndex={openVariant.dayIndex}
          weekStart={weekStart}
          proteins={proteins} vegetables={vegetables} staples={staples}
          proteinVariant={proteinVariant}
          assignments={assignments}
          onClose={() => setOpenVariant(null)}
          onSaved={() => { setOpenVariant(null); loadWeek(weekStart) }}
        />
      )}
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated week strip — WAAPI 3-panel slide, clamped to this week + next week

function WeekStrip({
  weekStart, onWeekChange, selectedDay, onDayChange, todayWeekStart, todayIndex, dayAvailability,
}: {
  weekStart: string; onWeekChange: (ws: string) => void
  selectedDay: number; onDayChange: (day: number) => void
  todayWeekStart: string; todayIndex: number
  dayAvailability: Record<string, boolean>
}) {
  const nextWeekStart = addWeeks(todayWeekStart, 1)
  const atStart       = weekStart === todayWeekStart
  const atEnd         = weekStart === nextWeekStart

  const stripRef  = useRef<HTMLDivElement>(null)
  const animRef   = useRef<Animation | null>(null)
  const tsX       = useRef(0)
  const dragging  = useRef(false)
  const dragged   = useRef(false)
  const resetFlag = useRef(false)
  const wsRef     = useRef(weekStart)
  useEffect(() => { wsRef.current = weekStart }, [weekStart])

  // After weekStart state update: snap strip back to center before paint
  useLayoutEffect(() => {
    if (resetFlag.current) {
      resetFlag.current = false
      const el = stripRef.current
      if (el) el.style.transform = 'translateX(-33.333%)'
    }
  }, [weekStart])

  function commitAnim() {
    if (!animRef.current) return
    try { animRef.current.commitStyles() } catch {}
    animRef.current.cancel()
    animRef.current = null
  }

  function snap(val: string) {
    commitAnim()
    const el = stripRef.current
    if (el) el.style.transform = val
  }

  function slide(target: string, onDone?: () => void) {
    commitAnim()
    const el = stripRef.current
    if (!el) return
    const fromPx   = new DOMMatrix(window.getComputedStyle(el).transform).m41
    const cw       = el.parentElement?.clientWidth ?? 300
    const toPx     = target === 'translateX(0%)' ? 0 : target === 'translateX(-66.666%)' ? -cw * 2 : -cw
    const anim     = el.animate(
      [{ transform: `translateX(${fromPx}px)` }, { transform: `translateX(${toPx}px)` }],
      { duration: 300, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', fill: 'forwards' }
    )
    animRef.current = anim
    anim.onfinish = () => {
      if (animRef.current !== anim) return
      try { anim.commitStyles() } catch {}
      anim.cancel()
      animRef.current = null
      onDone?.()
    }
  }

  function goWeek(ws: string, dir: 'prev' | 'next') {
    if (animRef.current) return
    snap('translateX(-33.333%)')
    slide(dir === 'prev' ? 'translateX(0%)' : 'translateX(-66.666%)', () => {
      resetFlag.current = true
      onWeekChange(ws)
    })
  }

  // Native touch listeners — passive:false on move so we can prevent iOS vertical scroll
  useEffect(() => {
    const el = stripRef.current
    if (!el) return

    const onStart = (e: TouchEvent) => {
      if (animRef.current) return
      tsX.current      = e.touches[0].clientX
      dragging.current = true
      dragged.current  = false
      const strip = stripRef.current
      if (strip) strip.style.transform = 'translateX(-33.333%)'
    }

    const onMove = (e: TouchEvent) => {
      if (!dragging.current) return
      const dx = e.touches[0].clientX - tsX.current
      if (Math.abs(dx) > 5) { dragged.current = true; e.preventDefault() }
      const strip = stripRef.current
      if (strip) strip.style.transform = `translateX(calc(-33.333% + ${dx}px))`
    }

    const onEnd = (e: TouchEvent) => {
      if (!dragging.current) return
      dragging.current = false
      const dx  = e.changedTouches[0].clientX - tsX.current
      const cw  = el.parentElement?.clientWidth ?? 300
      const th  = cw * 0.22
      const cur = wsRef.current
      const nxt = addWeeks(todayWeekStart, 1)

      if (dx > th && cur !== todayWeekStart) {
        const tw = addWeeks(cur, -1)
        slide('translateX(0%)', () => { resetFlag.current = true; onWeekChange(tw) })
      } else if (dx < -th && cur !== nxt) {
        const tw = addWeeks(cur, 1)
        slide('translateX(-66.666%)', () => { resetFlag.current = true; onWeekChange(tw) })
      } else if (dragged.current) {
        slide('translateX(-33.333%)')
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove',  onMove,  { passive: false })
    el.addEventListener('touchend',   onEnd,   { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove',  onMove)
      el.removeEventListener('touchend',   onEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayWeekStart, onWeekChange])

  const panelWeeks = [addWeeks(weekStart, -1), weekStart, addWeeks(weekStart, 1)]

  return (
    <div className="bg-white border-b flex-shrink-0 px-4 pt-3 pb-3">
      {/* Week label + arrows */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => !atStart && goWeek(addWeeks(weekStart, -1), 'prev')}
          disabled={atStart}
          className={`w-8 h-8 flex items-center justify-center rounded-xl text-lg leading-none ${
            atStart ? 'text-gray-200 pointer-events-none' : 'text-gray-400 active:bg-gray-100'
          }`}
        >‹</button>
        <div className="text-center">
          <div className="text-sm font-semibold text-gray-700">{formatWeekLabel(weekStart)}</div>
          <div className="text-[11px] text-orange-500 mt-0.5">{atStart ? 'This week' : 'Next week'}</div>
        </div>
        <button
          onClick={() => !atEnd && goWeek(addWeeks(weekStart, 1), 'next')}
          disabled={atEnd}
          className={`w-8 h-8 flex items-center justify-center rounded-xl text-lg leading-none ${
            atEnd ? 'text-gray-200 pointer-events-none' : 'text-gray-400 active:bg-gray-100'
          }`}
        >›</button>
      </div>

      {/* 3-panel sliding day strip */}
      <div className="overflow-hidden">
        <div
          ref={stripRef}
          className="flex"
          style={{ width: '300%', transform: 'translateX(-33.333%)', willChange: 'transform' }}
        >
          {panelWeeks.map((ws, pi) => (
            <div key={pi} style={{ width: '33.333%' }}>
              <div className="flex justify-around">
                {DAYS_SHORT.map((letter, i) => {
                  const isSelected = ws === weekStart && selectedDay === i
                  const isToday    = ws === todayWeekStart && i === todayIndex
                  const dateStr    = addDays(ws, i)
                  const open       = dateStr in dayAvailability ? dayAvailability[dateStr] : isDefaultOpen(i)
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (dragged.current || animRef.current) return
                        if (pi === 1) {
                          onDayChange(i)
                        } else if (pi === 0 && !atStart) {
                          slide('translateX(0%)', () => { resetFlag.current = true; onWeekChange(ws) })
                        } else if (pi === 2 && !atEnd) {
                          slide('translateX(-66.666%)', () => { resetFlag.current = true; onWeekChange(ws) })
                        }
                      }}
                      className="flex flex-col items-center gap-1"
                    >
                      <span className={`text-[11px] font-semibold ${isToday && !isSelected ? 'text-orange-500' : 'text-gray-400'}`}>
                        {letter}
                      </span>
                      <span className="relative w-9 h-9 flex items-center justify-center">
                        <span
                          className="absolute inset-0 rounded-full"
                          style={{
                            transform: isSelected ? 'scale(1)' : 'scale(0)',
                            transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            backgroundColor: '#f97316',
                          }}
                        />
                        <span
                          className="relative text-sm font-bold"
                          style={{
                            transition: 'color 0.18s ease',
                            color: isSelected ? '#fff' : isToday ? '#f97316' : '#374151',
                          }}
                        >
                          {getDateNum(ws, i)}
                        </span>
                      </span>
                      <span className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-transparent' : 'bg-gray-300'}`} />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Variant card — horizontal layout: text left, bento image right

function VariantCard({
  variant, assignment, canEdit, onEdit,
}: {
  variant: Variant
  assignment?: Assignment
  canEdit: boolean
  onEdit: () => void
}) {
  const configured = !!(assignment?.protein_id && assignment?.vegetable_id && assignment?.staple_id)
  const items = configured
    ? [assignment!.protein_name, assignment!.vegetable_name, assignment!.staple_name]
    : null
  const descrs = configured
    ? [assignment!.protein_descr, assignment!.vegetable_descr, assignment!.staple_descr]
    : null

  return (
    <div
      className="bg-white rounded-2xl shadow-sm overflow-hidden active:opacity-90"
      onClick={canEdit ? onEdit : undefined}
      style={canEdit ? { cursor: 'pointer' } : undefined}
    >
      <div className="flex items-center px-4 py-4" style={{ gap: '12px' }}>

        {/* Left: text — drives card height */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xl font-bold" style={{ color: VARIANT_COLORS[variant.code] ?? '#374151' }}>{variant.name}</span>
            {canEdit && <span className="text-gray-300 text-xl leading-none">›</span>}
          </div>
          <div className="space-y-1.5">
            {items ? items.map((val, idx) => {
              const descr = descrs?.[idx]
              const dotColor = VARIANT_COLORS[variant.code] ?? '#d1d5db'
              return (
                <div key={idx}>
                  <div className="flex items-center gap-2">
                    <span className="flex-shrink-0" style={{ width: 6, height: 6, borderRadius: '50%', background: configured ? dotColor : '#d1d5db' }} />
                    <span
                      className="text-[15px] leading-snug truncate"
                      style={{ color: configured ? '#374151' : '#64748B' }}
                    >
                      {descr || val}
                    </span>
                  </div>
                  {descr && (
                    <div className="text-[11px] text-gray-400 truncate ml-6">{val}</div>
                  )}
                </div>
              )
            }) : (
              <div className="text-[13px] text-gray-300 py-2">Tap to configure</div>
            )}
          </div>
        </div>

        {/* Right: bento image — fixed aspect-ratio box, never stretches */}
        <div
          style={{
            flexShrink: 0,
            alignSelf: 'center',
            width: '40%',
            maxWidth: 140,
            aspectRatio: '1 / 1',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bento-box.png"
            alt=""
            aria-hidden
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Single-variant editor sheet

type DraftRow = { protein_id: number | null; vegetable_id: number | null; staple_id: number | null }

function VariantEditorSheet({
  variant, dayName, dayIndex, weekStart, proteins, vegetables, staples, proteinVariant, assignments, onClose, onSaved,
}: {
  variant: Variant; dayName: string; dayIndex: number; weekStart: string
  proteins: Component[]; vegetables: Component[]; staples: Component[]
  proteinVariant: Record<string, string>
  assignments: Assignment[]; onClose: () => void; onSaved: () => void
}) {
  // Filter proteins to this variant: light → only light proteins, flavorful → only flavorful
  const filteredProteins = proteins.filter(p =>
    !proteinVariant[p.name] || proteinVariant[p.name] === variant.code
  )
  const existing = assignments.find(x => x.day_of_week === dayIndex && x.variant_id === variant.id)
  const [draft, setDraft] = useState<DraftRow>({
    protein_id:   existing?.protein_id   ?? null,
    vegetable_id: existing?.vegetable_id ?? null,
    staple_id:    existing?.staple_id    ?? null,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function handleSave() {
    const filled = [draft.protein_id, draft.vegetable_id, draft.staple_id].filter(x => x !== null).length
    if (filled > 0 && filled < 3) {
      setError('Protein, Vegetable, and Staple are all required.')
      return
    }
    setSaving(true); setError(null)

    if (draft.protein_id && draft.vegetable_id && draft.staple_id) {
      const { error: err } = await supabase
        .from('bento_weekly_menu_assignments')
        .upsert([{
          week_start: weekStart, day_of_week: dayIndex, variant_id: variant.id,
          protein_id: draft.protein_id, vegetable_id: draft.vegetable_id, staple_id: draft.staple_id,
        }], { onConflict: 'week_start,day_of_week,variant_id' })
      if (err) { setError(err.message); setSaving(false); return }
    } else if (filled === 0) {
      await supabase
        .from('bento_weekly_menu_assignments')
        .delete()
        .eq('week_start', weekStart)
        .eq('day_of_week', dayIndex)
        .eq('variant_id', variant.id)
    }
    setSaving(false)
    onSaved()
  }

  const titleColor = VARIANT_COLORS[variant.code] ?? '#374151'

  const content = (
    <div
      className="fixed flex flex-col justify-end"
      style={{ inset: 0, zIndex: 2147483647, background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100">
          <div>
            <div className="text-lg font-bold" style={{ color: titleColor }}>{variant.name}</div>
            <div className="text-xs text-gray-400 mt-0.5">{dayName}</div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 text-2xl leading-none w-9 h-9 flex items-center justify-center">×</button>
        </div>

        {/* Selectors */}
        <div className="px-4 pt-4 pb-3">
          {error && (
            <div className="px-3 py-2 mb-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
          )}
          <ComponentSelect label="Protein"   items={filteredProteins}   value={draft.protein_id}   onChange={val => setDraft(d => ({ ...d, protein_id:   val }))} />
          <ComponentSelect label="Vegetable" items={vegetables} value={draft.vegetable_id} onChange={val => setDraft(d => ({ ...d, vegetable_id: val }))} />
          <ComponentSelect label="Staple"    items={staples}    value={draft.staple_id}    onChange={val => setDraft(d => ({ ...d, staple_id:    val }))} />
        </div>

        {/* Actions */}
        <div className="px-4 pt-1 pb-2 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-3 pt-3">
            <button type="button" onClick={onClose}
              className="py-3 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-600 active:opacity-80">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="py-3 rounded-2xl text-sm font-semibold text-white active:opacity-90"
              style={{ background: saving ? '#d1d5db' : '#f97316' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}

// ─────────────────────────────────────────────────────────────────────────────
// Component select

function ComponentSelect({ label, items, value, onChange }: {
  label: string; items: Component[]; value: number | null; onChange: (id: number | null) => void
}) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="text-xs text-gray-400 w-20 flex-shrink-0">{label}</span>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white text-gray-700"
        style={{ fontSize: 16 }}
      >
        <option value="">Select {label}…</option>
        {items.map(c => <option key={c.id} value={c.id}>{c.description || c.name}{c.description ? ` — ${c.name}` : ''}</option>)}
      </select>
    </div>
  )
}
