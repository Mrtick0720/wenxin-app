/**
 * Import bento menu pool TSV → Supabase.
 *
 * Reads /private/tmp/bento-menu-pool-raw.tsv and inserts into:
 *   1. bento_proteins / bento_vegetables / bento_staples  (Component Library)
 *   2. bento_menu_library                                 (Menu Library, proteins only)
 *
 * TSV structure (tab-separated, 4 columns):
 *   Col 1: 清淡系列 Light   → proteins  +  menu_library(variant=light)
 *   Col 2: 风味系列 Flavorful → proteins  +  menu_library(variant=flavorful)
 *   Col 3: 蔬菜 Vegetables    → bento_vegetables only (no library variant)
 *   Col 4: 主食 Staples       → bento_staples only    (no library variant)
 *
 * Usage:
 *   npx tsx scripts/import-bento-menu-pool.ts
 *   npx tsx scripts/import-bento-menu-pool.ts --dry-run
 *
 * Env: reads .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 */

import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// ── Load env ────────────────────────────────────────────────────────────────
try {
  process.loadEnvFile(resolve(process.cwd(), '.env.local'))
} catch {
  // env may already be set
}

const DRY_RUN = process.argv.includes('--dry-run')

// ── Types ───────────────────────────────────────────────────────────────────
interface DishRecord {
  nameZh: string
  nameEn: string
}

interface ColSpec {
  colIndex: number        // 0-based column index in TSV
  variantCode: string | null  // 'light' | 'flavorful' | null (for veg/staples)
  componentTable: string  // 'bento_proteins' | 'bento_vegetables' | 'bento_staples'
}

// ── Parse TSV ───────────────────────────────────────────────────────────────
const TSV_PATH = '/private/tmp/bento-menu-pool-raw.tsv'

function parseTsv(path: string): { columns: ColSpec[]; rows: string[][] } {
  const raw = readFileSync(path, 'utf-8')

  // The TSV uses quoted fields with embedded newlines.
  // Fields are separated by \t\t (two tabs) between each pair.
  // Parse with a state machine.
  const logicalRows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  let justClosedQuote = false // true right after we saw closing "

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    const next = i + 1 < raw.length ? raw[i + 1] : ''

    if (ch === '"') {
      if (!inQuotes) {
        inQuotes = true
        currentField = ''
        justClosedQuote = false
        continue
      } else if (next === '"') {
        // Escaped quote inside field
        currentField += '"'
        i++
        continue
      } else {
        // Closing quote
        inQuotes = false
        justClosedQuote = true
        continue
      }
    }

    if (inQuotes) {
      currentField += ch
      justClosedQuote = false
      continue
    }

    // Outside quotes
    if (ch === '\t') {
      if (justClosedQuote) {
        // Tab right after closing quote — completes the field
        currentRow.push(currentField)
        currentField = ''
        justClosedQuote = false
      } else {
        // Tab without a preceding close-quote — empty cell
        currentRow.push('')
      }
    } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      if (ch === '\r') i++
      // End of logical row
      if (justClosedQuote) {
        currentRow.push(currentField)
        currentField = ''
        justClosedQuote = false
      }
      if (currentRow.length > 0) {
        logicalRows.push(currentRow)
        currentRow = []
      }
    }
    // Ignore other chars outside quotes
  }

  // Flush any remaining
  if (justClosedQuote) {
    currentRow.push(currentField)
  }
  if (currentRow.length > 0) {
    logicalRows.push(currentRow)
  }

  console.log(`Parsed ${logicalRows.length} logical rows (${raw.split(/\r?\n/).length} physical lines)`)

  // First logical row is header
  const header = logicalRows[0]
  console.log(`Header has ${header.length} columns`)

  const columns: ColSpec[] = [
    { colIndex: 0, variantCode: 'light',     componentTable: 'bento_proteins' },
    { colIndex: 2, variantCode: 'flavorful', componentTable: 'bento_proteins' },
    { colIndex: 4, variantCode: null,        componentTable: 'bento_vegetables' },
    { colIndex: 6, variantCode: null,        componentTable: 'bento_staples' },
  ]

  // Data rows (skip header)
  const rows = logicalRows.slice(1)

  return { columns, rows }
}

function parseCell(cell: string | undefined): DishRecord | null {
  if (!cell) return null
  const trimmed = cell.trim()
  if (!trimmed) return null
  // Cell format: "Chinese name\nEnglish name"
  const parts = trimmed.split('\n')
  if (parts.length < 2) return null
  return {
    nameZh: parts[0].trim(),
    nameEn: parts[1].trim(),
  }
}

