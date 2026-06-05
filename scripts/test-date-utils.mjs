import assert from 'node:assert/strict'
import { todayLocalStr } from '../lib/dateUtils.ts'

assert.equal(
  todayLocalStr(new Date('2030-01-02T00:30:00+08:00')),
  '2030-01-02',
  'todayLocalStr can be evaluated against an explicit local-time Date'
)

console.log('date utility tests passed')
