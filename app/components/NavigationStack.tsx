'use client'

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react'

const DURATION = 280

type StackEntry = { id: string; path: string; element: React.ReactNode }

type NavCtx = {
  push: (path: string, element: React.ReactNode) => void
  pop: () => void
  replace: (path: string, element: React.ReactNode) => void
  popToRoot: () => void
  reset: () => void
  canPop: boolean
  currentPath: string
}

const Context = createContext<NavCtx | null>(null)

export function useNavigation() {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('useNavigation requires NavigationProvider')
  return ctx
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getTranslateX(el: HTMLElement): number {
  const inline = el.style.transform
  if (inline && inline !== 'none') {
    const m = inline.match(/translateX\((-?[\d.]+)px\)/)
    if (m) return parseFloat(m[1])
  }
  const mat = window.getComputedStyle(el).transform
  return !mat || mat === 'none' ? 0 : new DOMMatrix(mat).m41
}

// ── StackLayer ────────────────────────────────────────────────────────────────

function StackLayer({
  children,
  onPop,
  isLeaving,
  zIndex,
}: {
  children: React.ReactNode
  onPop: () => void
  isLeaving: boolean
  zIndex: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const animRef = useRef<Animation | null>(null)
  const onPopRef = useRef(onPop)
  onPopRef.current = onPop

  // Enter: slide in from right — fill:forwards keeps the end state without inline style tricks
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const a = el.animate(
      [{ transform: 'translateX(100%)' }, { transform: 'translateX(0px)' }],
      { duration: DURATION, easing: 'cubic-bezier(0.3,0,0.1,1)', fill: 'forwards' }
    )
    animRef.current = a
    a.onfinish = () => { if (animRef.current === a) animRef.current = null }
  }, [])

  // Leave: slide out to right
  useEffect(() => {
    if (!isLeaving) return
    const el = ref.current
    if (!el) return
    if (animRef.current) { animRef.current.cancel(); animRef.current = null }
    const from = getTranslateX(el)
    const to = window.innerWidth
    const duration = Math.max(150, ((to - from) / window.innerWidth) * DURATION)
    const a = el.animate(
      [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }],
      { duration, easing: 'cubic-bezier(0.4,0,0.8,1)', fill: 'forwards' }
    )
    animRef.current = a
  }, [isLeaving])

  // Edge swipe gesture (left-edge drag to go back)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let sx = 0, sy = 0, tracking = false, axis: 'h' | 'v' | null = null

    const onStart = (e: TouchEvent) => {
      if (e.touches[0].clientX > 30) return
      sx = e.touches[0].clientX
      sy = e.touches[0].clientY
      tracking = true
      axis = null
    }
    const onMove = (e: TouchEvent) => {
      if (!tracking) return
      const dx = e.touches[0].clientX - sx
      const dy = e.touches[0].clientY - sy
      if (!axis && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      }
      if (axis !== 'h' || dx <= 0) return
      if (animRef.current) { animRef.current.cancel(); animRef.current = null }
      el.style.transform = `translateX(${dx}px)`
    }
    const onEnd = (e: TouchEvent) => {
      if (!tracking || axis !== 'h') { tracking = false; return }
      tracking = false
      const dx = e.changedTouches[0].clientX - sx
      if (dx > window.innerWidth * 0.35) {
        onPopRef.current()
      } else {
        // spring back
        const from = getTranslateX(el)
        const a = el.animate(
          [{ transform: `translateX(${from}px)` }, { transform: 'translateX(0px)' }],
          { duration: 200, easing: 'cubic-bezier(0.3,0,0.1,1)', fill: 'forwards' }
        )
        animRef.current = a
        a.onfinish = () => { if (animRef.current === a) animRef.current = null }
      }
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    // passive: true so iOS Safari can start scroll immediately without waiting for JS
    // e.preventDefault() is only called after axis is confirmed horizontal, which
    // won't happen for vertical scrolls — safe to use passive here.
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [])

  return (
    <div
      data-stack-layer
      ref={ref}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100dvh',
        zIndex,
        background: '#f9fafb',
        transform: 'translateX(100%)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<StackEntry[]>([])
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set())

  // Lock document scroll when a layer is on top so iOS Safari doesn't scroll the page
  // behind the overlay. Must lock <html> not <body>: body overflow:hidden is an iOS
  // quirk that blocks scroll inside ALL children including position:fixed overlays;
  // html overflow:hidden only prevents document scroll and leaves fixed children alone.
  useEffect(() => {
    if (stack.length === 0) return
    document.documentElement.style.overflow = 'hidden'
    return () => { document.documentElement.style.overflow = '' }
  }, [stack.length])

  const pop = useCallback(() => {
    setStack(prev => {
      if (prev.length === 0) return prev
      const top = prev[prev.length - 1]
      setLeavingIds(s => new Set([...s, top.id]))
      setTimeout(() => {
        setStack(s => s.filter(e => e.id !== top.id))
        setLeavingIds(s => { const n = new Set(s); n.delete(top.id); return n })
      }, DURATION + 60)
      return prev
    })
  }, [])

  const push = useCallback((path: string, element: React.ReactNode) => {
    const id = String(Date.now())
    setStack(prev => [...prev, { id, path, element }])
  }, [])

  // Replace the top layer with a new page — new slides in from right, old slides out right behind it
  const replace = useCallback((path: string, element: React.ReactNode) => {
    const newId = String(Date.now())
    setStack(prev => {
      if (prev.length === 0) return [{ id: newId, path, element }]
      const topId = prev[prev.length - 1].id
      // Trigger leave animation after current render commit
      setTimeout(() => {
        setLeavingIds(s => new Set([...s, topId]))
        setTimeout(() => {
          setStack(s => s.filter(e => e.id !== topId))
          setLeavingIds(s => { const n = new Set(s); n.delete(topId); return n })
        }, DURATION + 60)
      }, 0)
      return [...prev, { id: newId, path, element }]
    })
  }, [])

  // Animate the top layer out then clear the whole stack (Home tap)
  const popToRoot = useCallback(() => {
    setStack(prev => {
      if (prev.length === 0) return prev
      const topId = prev[prev.length - 1].id
      setLeavingIds(s => new Set([...s, topId]))
      setTimeout(() => {
        setStack([])
        setLeavingIds(new Set())
      }, DURATION + 60)
      return prev
    })
  }, [])

  // Instantly clear all stack layers (emergency reset, not used for normal nav)
  const reset = useCallback(() => {
    setStack([])
    setLeavingIds(new Set())
  }, [])

  const currentPath = stack.length > 0 ? stack[stack.length - 1].path : '/'

  return (
    <Context.Provider value={{ push, pop, replace, popToRoot, reset, canPop: stack.length > 0, currentPath }}>
      {children}
      {stack.map((entry, i) => (
        <StackLayer
          key={entry.id}
          onPop={pop}
          isLeaving={leavingIds.has(entry.id)}
          zIndex={100 + i * 10}
        >
          {entry.element}
        </StackLayer>
      ))}
    </Context.Provider>
  )
}
