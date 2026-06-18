'use client'

import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { useNavigation } from './NavigationStack'
import { getPageElement } from '@/app/lib/stackPages'
import { useHideAmounts } from '@/app/hooks/useHideAmounts'
import { useRevenueRefresh } from '@/app/hooks/useRevenueRefresh'
import { formatAmount } from '@/app/lib/formatAmount'
import { formatGrowthPercent } from '@/app/lib/formatGrowthPercent'
import type { FeedMeDailyRevenue, FeedMeMtdSummary, FeedMe7DaySummary } from '@/lib/feedme/liveDailySales'

const RevenueTodayStack = lazy(() => import('@/app/revenue/RevenueTodayStack'))
const RevenueAnalyticsStack = lazy(() => import('@/app/revenue/RevenueAnalyticsStack'))

interface HeroCardProps {
  revenueTotal: number | null
  revenueYesterday: number | null
  growthPercent: number | null
  mtdRevenue: number | null
  mtdAverage: number | null
  bestDayRevenue: number | null
  revenueBento: number
  bentoOrders: number
  bentoCompleted: number
  bentoPercent: number
  feedMeRevenue: FeedMeDailyRevenue | null
  feedMeMtd: FeedMeMtdSummary | null
  feedMe7Day: FeedMe7DaySummary | null
}

const SLIDE_COUNT = 3
const ELASTIC = 0.35

// ── Temporary touch-debug instrumentation ───────────────────────────────────
// Enabled only when NEXT_PUBLIC_HERO_TOUCH_DEBUG=true (inlined at build time).
// When false, every debug branch short-circuits and the panel is not rendered,
// so production behaviour is unaffected. Remove once iOS Safari verification is done.
const HERO_TOUCH_DEBUG = process.env.NEXT_PUBLIC_HERO_TOUCH_DEBUG === 'true'

// Short human-readable description of a DOM node for logs / the panel.
function describeNode(n: EventTarget | null): string {
  const el = n as HTMLElement | null
  if (!el || !el.tagName) return String(n ?? 'null')
  const id = el.id ? `#${el.id}` : ''
  const cls =
    typeof el.className === 'string' && el.className
      ? `.${el.className.trim().split(/\s+/)[0]}`
      : ''
  const label = el.getAttribute?.('aria-label')
  return `${el.tagName.toLowerCase()}${id}${cls}${label ? `[${label}]` : ''}`
}

