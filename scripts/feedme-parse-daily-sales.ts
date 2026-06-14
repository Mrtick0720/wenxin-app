/**
 * FeedMe Daily Sales — LIVE parse (LOCAL ONLY, not production).
 *
 * Calls the real FeedMe `postgres-query` endpoint, parses the response with
 * parseFeedMeQueryResult, and prints ONLY a safe summary (date, revenue, gross,
 * qty, pax, serviceCharge, rounding, payment method totals). Never prints the
 * token; never dumps the full response. Not wired to the dashboard.
 *
 * Env (.env.local): FEEDME_BEARER_TOKEN, FEEDME_BUSINESS_ID, FEEDME_RESTAURANT_ID
 * Optional: FEEDME_QUERY_FILE (default scripts/feedme-daily-sales.query.json)
 *
 * Run:
 *   set -a; source .env.local; set +a
 *   npx tsc scripts/feedme-parse-daily-sales.ts lib/feedme/parseQueryResult.ts \
 *     --outDir /tmp/feedme-run --module commonjs --target es2022 \
 *     --moduleResolution node --esModuleInterop --skipLibCheck
 *   node /tmp/feedme-run/scripts/feedme-parse-daily-sales.js
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseFeedMeQueryResult } from '../lib/feedme/parseQueryResult'

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

function money(n: number): string {
  return `RM ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function main(): Promise<void> {
  const token = requireEnv('FEEDME_BEARER_TOKEN') // never logged
  const businessId = requireEnv('FEEDME_BUSINESS_ID')
  const restaurantId = requireEnv('FEEDME_RESTAURANT_ID')

  const queryFile = resolve(
    process.env.FEEDME_QUERY_FILE ?? 'scripts/feedme-daily-sales.query.json',
  )
  if (!existsSync(queryFile)) {
    fail(`Query payload not found: ${queryFile}`)
  }
  let payloadText = readFileSync(queryFile, 'utf8')
    .split('${FEEDME_BUSINESS_ID}').join(businessId)
    .split('${FEEDME_RESTAURANT_ID}').join(restaurantId)
  if (payloadText.includes('<<PASTE')) {
    fail('Query payload is still the placeholder — paste your captured Daily Sales body.')
  }
  let payload: unknown
  try {
    payload = JSON.parse(payloadText)
  } catch {
    fail(`Query payload is not valid JSON: ${queryFile}`)
  }

  const url = `${ENDPOINT_BASE}/${encodeURIComponent(businessId)}/postgres-query`
  console.log('FeedMe Daily Sales — live parse')
  console.log(`  endpoint   : POST ${url}`)
  console.log(`  restaurant : ${restaurantId}`)
  console.log('  token      : present (hidden)')
  console.log('  calling…')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).catch((error) => fail(`Network error calling FeedMe: ${(error as Error).message}`))

  console.log(`  HTTP status: ${res.status} ${res.statusText}`)
  if (!res.ok) {
    fail(`Request failed with HTTP ${res.status} ${res.statusText}`)
  }

  let json: unknown
  try {
    json = JSON.parse(await res.text())
  } catch {
    fail('Response was not JSON')
  }

  const parsed = parseFeedMeQueryResult(json)

  console.log('  ── parsed normalized business object (safe summary) ──')
  console.log(`  date          : ${parsed.date}`)
  console.log(`  revenue (Nett): ${money(parsed.revenue)}`)
  console.log(`  gross         : ${money(parsed.gross)}`)
  console.log(`  qty           : ${parsed.qty}`)
  console.log(`  pax           : ${parsed.pax}`)
  console.log(`  serviceCharge : ${money(parsed.serviceCharge)}`)
  console.log(`  rounding      : ${money(parsed.rounding)}`)
  console.log(`  payments (${parsed.payments.length}):`)
  for (const p of parsed.payments) {
    console.log(`    ${p.method.padEnd(16)} ${money(p.amount)}  (${p.percentage}%)`)
  }
}

main().catch((error) => fail((error as Error).message))
