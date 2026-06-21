import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const migrationUrl = new URL(
  '../supabase/migrations/20260621_update_shaoxing_huadiao_catalog.sql',
  import.meta.url,
)

const sql = await readFile(fileURLToPath(migrationUrl), 'utf8')

assert.match(sql, /UPDATE\s+public\.purchase_catalog/i)
assert.match(sql, /name_ms\s*=\s*'Arak Shaoxing Huadiao'/)
assert.match(sql, /WHERE\s+name_zh\s*=\s*'绍兴花雕酒'/i)
assert.doesNotMatch(sql, /INSERT\s+INTO\s+public\.purchase_catalog/i)

console.log('Shaoxing catalog migration test passed.')
