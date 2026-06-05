'use client'

import { useState, useRef, useEffect } from 'react'

interface PullToRefreshProps {
  children: React.ReactNode
  onRefresh: () => Promise<void>
}

export default function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef = useRef(0)
  const pullingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const threshold = 60

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startYRef.current = e.touches[0].clientY
        pullingRef.current = true
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || refreshing) return
      const dist = e.touches[0].clientY - startYRef.current
      if (dist > 0 && window.scrollY === 0) {
        e.preventDefault()
        setPullDistance(Math.min(dist * 0.45, threshold + 30))
      }
    }

    const onTouchEnd = async () => {
      if (!pullingRef.current) return
      pullingRef.current = false

      if (pullDistance >= threshold && !refreshing) {
        setRefreshing(true)
        setPullDistance(threshold)
        await onRefresh()
        setRefreshing(false)
      }
      setPullDistance(0)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [pullDistance, refreshing, onRefresh])

  const showIndicator = pullDistance > 5 || refreshing
  const indicatorHeight = refreshing ? threshold : pullDistance

  return (
    <div ref={containerRef} style={{ overflowX: 'hidden' }}>
      <div
        style={{
          height: indicatorHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: refreshing || pullDistance === 0 ? 'height 0.3s ease' : 'none',
          overflow: 'hidden',
        }}
      >
        {showIndicator && (
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              border: '2.5px solid #f97316',
              borderTopColor: 'transparent',
              animation: refreshing ? 'ptr-spin 0.7s linear infinite' : 'none',
              transform: !refreshing ? `rotate(${(pullDistance / threshold) * 300}deg)` : undefined,
              transition: !refreshing ? 'none' : undefined,
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes ptr-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {children}
    </div>
  )
}
