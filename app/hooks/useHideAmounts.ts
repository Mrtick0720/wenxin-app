'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'wenxin:hideAmounts'

function readStored(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeStored(hidden: boolean) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0')
  } catch {
    // Silently ignore storage errors (private browsing, quota, etc.)
  }
}

export function useHideAmounts(): [boolean, () => void] {
  const [hidden, setHidden] = useState(false)

  // Hydrate from localStorage on mount (avoids SSR mismatch by reading
  // on the client only via useEffect).
  useEffect(() => {
    setHidden(readStored())
  }, [])

  const toggle = useCallback(() => {
    setHidden(prev => {
      const next = !prev
      writeStored(next)
      return next
    })
  }, [])

  return [hidden, toggle]
}
