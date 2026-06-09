'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useNavigation } from './NavigationStack'
import { getPageElement } from '@/app/lib/stackPages'

interface HeroCardProps {
  revenueTotal: number
  revenueDineIn: number
  revenueBento: number
  bentoOrders: number
  bentoCompleted: number
  bentoPercent: number
}

const SLIDE_COUNT = 3
const ELASTIC = 0.35

export default function HeroCard({
  revenueTotal,
  revenueDineIn,
  revenueBento,
  bentoOrders,
  bentoCompleted,
  bentoPercent,
}: HeroCardProps) {
  const router = useRouter()
  const { push } = useNavigation()
  const [slide, setSlide] = useState(0)
  const [animating, setAnimating] = useState(false)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const tracking = useRef(false)
  const touchAxis = useRef<'h' | 'v' | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const containerWidth = useRef(0)

  const animIdRef = useRef(0)

  const goTo = (next: number) => {
    if (animating || next === slide || next < 0 || next >= SLIDE_COUNT) return
    const el = trackRef.current
    if (!el) return
    // Drive the transition entirely via inline style so React's style prop
    // (which writes to the same CSS properties) never causes a flash.
    el.style.transition = 'transform 0.3s cubic-bezier(0.3,0,0.1,1)'
    el.style.transform = `translateX(${-(next * pctPerSlide)}%)`
    setAnimating(true)
    setSlide(next)
    animIdRef.current++
    const id = animIdRef.current
    setTimeout(() => {
      // Only cleanup if no newer animation started
      if (id !== animIdRef.current) return
      // Clear transition only — keep transform so there is no frame where
      // the track reverts to translateX(0) before React's next render.
      el.style.transition = ''
      setAnimating(false)
    }, 320)
  }

  const pctPerSlide = 100 / SLIDE_COUNT

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    tracking.current = true
    touchAxis.current = null
    // Cache width at touch start — avoids forced layout during drag
    containerWidth.current = containerRef.current?.offsetWidth ?? 0
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!tracking.current || animating) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    if (!touchAxis.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      touchAxis.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
    }
    if (touchAxis.current !== 'h') return
    e.preventDefault()
    const el = trackRef.current
    if (!el) return
    const cw = containerWidth.current
    if (cw <= 0) return
    const basePx = -(slide * cw)
    const maxPx = 0
    const minPx = -((SLIDE_COUNT - 1) * cw)

    // Clamp + elastic: never allow the track to move beyond valid slide bounds
    let offset = basePx + dx
    if (offset > maxPx) {
      // Past first slide (right edge) — rubber-band resistance
      offset = maxPx + (offset - maxPx) * ELASTIC
    } else if (offset < minPx) {
      // Past last slide (left edge) — rubber-band resistance
      offset = minPx + (offset - minPx) * ELASTIC
    }

    el.style.transition = 'none'
    el.style.transform = `translateX(${Math.round(offset)}px)`
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    // ── Tap detection (no directional classification = tap, not a swipe) ──
    if (tracking.current && touchAxis.current === null) {
      tracking.current = false
      if (slide === 1) {
        const el = getPageElement('/dine-in')
        if (el) push('/dine-in', el)
      } else if (slide === 2) {
        const el = getPageElement('/bento')
        if (el) push('/bento', el)
      }
      // Slide 0: existing reports button handles its own navigation
      return
    }

    if (!tracking.current || touchAxis.current !== 'h') { tracking.current = false; return }
    tracking.current = false
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const threshold = 50
    const el = trackRef.current
    if (!el) return

    if (slide > 0 && dx > threshold) {
      goTo(slide - 1)
    } else if (slide < SLIDE_COUNT - 1 && dx < -threshold) {
      goTo(slide + 1)
    } else {
      // Spring-back: animate entirely via inline style.
      // No React state change — avoids React style prop overwriting inline values.
      el.style.transition = 'transform 0.25s ease-out'
      el.style.transform = `translateX(${-(slide * pctPerSlide)}%)`
      animIdRef.current++
      const id = animIdRef.current
      setTimeout(() => {
        if (id !== animIdRef.current) return
        // Clear transition only — keep transform to avoid translateX(0) flash
        el.style.transition = ''
      }, 260)
    }
  }

  const dineInAvg = revenueDineIn > 0 ? Math.round(revenueDineIn / 42) : 0

  return (
    <div
      ref={containerRef}
      className="rounded-2xl"
      style={{
        background: 'linear-gradient(135deg, #1e3a5c 0%, #162238 60%, #1a1818 100%)',
        touchAction: 'pan-y',
        overflow: 'hidden',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
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
          {/* ═══ Slide 1: Revenue Today ═══ */}
          <div
            className="flex-shrink-0 flex flex-col justify-between px-5"
            style={{ width: `${pctPerSlide}%` }}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-white">Today&apos;s Revenue</div>
                <button
                  onClick={() => router.push('/reports')}
                  className="opacity-50 hover:opacity-100 transition-opacity"
                  aria-label="Reports"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 16 10 10 15 13 20 5" />
                  </svg>
                </button>
              </div>
              <div className="text-3xl font-bold tracking-tight text-white">
                RM {revenueTotal.toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[13px] pb-0.5">
              <span className="text-green-400 font-medium">+12%</span>
              <span className="text-slate-500">vs yesterday (RM 7,614)</span>
            </div>
          </div>

          {/* ═══ Slide 2: Dine-in Breakdown ═══ */}
          <div
            className="flex-shrink-0 px-5"
            style={{ width: `${pctPerSlide}%` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-white">Dine-in</div>
              <span className="text-xs text-emerald-500/70">Active</span>
            </div>
            <div className="text-2xl font-bold text-white mb-3">42 Orders</div>
            <div className="space-y-1.5">
              <div className="flex gap-2 text-xs">
                <span className="text-slate-400 w-[72px] flex-shrink-0">Revenue</span>
                <span className="text-white font-medium">RM {revenueDineIn.toLocaleString()}</span>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="text-slate-400 w-[72px] flex-shrink-0">Avg Ticket</span>
                <span className="text-white font-medium">RM {dineInAvg}</span>
              </div>
            </div>
          </div>

          {/* ═══ Slide 3: Bento Breakdown ═══ */}
          <div
            className="flex-shrink-0 px-5"
            style={{ width: `${pctPerSlide}%` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-white">Bento</div>
              <span className="text-xs text-orange-400/80">Prepping</span>
            </div>
            <div className="text-2xl font-bold text-white mb-3">{bentoOrders} Orders</div>
            <div className="space-y-1.5">
              <div className="flex gap-6 text-xs">
                <span className="text-slate-400">Revenue</span>
                <span className="text-white font-medium">RM {revenueBento.toLocaleString()}</span>
              </div>
              <div className="flex gap-6 text-xs">
                <span className="text-slate-400">Completion</span>
                <span className="text-white font-medium">{bentoPercent}%</span>
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
              background: slide === i ? '#f97316' : 'rgba(255,255,255,0.25)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
