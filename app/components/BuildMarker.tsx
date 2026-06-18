'use client'

// TEMPORARY build marker — always visible (NOT gated behind any debug flag).
// Its sole purpose is to prove which build a device actually loaded and whether
// NEXT_PUBLIC_HERO_TOUCH_DEBUG was inlined at build time. Remove once the iOS
// Safari touch verification is finished.
export default function BuildMarker() {
  const commit = process.env.NEXT_PUBLIC_BUILD_COMMIT ?? 'n/a'
  const builtAt = process.env.NEXT_PUBLIC_BUILD_TIME ?? 'n/a'
  const heroDebug = process.env.NEXT_PUBLIC_HERO_TOUCH_DEBUG ?? '(unset)'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 99999,
        padding: '3px 7px',
        background: heroDebug === 'true' ? '#16a34a' : '#dc2626',
        color: '#fff',
        font: '10px/1.3 ui-monospace, Menlo, monospace',
        borderBottomRightRadius: 6,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      build {commit} · debug={heroDebug} · {builtAt.slice(5, 16).replace('T', ' ')}
    </div>
  )
}
