import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

const componentPath = 'app/components/DateTimePickerFields.tsx'
const component = await readFile(new URL(`../${componentPath}`, import.meta.url), 'utf8').catch(() => '')

assert.match(component, /export function DatePickerField/, 'DatePickerField must exist')
assert.match(component, /showPicker\(\)/, 'DatePickerField must open the picker from its visible trigger')
assert.match(component, /export function TimePickerField/, 'TimePickerField must exist')
assert.match(component, /Array\.from\(\{ length: 24 \}/, 'Time picker must expose 24 hours')
assert.match(component, /Array\.from\(\{ length: 60 \}/, 'Time picker must expose every minute')
assert.match(component, /snap-y snap-mandatory/, 'Time columns must use vertical scroll snapping')
assert.match(component, /createPortal/, 'Time picker must render above page and stack layers')
assert.match(component, /normalizeTimeValue/, 'Stored time values must normalize to HH:mm')
assert.doesNotMatch(component, /type="time"/, 'TimePickerField must not invoke a browser-native time picker')

const files = execFileSync('rg', ['--files', 'app', '-g', '*.tsx'], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean)
  .filter(file => file !== componentPath)

const violations = []
for (const file of files) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8')
  const inputs = source.match(/<input\b[\s\S]*?\/>/g) ?? []
  for (const input of inputs) {
    if (/type=["']time["']/.test(input)) violations.push(`${file}: native time input`)
    if (/type=["']date["']/.test(input) && !/\bdisabled\b/.test(input)) {
      violations.push(`${file}: clickable native date input`)
    }
  }
}

assert.deepEqual(
  violations,
  [],
  `All clickable date/time fields must use shared pickers:\n${violations.join('\n')}`,
)

console.log('App-wide date/time picker contract passed')
