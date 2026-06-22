import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(
  new URL('../app/bento/unpaid/page.tsx', import.meta.url),
  'utf8',
)

assert.match(
  source,
  /flex-1 min-h-0 overflow-y-auto overscroll-contain/,
  'Unpaid page should provide its own vertical scroll container',
)
assert.match(
  source,
  /onClick=\{\(\) => \{ setSelectedBill\(bill\); setError\(null\) \}\}/,
  'Daily bill rows should open a detail sheet',
)

const detailStart = source.indexOf('{selectedBill &&')
assert.ok(detailStart >= 0, 'Daily bill detail sheet should exist')
const detailSource = source.slice(detailStart)
assert.match(
  detailSource,
  /Mark All Paid/,
  'Mark All Paid should appear inside daily bill detail',
)
assert.doesNotMatch(
  source.slice(0, detailStart),
  /Mark All Paid/,
  'Mark All Paid should not appear before the daily bill detail',
)

console.log('Bento unpaid page structure tests passed.')