// ── Supabase client ─────────────────────────────────────────────────────────
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check .env.local).'
    )
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN — no writes' : '✍️  LIVE RUN — will write to Supabase')
  console.log('')

  const { columns, rows } = parseTsv(TSV_PATH)
  const supabase = adminClient()

  // Fetch variant IDs for menu_library
  const { data: variants } = await supabase
    .from('bento_menu_variants')
    .select('id, code')
  const variantMap = new Map<string, number>()
  for (const v of (variants || [])) {
    variantMap.set(v.code, v.id)
  }
  console.log(`Variants: ${[...variantMap.entries()].map(([c, id]) => `${c}=${id}`).join(', ')}`)

  // ── Collect all dishes per column ──────────────────────────────────────────
  const columnDishes: Map<number, DishRecord[]> = new Map()

  for (const col of columns) {
    const dishes: DishRecord[] = []
    const seen = new Set<string>()
    for (const row of rows) {
      const cell = row[col.colIndex]
      if (!cell) continue
      const dish = parseCell(cell)
      if (dish && !seen.has(dish.nameZh)) {
        seen.add(dish.nameZh)
        dishes.push(dish)
      }
    }
    columnDishes.set(col.colIndex, dishes)
    console.log(`Column ${col.colIndex} (${col.componentTable}): ${dishes.length} dishes`)
  }

  if (DRY_RUN) {
    console.log('\n── Dry-run preview ──')
    for (const col of columns) {
      const dishes = columnDishes.get(col.colIndex)!
      console.log(`\n[${col.componentTable}]${col.variantCode ? ` variant=${col.variantCode}` : ''}`)
      for (const d of dishes) {
        console.log(`  ${d.nameZh}  |  ${d.nameEn}`)
      }
    }
    console.log('\n✅ Dry-run complete. No data written. Remove --dry-run to import.')
    return
  }

  // ── Phase 1: Component tables ──────────────────────────────────────────────
  console.log('\n── Phase 1: Component Tables ──')

  for (const col of columns) {
    const dishes = columnDishes.get(col.colIndex)!
    if (dishes.length === 0) continue

    const table = col.componentTable

    // Fetch existing names for idempotent insert
    const { data: existingRows } = await supabase.from(table).select('id,name')
    const existingNames = new Set((existingRows || []).map((r: { name: string }) => r.name))

    let inserted = 0
    for (const d of dishes) {
      if (existingNames.has(d.nameZh)) continue
      const row: Record<string, unknown> = { name: d.nameZh, description: d.nameEn, is_active: true }
      if (table === 'bento_staples') {
        row.is_rice = d.nameZh.includes('饭') || d.nameEn.toLowerCase().includes('rice')
      }
      const { error } = await supabase.from(table).insert(row)
      if (error) {
        console.error(`  ✗ ${table}: ${d.nameZh} → ${error.message}`)
      } else {
        inserted++
      }
    }
    console.log(`  ✓ ${table}: ${inserted} new, ${dishes.length - inserted} skipped (already exist)`)
  }

  // ── Phase 2: Menu Library (proteins only) ───────────────────────────────────
  console.log('\n── Phase 2: Menu Library ──')

  for (const col of columns) {
    if (!col.variantCode) continue // vegetables & staples skip library

    const dishes = columnDishes.get(col.colIndex)!
    const variantId = variantMap.get(col.variantCode)
    if (!variantId) {
      console.error(`  ✗ variant '${col.variantCode}' not found in bento_menu_variants`)
      continue
    }

    let inserted = 0
    for (const d of dishes) {
      // Check existing to avoid duplicates
      const { data: existing } = await supabase
        .from('bento_menu_library')
        .select('id')
        .eq('variant_id', variantId)
        .eq('dish_name', d.nameZh)
        .limit(1)

      if (existing && existing.length > 0) {
        // Update description if available
        await supabase
          .from('bento_menu_library')
          .update({ description: d.nameEn })
          .eq('id', existing[0].id)
        continue
      }

      const { error } = await supabase
        .from('bento_menu_library')
        .insert({ variant_id: variantId, dish_name: d.nameZh, description: d.nameEn })

      if (error) {
        console.error(`  ✗ menu_library(${col.variantCode}): ${d.nameZh} → ${error.message}`)
      } else {
        inserted++
      }
    }
    console.log(`  ✓ menu_library(${col.variantCode}): ${inserted} new, ${dishes.length - inserted} existing`)
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n── Import Summary ──')
  for (const col of columns) {
    const dishes = columnDishes.get(col.colIndex)!
    const targets = [`${col.componentTable}(${dishes.length})`]
    if (col.variantCode) {
      targets.push(`menu_library:${col.variantCode}(${dishes.length})`)
    }
    console.log(`  Col ${col.colIndex}: ${targets.join(' + ')}`)
  }

  console.log('\n✅ Import complete.')
}

main().catch(e => {
  console.error(`\n✗ ${(e as Error).message}`)
  process.exit(1)
})
