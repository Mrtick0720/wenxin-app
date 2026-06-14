/**
 * FeedMe refresh-layer verification (LOCAL ONLY, not production).
 *
 * Proves: FEEDME_REFRESH_TOKEN → securetoken → fresh idToken → FeedMe
 * postgres-query (HTTP 201) → parsed Daily Sales revenue. No token is ever
 * printed (only lengths). No production wiring.
 *
 * Env (.env.local): FEEDME_REFRESH_TOKEN, FEEDME_BUSINESS_ID, FEEDME_RESTAURANT_ID
 * Optional: FEEDME_FIREBASE_API_KEY (defaults to the public client key),
 *           FEEDME_QUERY_FILE (default scripts/feedme-daily-sales.query.json)
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getFeedMeIdToken, hasRefreshToken } from '../lib/feedme/refreshIdToken'
import { parseFeedMeQueryResult } from '../lib/feedme/parseQueryResult'

const ENDPOINT_BASE = 'https://query-engine.feedmeapi.com/report-query'

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

function money(n: number): string {
  return `RM ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function main(): Promise<void> {
  console.log('FeedMe refresh-layer verification')

  if (!hasRefreshToken()) {
    fail('FEEDME_REFRESH_TOKEN is not set in .env.local — add it (captured from the signInWithCustomToken response) and re-run.')
  }

  // Step 1 — refreshToken → fresh idToken (via securetoken).
  const idToken = await getFeedMeIdToken()
  if (!idToken) {
    fail('securetoken refresh did not return an idToken (refresh token invalid/revoked, or API key/key mismatch).')
  }
  console.log(`  step 1 — idToken minted from refreshToken: OBTAINED (length ${idToken.length}, hidden)`)

  // Step 2 — call FeedMe postgres-query with the minted idToken.
  const businessId = process.env.FEEDME_BUSINESS_ID
  if (!businessId) fail('Missing FEEDME_BUSINESS_ID')
  const file = resolve(process.env.FEEDME_QUERY_FILE ?? 'scripts/feedme-daily-sales.query.json')
  if (!existsSync(file)) fail(`Missing query payload: ${file}`)
  let body = readFileSync(file, 'utf8').split('${FEEDME_BUSINESS_ID}').join(businessId)
  if (process.env.FEEDME_RESTAURANT_ID) {
    body = body.split('${FEEDME_RESTAURANT_ID}').join(process.env.FEEDME_RESTAURANT_ID)
  }
  const url = `${ENDPOINT_BASE}/${encodeURIComponent(businessId)}/postgres-query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body,
    cache: 'no-store',
  })
  console.log(`  step 2 — postgres-query HTTP status: ${res.status} ${res.statusText}`)
  if (!res.ok) fail(`postgres-query failed (HTTP ${res.status})`)

  // Step 3 — parse Daily Sales revenue.
  const parsed = parseFeedMeQueryResult(await res.json())
  console.log(
    `  step 3 — Daily Sales parsed: date ${parsed.date} | revenue ${money(parsed.revenue)} | qty ${parsed.qty} | pax ${parsed.pax}`,
  )
  console.log('  RESULT: refreshToken → idToken → postgres-query 201 → revenue  ✓')
}

main().catch((error) => fail((error as Error).message))
