/**
 * FeedMe Daily Sales — read-only verification (LOCAL ONLY, not production).
 *
 * Proves we can call the real FeedMe `postgres-query` endpoint with a manually
 * supplied Bearer token and retrieve Daily Sales data. It does NOT touch the
 * dashboard, Supabase, or git. Secrets come from .env.local only.
 *
 * ── .env.local setup (see scripts/feedme.env.example) ─────────────────────────
 *   FEEDME_BEARER_TOKEN   = <JWT without the "Bearer " prefix>   (never logged)
 *   FEEDME_BUSINESS_ID    = <businessId from the portal URL>
 *   FEEDME_RESTAURANT_ID  = <restaurantId from the portal URL>
 *   FEEDME_QUERY_FILE     = (optional) path to the captured payload
 *   FEEDME_DEBUG_DUMP     = (optional) "1" to print the full raw response
 *
 * ── Payload ───────────────────────────────────────────────────────────────────
 *   cp scripts/feedme-daily-sales.query.example.json \
 *      scripts/feedme-daily-sales.query.json
 *   …then paste your captured Daily Sales postgres-query body into it.
 *
 * ── Run ───────────────────────────────────────────────────────────────────────
 *   set -a; source .env.local; set +a
 *   npx tsc scripts/feedme-test-daily-sales.ts lib/feedme/parseDailySales.ts \
 *     --outDir /tmp/feedme-run --module commonjs --target es2022 \
 *     --moduleResolution node --esModuleInterop --skipLibCheck
 *   node /tmp/feedme-run/scripts/feedme-test-daily-sales.js
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  parseDailySales,
  type FeedMeDailySalesResponse,
} from '../lib/feedme/parseDailySales'

const ENDPOINT_BASE = 'https://query-engine.feedmeapi.com/report-query'

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    fail(`Missing required env var ${name}. See scripts/feedme.env.example and put it in .env.local.`)
  }
  return value
}

async function fetchSafe(url: string, token: string, body: unknown): Promise<Response> {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    fail(`Network error calling FeedMe: ${(error as Error).message}`)
  }
}

function locateRows(json: unknown): unknown[] | null {
  if (Array.isArray(json)) return json
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>
    for (const key of ['rows', 'data', 'result', 'records', 'items']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[]
    }
  }
  return null
}

function summarizeShape(json: unknown): void {
  if (Array.isArray(json)) {
    console.log(`  top-level: array of ${json.length}`)
  } else if (json && typeof json === 'object') {
    console.log(`  top-level keys: ${Object.keys(json as object).join(', ') || '(none)'}`)
  } else {
    console.log(`  top-level: ${typeof json}`)
  }
}

// Reuse the existing parser when the rows look like FeedMe Daily Sales rows.
function tryParse(rows: unknown[]): { date: string; revenue: number }[] | null {
  const first = rows[0] as Record<string, unknown> | undefined
  if (!first) return []
  if (!('Nett' in first) && !('Date' in first)) return null
  try {
    const response: FeedMeDailySalesResponse = {
      rows: rows as unknown as FeedMeDailySalesResponse['rows'],
    }
    return parseDailySales(response).map((p) => ({ date: p.date, revenue: p.revenue }))
  } catch {
    return null
  }
}

function money(n: number): string {
  return `RM ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function main(): Promise<void> {
  const token = requireEnv('FEEDME_BEARER_TOKEN') // never logged
  const businessId = requireEnv('FEEDME_BUSINESS_ID')
  const restaurantId = requireEnv('FEEDME_RESTAURANT_ID')
  const dump = process.env.FEEDME_DEBUG_DUMP === '1'

  const queryFile = resolve(
    process.env.FEEDME_QUERY_FILE ?? 'scripts/feedme-daily-sales.query.json',
  )
  if (!existsSync(queryFile)) {
    fail(
      `Query payload not found: ${queryFile}\n` +
        '  cp scripts/feedme-daily-sales.query.example.json scripts/feedme-daily-sales.query.json\n' +
        '  then paste your captured Daily Sales postgres-query body into it.',
    )
  }

  let payloadText = readFileSync(queryFile, 'utf8')
    .split('${FEEDME_BUSINESS_ID}').join(businessId)
    .split('${FEEDME_RESTAURANT_ID}').join(restaurantId)
  if (payloadText.includes('<<PASTE')) {
    fail('Query payload is still the placeholder — paste your real captured Daily Sales body into the query file.')
  }
  let payload: unknown
  try {
    payload = JSON.parse(payloadText)
  } catch {
    fail(`Query payload is not valid JSON: ${queryFile}`)
  }

  const url = `${ENDPOINT_BASE}/${encodeURIComponent(businessId)}/postgres-query`

  console.log('FeedMe Daily Sales — read-only verification')
  console.log(`  endpoint   : POST ${url}`)
  console.log(`  business   : ${businessId}`)
  console.log(`  restaurant : ${restaurantId}`)
  console.log('  token      : present (hidden)')
  console.log(`  payload    : ${queryFile}`)
  console.log('  calling…')

  const res = await fetchSafe(url, token, payload)
  console.log(`  HTTP status: ${res.status} ${res.statusText}`)

  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    console.log(`  response is not JSON (${text.length} chars). Set FEEDME_DEBUG_DUMP=1 to inspect.`)
    process.exit(res.ok ? 0 : 2)
  }

  if (!res.ok) {
    console.log('  request failed (non-2xx) — safe summary only:')
    summarizeShape(json)
    if (dump) console.log(JSON.stringify(json, null, 2))
    process.exit(2)
  }

  const rows = locateRows(json)
  if (!rows) {
    console.log('  could not locate a rows array in the response.')
    summarizeShape(json)
    if (dump) console.log(JSON.stringify(json, null, 2))
    return
  }

  console.log(`  rows returned: ${rows.length}`)
  if (rows.length === 0) {
    console.log('  (no rows — check the payload date filters)')
    return
  }

  const parsed = tryParse(rows)
  if (parsed && parsed.length > 0) {
    const dates = parsed.map((p) => p.date).filter(Boolean).sort()
    console.log(`  detected date range: ${dates[0]} → ${dates[dates.length - 1]}`)
    console.log('  parsed revenue (Nett) by date:')
    for (const p of parsed) console.log(`    ${p.date}  ${money(Number(p.revenue))}`)
  } else {
    console.log('  rows did not match the Daily Sales parser shape (Date / Nett / …).')
    console.log(`  fields on first row: ${Object.keys(rows[0] as object).join(', ')}`)
    console.log('  → share these field names so the parser mapping can be finalized.')
  }

  if (dump) console.log(JSON.stringify(json, null, 2))
}

main().catch((error) => fail((error as Error).message))
