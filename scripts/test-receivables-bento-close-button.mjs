import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(
  new URL('../app/receivables/ReceivablesClient.tsx', import.meta.url),
  'utf8',
)

assert.match(
  source,
  /aria-label="Close bento receivable detail"/,
  'Bento receivable detail should have an accessible close button',
)
assert.match(
  source,
  /background:\s*'#4b5563'[\s\S]*color:\s*'#fff'[\s\S]*WebkitAppearance:\s*'none'/,
  'Close button should use Safari-safe solid colors and reset native appearance',
)
assert.match(
  source,
  /flex flex-col items-center[\s\S]*aria-label="Close bento receivable detail"[\s\S]*bg-white rounded-t-3xl/,
  'Close button should sit above and outside the bottom sheet',
)

console.log('Receivables Bento close button test passed.')
