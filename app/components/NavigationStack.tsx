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
// How long a dormant layer is kept alive after popToRoot. After TTL the layer is
// destroyed on next re-entry so stale data never silently re-surfaces after a long absence.
const BACKGROUND_TTL_MS = 10 * 60 * 1000
// Paths whose layers survive popToRoot as hidden-but-mounted React trees.
// Mounting is preserved so scroll position, loaded data, and selected tabs are
// restored instantly without a refetch. To enable another module add its path here —
// the algorithm requires no other changes.
const KEEP_ALIVE_PATHS = new Set(['/purchase'])

// Monotonic layer id. Date.now() can collide across a rapid push→replace→pop in
// the same millisecond, which made the cleanup filter remove the wrong entry and
// leave a layer stuck in the stack — a permanent full-screen touch-intercepting overlay.
let layerSeq = 0
const nextLayerId = () => `layer-${++layerSeq}`

type StackEntry = { id: string; path: string; element: React.ReactNode; isBackground?: boolean }

type NavCtx = {
  push: (path: string, element: React.ReactNode) => void
  pop: () => void
  replace: (path: string, element: React.ReactNode) => void
  resetTo: (path: string, element: React.ReactNode) => void
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
  isActive,
  isDormant,
  zIndex,
}: {
  children: React.ReactNode
  onPop: () => void
  isLeaving: boolean
  isActive: boolean
  isDormant: boolean
  zIndex: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const animRef = useRef<Animation | null>(null)
  const onPopRef = useRef(onPop)

  useEffect(() => {
    onPopRef.current = onPop
  }, [onPop])

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

  // Dormancy: the layer stays mounted so React state is preserved, but it must be
  // completely invisible and non-interactive. visibility:hidden (not display:none)
  // keeps layout alive so ResizeObserver and scroll position survive the hidden period.
  // On restore: instant reveal — layer is already at position 0, no enter animation needed.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (isDormant) {
      if (animRef.current) { animRef.current.cancel(); animRef.current = null }
      // Zero-duration WAAPI animation holds translateX(0) — overrides any previous leave fill
      el.animate([{ transform: 'translateX(0px)' }], { duration: 0, fill: 'forwards' })
      el.style.visibility = 'hidden'
    } else {
      el.style.visibility = ''
    }
  }, [isDormant])

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
      if (!axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        axis = Math.abs(dx) > Math.abs(dy) * 2 ? 'h' : 'v'
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
      // Only the active (top, non-leaving) layer is interactive. All others —
      // including dormant keep-alive layers — get pointer-events:none + inert +
      // aria-hidden so they cannot intercept touches, focus, or scroll events
      // on iOS Safari, where position:fixed overlays can still receive input
      // even when visually hidden without these three guards.
      aria-hidden={!isActive}
      inert={!isActive}
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
        pointerEvents: isActive ? 'auto' : 'none',
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
  // Tracks when each path was last backgrounded — used for Keep Alive TTL
  const backgroundTimestamps = useRef<Map<string, number>>(new Map())

  // visibleStack excludes dormant background layers. Used for canPop, currentPath,
  // and scroll-lock so that a parked-but-hidden layer doesn't incorrectly signal
  // that the user is "inside" a stack page when they are actually on Home.
  const visibleStack = stack.filter(e => !e.isBackground)

  // Lock document scroll when a layer is on top so iOS Safari doesn't scroll the page
  // behind the overlay. Must lock <html> not <body>: body overflow:hidden is an iOS
  // quirk that blocks scroll inside ALL children including position:fixed overlays;
  // html overflow:hidden only prevents document scroll and leaves fixed children alone.
  useEffect(() => {
    if (visibleStack.length === 0) return
    document.documentElement.style.overflow = 'hidden'
    return () => { document.documentElement.style.overflow = '' }
  }, [visibleStack.length])

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
    const id = nextLayerId()
    setStack(prev => [...prev, { id, path, element }])
  }, [])

  // Replace the top layer with a new page — new slides in from right, old slides out right behind it
  const replace = useCallback((path: string, element: React.ReactNode) => {
    const newId = nextLayerId()
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

  // Navigate to a tab root. Reuses a background layer for the path if it is a
  // Keep Alive candidate, still within TTL, and a matching dormant layer exists.
  // Otherwise creates a fresh layer (original behavior).
  const resetTo = useCallback((path: string, element: React.ReactNode) => {
    const ts = backgroundTimestamps.current.get(path)
    const isFresh = KEEP_ALIVE_PATHS.has(path) && ts !== undefined && Date.now() - ts < BACKGROUND_TTL_MS

    setLeavingIds(new Set())
    setStack(prev => {
      if (isFresh) {
        const idx = prev.findIndex(e => e.path === path && e.isBackground)
        if (idx !== -1) {
          backgroundTimestamps.current.delete(path)
          return [{ ...prev[idx], isBackground: false }]
        }
      }
      return [{ id: nextLayerId(), path, element }]
    })
  }, [])

  // Animate the top layer out, then park KEEP_ALIVE_PATHS entries as dormant
  // background and destroy everything else (Home tap).
  const popToRoot = useCallback(() => {
    setStack(prev => {
      if (prev.length === 0) return prev
      const topId = prev[prev.length - 1].id
      setLeavingIds(s => new Set([...s, topId]))
      setTimeout(() => {
        const now = Date.now()
        setStack(s => {
          const survivors = s.filter(e => KEEP_ALIVE_PATHS.has(e.path))
          survivors.forEach(e => backgroundTimestamps.current.set(e.path, now))
          return survivors.map(e => ({ ...e, isBackground: true }))
        })
        setLeavingIds(new Set())
      }, DURATION + 60)
      return prev
    })
  }, [])

  // Instantly clear all stack layers (emergency reset, not used for normal nav)
  const reset = useCallback(() => {
    setStack([])
    setLeavingIds(new Set())
    backgroundTimestamps.current.clear()
  }, [])

  const currentPath = visibleStack.length > 0 ? visibleStack[visibleStack.length - 1].path : '/'

  // The active layer is the topmost one that is NOT leaving and NOT a dormant background.
  // Everything below it, every exiting layer, and every background layer is inactive
  // (pointer-events:none). When no visible layer is active, the base content (Home) is interactive.
  let activeIdx = -1
  for (let i = stack.length - 1; i >= 0; i--) {
    if (!leavingIds.has(stack[i].id) && !stack[i].isBackground) { activeIdx = i; break }
  }

  return (
    <Context.Provider value={{ push, pop, replace, resetTo, popToRoot, reset, canPop: visibleStack.length > 0, currentPath }}>
      {children}
      {stack.map((entry, i) => (
        <StackLayer
          key={entry.id}
          onPop={pop}
          isLeaving={leavingIds.has(entry.id)}
          isActive={i === activeIdx}
          isDormant={!!entry.isBackground}
          zIndex={100 + i * 10}
        >
          {entry.element}
        </StackLayer>
      ))}
    </Context.Provider>
  )
}
