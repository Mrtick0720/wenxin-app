'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface PageTransitionProps {
  children: React.ReactNode
}

const THRESHOLD = 60

export default function PageTransition({ children }: PageTransitionProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef = useRef(0)
  const pullingRef = useRef(false)

  const handleRefresh = useCallback(async () => {
    router.refresh()
    await new Promise(r => setTimeout(r, 800))
  }, [router])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop <= 1) {
        startYRef.current = e.touches[0].clientY
        pullingRef.current = true
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || refreshing) return
      const dist = e.touches[0].clientY - startYRef.current
      if (dist > 0 && el.scrollTop <= 1) {
        e.preventDefault()
        setPullDistance(Math.min(dist * 0.45, THRESHOLD + 30))
      }
    }

    const onTouchEnd = async () => {
      if (!pullingRef.current) return
      pullingRef.current = false
      if (pullDistance >= THRESHOLD && !refreshing) {
        setRefreshing(true)
        setPullDistance(THRESHOLD)
        await handleRefresh()
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
  }, [pullDistance, refreshing, handleRefresh])

  const indicatorHeight = refreshing ? THRESHOLD : pullDistance
  const showIndicator = indicatorHeight > 5

  return (
    <div className="page-slide-in" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        ref={containerRef}
        style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {/* Pull-to-refresh indicator */}
        <div
          style={{
            height: indicatorHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            transition: refreshing || pullDistance === 0 ? 'height 0.3s ease' : 'none',
          }}
        >
          {showIndicator && (
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: '2.5px solid #f97316',
                borderTopColor: 'transparent',
                animation: refreshing ? 'ptr-spin 0.7s linear infinite' : 'none',
                transform: !refreshing ? `rotate(${(pullDistance / THRESHOLD) * 300}deg)` : undefined,
              }}
            />
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
