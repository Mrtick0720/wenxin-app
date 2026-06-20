import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../app/layout.tsx', import.meta.url),
  'utf8',
)

if (!/<html[\s\S]*?suppressHydrationWarning/.test(source)) {
  console.error('FAIL: root <html> must tolerate browser-injected attributes before hydration')
  process.exit(1)
}

console.log('Root hydration guard: 1 passed, 0 failed')
