import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(
  new URL('../app/bento/orders/[id]/edit/page.tsx', import.meta.url),
  'utf8',
)

const sectionStart = source.indexOf('{/* Date + Time */}')
const sectionEnd = source.indexOf('{/* Delivery fields */}', sectionStart)

assert.notEqual(sectionStart, -1, 'Edit Order must include the Date + Time section')
assert.notEqual(sectionEnd, -1, 'Edit Order Date + Time section must end before Delivery fields')

const section = source.slice(sectionStart, sectionEnd)

assert.match(
  section,
  /className="grid grid-cols-2 gap-2"/,
  'Date and time must remain in two equal columns on mobile',
)
assert.equal(
  (section.match(/className="min-w-0"/g) ?? []).length,
  2,
  'Both date/time grid cells must allow their contents to shrink',
)
assert.match(
  section,
  /<DatePickerField/,
  'Edit Order must use the shared desktop-safe date picker',
)
assert.match(
  section,
  /<TimePickerField/,
  'Edit Order must use the shared cross-platform time wheel',
)

console.log('Bento Edit Order mobile date/time layout check passed')
