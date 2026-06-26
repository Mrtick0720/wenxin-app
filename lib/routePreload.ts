export type RouteLoader = () => Promise<unknown>

export function preloadRouteLoaders(loaders: RouteLoader[]) {
  for (const load of loaders) {
    void load().catch(() => undefined)
  }
}

/**
 * Staggered idle-time JS chunk preloader.
 *
 * Each loader is a () => import('...') factory. Calling it triggers the browser
 * to download and cache the JS chunk — it does NOT mount any component or fetch
 * any application data. Supabase queries and server actions only run when the
 * component actually mounts inside a StackLayer.
 *
 * Scheduling:
 * - Skipped entirely on save-data mode or slow (2g / slow-2g) connections.
 * - Each loader fires after (baseDelayMs + index * stepMs).
 * - If requestIdleCallback is available, the actual import() is deferred to the
 *   next idle frame at that time — so it never runs mid-layout or mid-paint.
 * - Falls back to plain setTimeout when requestIdleCallback is absent (old Safari).
 *
 * Loaders are idempotent: calling the same import() again resolves the
 * already-cached module — the browser never downloads the chunk twice.
 *
 * Returns a cancel function that clears pending timers (useful for effect cleanup).
 */
export function preloadStaggered(
  loaders: RouteLoader[],
  baseDelayMs: number,
  stepMs: number,
): () => void {
  // Connection quality guard — (navigator as any) because the Network Information
  // API is not in TypeScript's lib but is present in all Chromium-based browsers.
  const conn = (navigator as any).connection as
    | { saveData?: boolean; effectiveType?: string }
    | undefined
  if (conn?.saveData) return () => undefined
  const et = conn?.effectiveType
  if (et === '2g' || et === 'slow-2g') return () => undefined

  const timers: ReturnType<typeof setTimeout>[] = []

  loaders.forEach((load, i) => {
    const delay = baseDelayMs + i * stepMs
    const tid = setTimeout(() => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => void load().catch(() => undefined))
      } else {
        void load().catch(() => undefined)
      }
    }, delay)
    timers.push(tid)
  })

  return () => timers.forEach(clearTimeout)
}
