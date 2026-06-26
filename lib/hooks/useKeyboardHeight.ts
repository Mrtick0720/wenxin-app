'use client'

import { useState, useEffect } from 'react'

/**
 * Returns the height in pixels occupied by the on-screen keyboard.
 * Returns 0 on desktop, when the keyboard is closed, or in browsers that
 * don't support visualViewport.
 *
 * Uses window.innerHeight - visualViewport.height - visualViewport.offsetTop.
 * The offsetTop term handles the iOS Safari quirk where the viewport can
 * scroll upward slightly when the keyboard opens.
 *
 * Small deltas (< 50px) are clamped to 0 to ignore URL-bar hide/show noise.
 *
 * @param active - set to false to skip attaching listeners (e.g. when sheet is closed)
 */
export function useKeyboardHeight(active = true): number {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (!active) return
    const vv = window.visualViewport
    if (!vv) return

    function update() {
      const kh = window.innerHeight - vv!.height - vv!.offsetTop
      setHeight(kh > 50 ? kh : 0)
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [active])

  return height
}