export default function HeroCard({
  revenueTotal,
  revenueYesterday,
  growthPercent,
  mtdRevenue,
  mtdAverage,
  bestDayRevenue,
  revenueBento,
  bentoOrders,
  bentoCompleted,
  bentoPercent,
  feedMeRevenue,
  feedMeMtd,
  feedMe7Day,
}: HeroCardProps) {
  const router = useRouter()
  const { push } = useNavigation()
  const [hidden, toggleHidden] = useHideAmounts()
  const [slide, setSlide] = useState(0)
  const [animating, setAnimating] = useState(false)

  // Auto-refresh revenue data every 60s (slides 1 & 2).
  // When refresh data is available, it takes precedence over initial SSR props.
  // On error, the hook preserves the last successful values — never blanks.
  const refreshed = useRevenueRefresh()

  // Merge: prefer live refresh data when available, fall back to server props.
  const mergedRevenueTotal =
    refreshed.daily?.revenueTotal !== undefined ? refreshed.daily.revenueTotal : revenueTotal
  const mergedRevenueYesterday =
    refreshed.daily?.revenueYesterday !== undefined ? refreshed.daily.revenueYesterday : revenueYesterday
  const mergedGrowthPercent =
    refreshed.daily?.growthPercent !== undefined ? refreshed.daily.growthPercent : growthPercent
  const mergedMtdRevenue =
    refreshed.mtd?.mtdRevenue !== undefined ? refreshed.mtd.mtdRevenue : mtdRevenue
  const mergedMtdAverage =
    refreshed.mtd?.mtdAverage !== undefined ? refreshed.mtd.mtdAverage : mtdAverage
  const mergedBestDayRevenue =
    refreshed.mtd?.bestDayRevenue !== undefined ? refreshed.mtd.bestDayRevenue : bestDayRevenue
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const tracking = useRef(false)
  const touchAxis = useRef<'h' | 'v' | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const containerWidth = useRef(0)

  const animIdRef = useRef(0)

  const pctPerSlide = 100 / SLIDE_COUNT

  // Refs mirror the latest state/props so the once-bound NATIVE touch listeners
  // (below) always read fresh values without rebinding on every render.
  const slideRef = useRef(0)
  const animatingRef = useRef(false)
  const startedOnControlRef = useRef(false)
  slideRef.current = slide
  animatingRef.current = animating
  const feedMeRevenueRef = useRef(feedMeRevenue)
  const feedMeMtdRef = useRef(feedMeMtd)
  const feedMe7DayRef = useRef(feedMe7Day)
  feedMeRevenueRef.current = feedMeRevenue
  feedMeMtdRef.current = feedMeMtd
  feedMe7DayRef.current = feedMe7Day

  // ── Debug instrumentation (no-op unless HERO_TOUCH_DEBUG) ───────────────────
  // Panel is updated via direct DOM writes (refs) — NEVER React state — so debug
  // mode cannot trigger a re-render mid-drag that would overwrite the inline
  // track transform. Gesture logic below is untouched.
  const dbgTargetRef = useRef<HTMLSpanElement>(null)
  const dbgStateRef = useRef<HTMLSpanElement>(null)
  const dbgIndexRef = useRef<HTMLSpanElement>(null)
  const dbgClickRef = useRef<HTMLSpanElement>(null)
  const dbgAxisLoggedRef = useRef(false)
  const dbgPdLoggedRef = useRef(false)

  const dbgLog = (...args: unknown[]) => {
    if (HERO_TOUCH_DEBUG) console.log('[hero-touch]', ...args)
  }
  const dbgPanel = (patch: { target?: string; state?: string; index?: string; click?: string }) => {
    if (!HERO_TOUCH_DEBUG) return
    if (patch.target !== undefined && dbgTargetRef.current) dbgTargetRef.current.textContent = patch.target
    if (patch.state !== undefined && dbgStateRef.current) dbgStateRef.current.textContent = patch.state
    if (patch.index !== undefined && dbgIndexRef.current) dbgIndexRef.current.textContent = patch.index
    if (patch.click !== undefined && dbgClickRef.current) dbgClickRef.current.textContent = patch.click
  }

  const goTo = (next: number) => {
    if (animatingRef.current || next === slideRef.current || next < 0 || next >= SLIDE_COUNT) return
    const el = trackRef.current
    if (!el) return
    dbgLog('carousel index change', slideRef.current, '→', next)
    dbgPanel({ index: `${next} (was ${slideRef.current})` })
    // Drive the transition entirely via inline style so React's style prop
    // (which writes to the same CSS properties) never causes a flash.
    el.style.transition = 'transform 0.3s cubic-bezier(0.3,0,0.1,1)'
    el.style.transform = `translateX(${-(next * pctPerSlide)}%)`
    setAnimating(true); animatingRef.current = true
    setSlide(next); slideRef.current = next
    animIdRef.current++
    const id = animIdRef.current
    setTimeout(() => {
      // Only cleanup if no newer animation started
      if (id !== animIdRef.current) return
      // Clear transition only — keep transform so there is no frame where
      // the track reverts to translateX(0) before React's next render.
      el.style.transition = ''
      setAnimating(false); animatingRef.current = false
    }, 320)
  }

  // ── Native touch listeners ──────────────────────────────────────────────────
  // React's synthetic onTouchMove is registered as a PASSIVE listener on the root,
  // so e.preventDefault() inside it is silently ignored. The carousel then relied
  // only on `touch-action: pan-y`, which iOS Safari does not honour reliably for a
  // horizontal swipe inside a vertically-scrollable page — the scroller claims any
  // slightly-diagonal gesture first and the swipe (and small-target taps) become
  // flaky. Binding NATIVE listeners with { passive: false } lets preventDefault()
  // actually claim the gesture once it is classified horizontal. This mirrors the
  // working pattern in PullToRefresh and NavigationStack.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
      tracking.current = true
      touchAxis.current = null
      containerWidth.current = el.offsetWidth
      // Taps that begin on a control (eye toggle, page dots) belong to that
      // button's own click handler — never hijack them as a card tap/swipe.
      startedOnControlRef.current = !!(e.target as HTMLElement | null)?.closest('button')

      if (HERO_TOUCH_DEBUG) {
        dbgAxisLoggedRef.current = false
        dbgPdLoggedRef.current = false
        const path = (e.composedPath?.() ?? []).map(describeNode).slice(0, 6).join(' > ')
        dbgLog('touchstart', {
          target: describeNode(e.target),
          startedOnControl: startedOnControlRef.current,
          composedPath: path,
        })
        dbgPanel({ target: `start: ${describeNode(e.target)}`, state: 'tracking (axis: ?)' })
      }
    }

    const onMove = (e: TouchEvent) => {
      if (!tracking.current || animatingRef.current || startedOnControlRef.current) return
      const dx = e.touches[0].clientX - touchStartX.current
      const dy = e.touches[0].clientY - touchStartY.current
      if (!touchAxis.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        touchAxis.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      }
      if (HERO_TOUCH_DEBUG && touchAxis.current && !dbgAxisLoggedRef.current) {
        dbgAxisLoggedRef.current = true
        dbgLog('axis classified', touchAxis.current, { dx: Math.round(dx), dy: Math.round(dy) })
        dbgPanel({
          target: `move: ${describeNode(e.target)}`,
          state: `tracking (axis: ${touchAxis.current})`,
        })
      }
      if (touchAxis.current !== 'h') return
      e.preventDefault() // effective: native non-passive listener — claims the swipe
      if (HERO_TOUCH_DEBUG && !dbgPdLoggedRef.current) {
        dbgPdLoggedRef.current = true
        dbgLog('preventDefault() executed (horizontal swipe claimed)')
        dbgPanel({ state: 'tracking (axis: h, preventDefault ✓)' })
      }
      const track = trackRef.current
      if (!track) return
      const cw = containerWidth.current
      if (cw <= 0) return
      const slideNow = slideRef.current
      const basePx = -(slideNow * cw)
      const maxPx = 0
      const minPx = -((SLIDE_COUNT - 1) * cw)

      // Clamp + elastic: never allow the track to move beyond valid slide bounds
      let offset = basePx + dx
      if (offset > maxPx) {
        offset = maxPx + (offset - maxPx) * ELASTIC
      } else if (offset < minPx) {
        offset = minPx + (offset - minPx) * ELASTIC
      }

      track.style.transition = 'none'
      track.style.transform = `translateX(${Math.round(offset)}px)`
    }

    const onEnd = (e: TouchEvent) => {
      const slideNow = slideRef.current

      if (HERO_TOUCH_DEBUG) {
        const endDx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
        const direction =
          touchAxis.current === 'h' ? (endDx > 0 ? 'right' : 'left')
          : touchAxis.current === 'v' ? 'vertical'
          : 'tap'
        const path = (e.composedPath?.() ?? []).map(describeNode).slice(0, 6).join(' > ')
        dbgLog('touchend', {
          target: describeNode(e.target),
          gesture: touchAxis.current ?? 'tap',
          direction,
          dx: Math.round(endDx),
          startedOnControl: startedOnControlRef.current,
          composedPath: path,
        })
        dbgPanel({ target: `end: ${describeNode(e.target)}`, state: `idle (last: ${direction})` })
      }

      // ── Tap detection (no directional classification = tap, not a swipe) ──
      if (tracking.current && touchAxis.current === null) {
        tracking.current = false
        // Control taps (eye / dots) are handled by their own onClick — don't navigate.
        if (startedOnControlRef.current) return
        if (slideNow === 0) {
          if (feedMeRevenueRef.current) {
            push('/revenue/today', <Suspense fallback={null}><RevenueTodayStack data={feedMeRevenueRef.current} /></Suspense>)
          } else {
            router.push('/revenue/today')
          }
        } else if (slideNow === 1) {
          push('/revenue/analytics', <Suspense fallback={null}><RevenueAnalyticsStack mtd={feedMeMtdRef.current} week={feedMe7DayRef.current} /></Suspense>)
        } else if (slideNow === 2) {
          const pe = getPageElement('/bento')
          if (pe) push('/bento', pe)
        }
        return
      }

      if (!tracking.current || touchAxis.current !== 'h') { tracking.current = false; return }
      tracking.current = false
      const dx = e.changedTouches[0].clientX - touchStartX.current
      const threshold = 50
      const track = trackRef.current
      if (!track) return

      if (slideNow > 0 && dx > threshold) {
        goTo(slideNow - 1)
      } else if (slideNow < SLIDE_COUNT - 1 && dx < -threshold) {
        goTo(slideNow + 1)
      } else {
        // Spring-back: animate entirely via inline style.
        track.style.transition = 'transform 0.25s ease-out'
        track.style.transform = `translateX(${-(slideNow * pctPerSlide)}%)`
        animIdRef.current++
        const id = animIdRef.current
        setTimeout(() => {
          if (id !== animIdRef.current) return
          track.style.transition = ''
        }, 260)
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
    // Listeners read live values via refs — bind once, never rebind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mtdRevenueLabel =
    mergedMtdRevenue === null ? '—' : `RM ${Math.floor(mergedMtdRevenue).toLocaleString('en-US')}`
  const mtdAverageLabel =
    mergedMtdAverage === null ? '—' : `RM ${Math.floor(mergedMtdAverage).toLocaleString('en-US')}`
  const bestDayLabel =
    mergedBestDayRevenue === null ? '—' : `RM ${Math.floor(mergedBestDayRevenue).toLocaleString('en-US')}`

  // FeedMe-derived: show "—" when yesterday/growth data is unavailable.
  // Uses merged values — live refresh data when available, server props as fallback.
  const revenueLabel = formatAmount(mergedRevenueTotal, hidden)
  // Privacy mode masks the Growth % too (alongside the Today/Yesterday amounts).
  // All numeric formatting goes through formatGrowthPercent so the rendered value
  // is consistent on every browser (never a raw float). Precedence: when hidden
  // and a real value exists → masked; otherwise formatGrowthPercent ("—" for no
  // baseline). Status badge stays computed from the raw mergedGrowthPercent below.
  const growthLabel =
    hidden && mergedGrowthPercent !== null ? '*****' : formatGrowthPercent(mergedGrowthPercent)
  // Status badge is derived from the SAME mergedGrowthPercent as the label, so
  // the two can never disagree. Null = no valid baseline → neutral "No Baseline",
  // never a misleading positive label like "Excellent".
  const revenueStatus =
    mergedGrowthPercent === null ? 'No Baseline'
    : mergedGrowthPercent > 20 ? 'Excellent'
    : mergedGrowthPercent > 10 ? 'Strong'
    : mergedGrowthPercent > 0 ? 'Good'
    : mergedGrowthPercent < 0 ? 'Weak'
    : 'Flat'
  const yesterdayLabel = formatAmount(mergedRevenueYesterday, hidden)

  return (
    <>
    <div
      ref={containerRef}
      className="rounded-2xl"
      style={{
        background: 'linear-gradient(150deg, #fb923c 0%, #f97316 45%, #ea580c 100%)',
        touchAction: 'pan-y',
        overflow: 'hidden',
      }}
    >
      <div className="px-0 pt-3 pb-2 overflow-hidden">
        <div
          ref={trackRef}
          className="flex"
          style={{
            width: `${SLIDE_COUNT * 100}%`,
            transform: `translateX(${-(slide * pctPerSlide)}%)`,
            transition: animating ? 'transform 0.3s cubic-bezier(0.3,0,0.1,1)' : 'none',
            willChange: 'transform',
          }}
        >
          {/* ═══ Slide 1: Revenue ═══ */}
          <div
            className="flex-shrink-0 flex flex-col px-5"
            style={{ width: `${pctPerSlide}%` }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-white/90">Today's Revenue</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold tracking-tight text-white leading-none">{revenueLabel}</div>
              <button
                type="button"
                onClick={() => {
                  if (HERO_TOUCH_DEBUG) {
                    const ts = new Date().toISOString().slice(11, 23)
                    dbgLog('eye button click received', ts)
                    dbgPanel({ click: ts })
                  }
                  toggleHidden()
                }}
                aria-label={hidden ? 'Show amounts' : 'Hide amounts'}
                className="flex-shrink-0 flex items-center justify-center w-10 h-10 -mr-2 opacity-70 hover:opacity-100 transition-opacity"
              >
                {hidden ? (
                  <EyeOff size={20} stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} />
                ) : (
                  <Eye size={20} stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} />
                )}
              </button>
            </div>
            <div className="flex-1 min-h-0" />
            <div className="flex items-end justify-between">
              <div className="grid grid-cols-[7rem_4rem] gap-2">
                <div>
                  <div className="text-[10px] text-orange-100/70 uppercase tracking-wide">Yesterday</div>
                  <div className="text-base font-bold text-white leading-tight whitespace-nowrap">{yesterdayLabel}</div>
                </div>
                <div>
                  <div className="text-[10px] text-orange-100/70 uppercase tracking-wide">Growth</div>
                  <div className="text-base font-bold text-white leading-tight whitespace-nowrap">{growthLabel}</div>
                </div>
              </div>
              <span className="bg-white/20 text-white text-xs font-medium rounded-full px-3 py-1">{revenueStatus}</span>
            </div>
          </div>

          {/* ═══ Slide 2: Month-to-Date ═══ */}
          <div
            className="flex-shrink-0 flex flex-col px-5"
            style={{ width: `${pctPerSlide}%` }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-white/90">Month-to-Date</div>
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-white leading-none">{mtdRevenueLabel}</div>
            </div>
            <div className="flex-1 min-h-0" />
            <div className="flex items-end justify-between">
              <div className="grid grid-cols-[7rem_4rem] gap-2">
                <div>
                  <div className="text-[10px] text-orange-100/70 uppercase tracking-wide">Avg Daily</div>
                  <div className="text-base font-bold text-white leading-tight whitespace-nowrap">{mtdAverageLabel}</div>
                </div>
                <div>
                  <div className="text-[10px] text-orange-100/70 uppercase tracking-wide">Best Day</div>
                  <div className="text-base font-bold text-white leading-tight whitespace-nowrap">{bestDayLabel}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Slide 3: Bento ═══ */}
          <div
            className="flex-shrink-0 flex flex-col px-5"
            style={{ width: `${pctPerSlide}%` }}
          >
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <div className="text-sm font-medium text-white/90 mb-2">Bento Revenue</div>
                <div className="text-3xl font-bold text-white leading-none">RM {revenueBento.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-white/70 leading-5 mb-2">Orders</div>
                <div className="text-3xl font-bold text-white leading-none">{bentoOrders}</div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-orange-100/90">Completion Rate</span>
                <span className="text-xs font-semibold text-white">{bentoPercent}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full bg-white" style={{ width: `${bentoPercent}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Page indicators */}
      <div className="flex items-center justify-center gap-1.5 pb-2.5">
        {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="rounded-full transition-all"
            style={{
              width: slide === i ? 16 : 5,
              height: 5,
              background: slide === i ? '#ffffff' : 'rgba(255,255,255,0.35)',
            }}
          />
        ))}
      </div>
    </div>

    {HERO_TOUCH_DEBUG && (
      <div
        style={{
          position: 'fixed',
          right: 8,
          bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
          zIndex: 9999,
          maxWidth: '70vw',
          padding: '8px 10px',
          borderRadius: 8,
          background: 'rgba(0,0,0,0.82)',
          color: '#fff',
          font: '11px/1.45 ui-monospace, Menlo, monospace',
          pointerEvents: 'none',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        <div style={{ color: '#fb923c', fontWeight: 700, marginBottom: 2 }}>HERO TOUCH DEBUG</div>
        <div>target: <span ref={dbgTargetRef}>—</span></div>
        <div>state: <span ref={dbgStateRef}>idle</span></div>
        <div>index: <span ref={dbgIndexRef}>{slide}</span></div>
        <div>eye click: <span ref={dbgClickRef}>—</span></div>
      </div>
    )}
    </>
  )
}
