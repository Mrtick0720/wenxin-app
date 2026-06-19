export type BottomTabAction = 'home' | 'tab-root' | 'noop'

export function resolveBottomTabAction({
  href,
  currentPath,
}: {
  href: string
  currentPath: string
}): BottomTabAction {
  if (href === '/') return 'home'
  if (currentPath === href) return 'noop'
  return 'tab-root'
}
