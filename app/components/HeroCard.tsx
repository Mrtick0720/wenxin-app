'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface HeroCardProps {
  revenueTotal: number
  revenueDineIn: number
  revenueBento: number
  bentoOrders: number
  bentoCompleted: number
  bentoPercent: number
}

const SLIDE_COUNT = 3

export default function HeroCard({
  revenueTotal,
  revenueDineIn,
  revenueBento,
  bentoOrders,
  bentoCompleted,
  bentoPercent,
}: HeroCardProps) {
  const router = useRouter()
  const [slide, setSlide] = useState(0)
  const [animating, setAnimating] = useState(false)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const tracking = useRef(false)
  const touchAxis = useRef<'h' | 'v' | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const goTo = (next: number) => {
    if (animating || next === slide || next < 0 || next >= SLIDE_COUNT) return
    setAnimating(true)
    setSlide(next)
    setTimeout(() => setAnimating(false), 320)
  }

  const slidePct = -(slide * (100 / SLIDE_COUNT))

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    tracking.current = true
    touchAxis.current = null
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
    const container = containerRef.current
    if (!el || !container) return
    const containerW = container.offsetWidth
    const basePx = slide * -(containerW / SLIDE_COUNT)
    const clamped = slide === 0 ? Math.min(0, dx)
      : slide === SLIDE_COUNT - 1 ? Math.max(0, dx)
      : dx
    el.style.transition = 'none'
    el.style.transform = `translateX(${basePx + clamped}px)`
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!tracking.current || touchAxis.current !== 'h') { tracking.current = false; return }
    tracking.current = false
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const threshold = 60
    const el = trackRef.current
    if (!el) return

    if (slide > 0 && dx > threshold) goTo(slide - 1)
    else if (slide < SLIDE_COUNT - 1 && dx < -threshold) goTo(slide + 1)
    else {
      el.style.transition = 'transform 0.28s cubic-bezier(0.3,0,0.1,1)'
      el.style.transform = `translateX(${slidePct}%)`
    }
  }

  const dineInAvg = revenueDineIn > 0 ? Math.round(revenueDineIn / 42) : 0

  return (
    <div
      ref={containerRef}
      className="rounded-2xl relative"
      style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1a1a2e 100%)', touchAction: 'pan-y', overflow: 'hidden' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Status badge — absolute top-right */}
      <div className="absolute top-3 right-4 z-10">
        {slide === 0 && (
          <span className="text-[10px] font-semibold text-green-400 px-2.5 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.15)' }}>
            Open
          </span>
        )}
        {slide === 1 && (
          <span className="text-[10px] font-semibold text-green-400 px-2.5 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.15)' }}>
            Open
          </span>
        )}
        {slide === 2 && (
          <span className="text-[10px] font-semibold text-orange-400 px-2.5 py-1 rounded-full" style={{ background: 'rgba(249,115,22,0.15)' }}>
            In Progress
          </span>
        )}
      </div>

      <div className="px-4 pt-3 pb-2">
        {/* Slides track — width = SLIDE_COUNT * 100% */}
        <div
          ref={trackRef}
          className="flex"
          style={{
            width: `${SLIDE_COUNT * 100}%`,
            transform: `translateX(${slidePct}%)`,
            transition: animating ? 'transform 0.3s cubic-bezier(0.3,0,0.1,1)' : 'none',
          }}
        >
          {/* ── Slide 1: Revenue Today ── */}
          <div className="flex-shrink-0 flex items-center justify-between" style={{ width: `${100 / SLIDE_COUNT}%` }}>
            <div>
              <div className="text-xs text-slate-400 mb-1">Today&apos;s Revenue</div>
              <div className="text-3xl font-bold tracking-tight text-white">RM {revenueTotal.toLocaleString()}</div>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                <span className="text-green-400 font-medium">+12%</span>
                <span className="text-slate-500">vs yesterday (RM 7,614)</span>
              </div>
            </div>
            <button
              onClick={() => router.push('/reports')}
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.08)' }}
              aria-label="Reports"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </button>
          </div>

          {/* ── Slide 2: Dine-in Breakdown ── */}
          <div className="flex-shrink-0" style={{ width: `${100 / SLIDE_COUNT}%` }}>
            <div className="text-sm font-semibold text-white mb-3">Dine-in</div>
            <div className="text-2xl font-bold text-white mb-3">42 Orders</div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Revenue</span>
                <span className="text-white font-medium">RM {revenueDineIn.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Avg Ticket</span>
                <span className="text-white font-medium">RM {dineInAvg}</span>
              </div>
            </div>
          </div>

          {/* ── Slide 3: Bento Breakdown ── */}
          <div className="flex-shrink-0" style={{ width: `${100 / SLIDE_COUNT}%` }}>
            <div className="text-sm font-semibold text-white mb-3">Bento</div>
            <div className="text-2xl font-bold text-white mb-3">{bentoOrders} Orders</div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Revenue</span>
                <span className="text-white font-medium">RM {revenueBento.toLocaleString()}</span>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400">Completion</span>
                  <span className="text-white font-medium">{bentoPercent}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1">
                  <div className="h-1 rounded-full bg-orange-400" style={{ width: `${bentoPercent}%` }} />
                </div>
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
