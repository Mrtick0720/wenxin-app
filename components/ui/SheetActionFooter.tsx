'use client'

import { useKeyboardHeight } from '@/lib/hooks/useKeyboardHeight'

type Props = {
  children: React.ReactNode
  /** Extra Tailwind classes (e.g. "border-t" for sheets that need a visual divider). */
  className?: string
}

/**
 * Keyboard-aware footer for bottom sheets and full-screen overlays.
 *
 * Normal state  — paddingBottom = safe-area-inset-bottom + 12px
 * Keyboard open — paddingBottom = keyboardHeight + 12px, so buttons sit
 *                 just above the software keyboard on iOS Safari / PWA.
 *
 * Works on iPhone Safari, Android Chrome, and desktop (always 0 keyboard height).
 * Does NOT affect the bottom navigation bar — intended for use inside sheet/modal
 * contexts only.
 *
 * Usage:
 *   <SheetActionFooter className="border-t">
 *     <button>Cancel</button>
 *     <button>Save</button>
 *   </SheetActionFooter>
 */
export function SheetActionFooter({ children, className }: Props) {
  const kbHeight = useKeyboardHeight()

  return (
    <div
      className={`flex-shrink-0 bg-white px-4 pt-3${className ? ` ${className}` : ''}`}
      style={{
        paddingBottom: kbHeight > 0
          ? `${kbHeight + 12}px`
          : 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        transition: 'padding-bottom 0.15s ease-out',
      }}
    >
      {children}
    </div>
  )
}
