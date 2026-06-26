import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../app/purchase/PurchaseClient.tsx', import.meta.url),
  'utf8',
)

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${message}`)
  }
}

assert(
  source.includes('new ResizeObserver(measureActivePanel)'),
  'active Purchase carousel panel is observed for height changes',
)
assert(
  source.includes("overflowX: 'clip', overflowY: 'hidden'"),
  'inactive carousel panels cannot extend the vertical scroll range',
)
assert(
  source.includes("const carouselPanelStyle = { width: `${pctPerSlide}%`, flexShrink: 0, alignSelf: 'flex-start' as const, height: 'max-content' }"),
  'carousel panels keep their own natural height instead of stretching to the tallest tab',
)
assert(
  source.includes('scrollRef.current?.scrollTo({ top: 0 })'),
  'switching Purchase tabs resets inherited vertical scroll',
)
assert(
  source.includes("paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px))'"),
  'scroll container keeps one add-button-safe bottom clearance',
)
assert(
  !source.includes('Bottom spacer — tall enough'),
  'Purchase scroll region has no duplicate trailing bottom spacer',
)

console.log(`Purchase scroll boundary: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
